import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";

export const runtime = "nodejs";

/**
 * Gateway webhook (PRD §19, §20.2). Inert under the mock provider.
 *
 * Deliberately NOT built on route(): the signature is computed over the RAW
 * body, so the body must not be parsed first. It always answers 200 — a webhook
 * that returns an error gets retried forever, and confirm_payment is idempotent
 * anyway, so a replay is harmless.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature =
    request.headers.get("x-razorpay-signature") ?? request.headers.get("x-signature");

  try {
    const event = await getPaymentProvider().parseWebhook(raw, signature);
    if (event.status === "IGNORED" || !event.orderId) {
      return NextResponse.json({ received: true });
    }

    const db = createAdminClient();
    const { data: payment } = await db
      .from("payments").select("id").eq("gateway_order_id", event.orderId).maybeSingle();

    if (!payment) return NextResponse.json({ received: true });

    await db.from("payments").update({ raw_response: event.raw as never }).eq("id", payment.id);

    if (event.status === "SUCCESS" && event.paymentId) {
      await db.rpc("confirm_payment", {
        p_payment_id: payment.id, p_gateway_payment_id: event.paymentId,
      });
    } else if (event.status === "FAILED") {
      await db.rpc("fail_payment", { p_payment_id: payment.id, p_reason: null });
    }
  } catch (error) {
    // Log and still acknowledge; the gateway must not be left retrying.
    console.error("[payment/webhook]", error);
  }

  return NextResponse.json({ received: true });
}
