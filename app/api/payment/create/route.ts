import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";
import { badRequest, AppError, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/** Starts a payment. The amount is read from admin_settings, never from the client. */
export const POST = route(
  { access: "user", schema: z.object({}).optional() as z.ZodType<unknown>, rateLimit: { limit: 10, windowSeconds: 3600 } },
  async ({ user }) => {
    if (user!.registrationStatus !== "PAYMENT_PENDING" && user!.registrationStatus !== "PAYMENT_FAILED") {
      throw badRequest("There is no payment outstanding on your registration.");
    }

    const db = createAdminClient();

    // A previous attempt failed, so this is a retry. The status machine allows
    // PAYMENT_FAILED -> PAYMENT_PENDING but NOT PAYMENT_FAILED ->
    // PAYMENT_SUCCESS, so the registration has to come back to PENDING before
    // confirm_payment can advance it (migration 0010).
    if (user!.registrationStatus === "PAYMENT_FAILED") {
      const { error } = await db.rpc("begin_payment_retry", { p_user_id: user!.id });
      if (error) throw fromPostgres(error);
    }

    const { data: setting } = await db
      .from("admin_settings").select("value").eq("key", "registration_fee").maybeSingle();
    const fee = (setting?.value ?? { amount: 999, currency: "INR" }) as { amount: number; currency: string };

    const { data: registration } = await db
      .from("registrations").select("id, registration_id").eq("user_id", user!.id).maybeSingle();
    if (!registration) throw badRequest("Registration not found.");

    const provider = getPaymentProvider();
    const order = await provider.createOrder({
      amountInPaise: Math.round(fee.amount * 100),
      currency: fee.currency,
      receipt: registration.registration_id,
      notes: { registrationId: registration.registration_id },
    });

    const { data: payment, error } = await db
      .from("payments")
      .insert({
        user_id: user!.id,
        registration_id: registration.id,
        amount: fee.amount,
        currency: fee.currency,
        status: "INITIATED",
        gateway: provider.name,
        gateway_order_id: order.orderId,
      })
      .select("id")
      .single();

    if (error || !payment) {
      console.error("[payment/create] insert failed", error);
      throw new AppError("Could not start the payment. Please try again.", 500, "INTERNAL");
    }

    return {
      ok: true,
      paymentId: payment.id,
      orderId: order.orderId,
      amount: fee.amount,
      currency: fee.currency,
      gateway: provider.name,
      publicKey: order.publicKey ?? null,
    };
  },
);
