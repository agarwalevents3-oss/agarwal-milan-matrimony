import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";
import { demoPaymentsAllowed } from "@/lib/env";
import { toMinorUnits } from "@/lib/membership";
import { AppError, badRequest, forbidden, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const schema = z.object({
  paymentId: z.string().uuid(),
  gatewayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Server-side payment verification (PRD §20.2, Website Improvements §6.3B
 * steps 3–6).
 *
 * The client reporting success is never sufficient. Before anything advances:
 *   · the payment record must belong to this member;
 *   · it must have been created by the gateway now in use (a demo payment can
 *     never be verified by Razorpay, nor the other way round), and a demo
 *     payment only while demo payments are allowed;
 *   · the provider checks the signature against OUR stored order id, and —
 *     for Razorpay — the amount, currency and status the gateway recorded.
 * Only then does confirm_payment mark it SUCCESS. That function is idempotent
 * and refuses to activate a membership twice, so a repeated or duplicate
 * confirmation is harmless.
 */
export const POST = route(
  { access: "user", schema, rateLimit: { limit: 20, windowSeconds: 3600 } },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: payment } = await db
      .from("payments")
      .select("id, user_id, gateway, gateway_order_id, amount, currency, status")
      .eq("id", body.paymentId)
      .maybeSingle();

    if (!payment) throw badRequest("Payment not found.");
    if (payment.user_id !== user!.id) throw forbidden("That payment is not yours.");
    if (!payment.gateway_order_id) throw badRequest("That payment was never started.");

    const provider = getPaymentProvider();
    if (payment.gateway !== provider.name) {
      throw badRequest("This payment can no longer be completed. Please start a new payment.");
    }
    if (payment.gateway === "mock" && !demoPaymentsAllowed()) {
      throw forbidden("Test payments are not accepted.");
    }

    const result = await provider.verify({
      orderId: payment.gateway_order_id,
      paymentId: body.gatewayPaymentId,
      signature: body.signature,
      expectedAmountInPaise: toMinorUnits(Number(payment.amount)),
      expectedCurrency: payment.currency,
    });

    if (!result.ok && result.inconclusive) {
      // Not proven either way, so nothing is marked failed: the gateway's
      // webhook will confirm it if the money was taken.
      throw new AppError(
        "We could not confirm your payment yet. If money was debited, it will be confirmed automatically — please check this page again shortly before paying again.",
        502, "PAYMENT_UNCONFIRMED",
      );
    }

    if (!result.ok) {
      await db.rpc("fail_payment", {
        p_payment_id: payment.id,
        p_reason: `Verification failed: ${result.reason ?? "unknown"}.`,
      });
      throw badRequest("We could not verify that payment. Please try again.");
    }

    const { data, error } = await db.rpc("confirm_payment", {
      p_payment_id: payment.id,
      p_gateway_payment_id: result.gatewayPaymentId!,
    });
    if (error) throw fromPostgres(error);

    const outcome = data as unknown as { already: boolean; duplicate?: boolean; registration_status: string };
    return {
      ok: true,
      status: outcome.registration_status,
      alreadyProcessed: outcome.already,
      duplicate: outcome.duplicate ?? false,
    };
  },
);
