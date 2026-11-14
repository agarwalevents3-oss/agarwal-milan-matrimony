import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";
import { toMinorUnits } from "@/lib/membership";

export const runtime = "nodejs";

/**
 * Gateway webhook (PRD §19, §20.2, Website Improvements §6.3D). Inert under
 * the mock provider; becomes live when PAYMENT_MODE=razorpay and
 * RAZORPAY_WEBHOOK_SECRET is set. Configure it in the Razorpay dashboard as
 * {site}/api/payment/webhook for payment.captured and payment.failed.
 *
 * Deliberately NOT built on route(): the signature is computed over the RAW
 * body, so the body must not be parsed first. It always answers 200 — a webhook
 * that returns an error gets retried forever.
 *
 * Safe against re-delivery and reordering, because the database functions are:
 *   · confirm_payment is idempotent, and records a duplicate payment without
 *     activating the membership twice;
 *   · fail_payment never touches a payment that already succeeded, so a
 *     delayed "failed" event cannot undo a confirmed payment;
 *   · a "captured" event after a recorded failure still confirms it.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature =
    request.headers.get("x-razorpay-signature") ?? request.headers.get("x-signature");

  try {
    const provider = getPaymentProvider();
    const event = await provider.parseWebhook(raw, signature);
    if (event.status === "IGNORED" || !event.orderId) {
      return NextResponse.json({ received: true });
    }

    const db = createAdminClient();
    const { data: payment } = await db
      .from("payments")
      .select("id, gateway, amount, currency")
      .eq("gateway_order_id", event.orderId)
      .maybeSingle();

    // Unknown order, or one created by a different gateway: not ours to settle.
    if (!payment || payment.gateway !== provider.name) return NextResponse.json({ received: true });

    await db.from("payments").update({ raw_response: event.raw as never }).eq("id", payment.id);

    if (event.status === "SUCCESS" && event.paymentId) {
      const amountMatches =
        event.amountInPaise === undefined || event.amountInPaise === toMinorUnits(Number(payment.amount));
      const currencyMatches =
        event.currency === undefined || event.currency.toUpperCase() === payment.currency.toUpperCase();

      if (!amountMatches || !currencyMatches) {
        // Never activate on a payment that does not match what was due. Left
        // for the team to review rather than auto-failed: money did move.
        console.error("[payment/webhook] amount/currency mismatch", {
          paymentId: payment.id, event: { amount: event.amountInPaise, currency: event.currency },
        });
        return NextResponse.json({ received: true });
      }

      const { error } = await db.rpc("confirm_payment", {
        p_payment_id: payment.id, p_gateway_payment_id: event.paymentId,
      });
      if (error) console.error("[payment/webhook] confirm failed", payment.id, error);
    } else if (event.status === "FAILED") {
      const { error } = await db.rpc("fail_payment", {
        p_payment_id: payment.id, p_reason: event.reason ?? "Reported as failed by the payment gateway.",
      });
      if (error) console.error("[payment/webhook] fail failed", payment.id, error);
    }
  } catch (error) {
    // Log and still acknowledge; the gateway must not be left retrying.
    console.error("[payment/webhook]", error);
  }

  return NextResponse.json({ received: true });
}
