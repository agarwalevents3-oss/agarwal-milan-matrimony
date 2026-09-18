import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";
import { badRequest, forbidden, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const schema = z.object({
  paymentId: z.string().uuid(),
  gatewayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Server-side payment verification (PRD §20.2).
 *
 * The client reporting success is never sufficient — the signature is checked
 * here against the gateway secret, and only then does the registration advance.
 * The mock gateway signs for real, so this code path is genuinely exercised in
 * development rather than stubbed out.
 */
export const POST = route(
  { access: "user", schema, rateLimit: { limit: 20, windowSeconds: 3600 } },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: payment } = await db
      .from("payments")
      .select("id, user_id, gateway_order_id, status")
      .eq("id", body.paymentId)
      .maybeSingle();

    if (!payment) throw badRequest("Payment not found.");
    if (payment.user_id !== user!.id) throw forbidden("That payment is not yours.");
    if (!payment.gateway_order_id) throw badRequest("That payment was never started.");

    const result = await getPaymentProvider().verify({
      orderId: payment.gateway_order_id,
      paymentId: body.gatewayPaymentId,
      signature: body.signature,
    });

    if (!result.ok) {
      await db.rpc("fail_payment", { p_payment_id: payment.id, p_reason: "Verification failed." });
      throw badRequest("We could not verify that payment. Please try again.");
    }

    const { data, error } = await db.rpc("confirm_payment", {
      p_payment_id: payment.id,
      p_gateway_payment_id: result.gatewayPaymentId!,
    });
    if (error) throw fromPostgres(error);

    const outcome = data as unknown as { already: boolean; registration_status: string };
    return { ok: true, status: outcome.registration_status, alreadyProcessed: outcome.already };
  },
);
