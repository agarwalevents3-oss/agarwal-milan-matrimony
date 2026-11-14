import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/services/payment";
import { getMembershipPlan, paymentAvailability } from "@/lib/services/membership";
import { toMinorUnits } from "@/lib/membership";
import { badRequest, AppError, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const schema = z.object({
  // The checkbox on the payment page must be ticked; the server checks it too
  // (Website Improvements §6.1E).
  acceptedPolicies: z.literal(true, {
    message: "Please confirm that you have read and agree to the Terms & Conditions and the Refund & Cancellation Policy.",
  }),
});

/**
 * Starts a payment (Website Improvements §6.3B step 1).
 *
 * The amount comes from the membership plan's single authoritative price
 * (admin_settings via lib/services/membership.ts), never from the client, and
 * the order is recorded against the member's registration with the plan code.
 */
export const POST = route(
  { access: "user", schema, rateLimit: { limit: 10, windowSeconds: 3600 } },
  async ({ user }) => {
    if (user!.registrationStatus !== "PAYMENT_PENDING" && user!.registrationStatus !== "PAYMENT_FAILED") {
      throw badRequest("There is no payment outstanding on your registration.");
    }

    const plan = await getMembershipPlan();
    const availability = paymentAvailability(plan);
    if (!availability.available) throw badRequest(availability.reason);
    const price = plan.price!;

    const db = createAdminClient();

    // A previous attempt failed, so this is a retry. The status machine allows
    // PAYMENT_FAILED -> PAYMENT_PENDING but NOT PAYMENT_FAILED ->
    // PAYMENT_SUCCESS, so the registration has to come back to PENDING before
    // confirm_payment can advance it (migration 0010).
    if (user!.registrationStatus === "PAYMENT_FAILED") {
      const { error } = await db.rpc("begin_payment_retry", { p_user_id: user!.id });
      if (error) throw fromPostgres(error);
    }

    const { data: registration } = await db
      .from("registrations").select("id, registration_id").eq("user_id", user!.id).maybeSingle();
    if (!registration) throw badRequest("Registration not found.");

    const provider = getPaymentProvider();
    const order = await provider.createOrder({
      amountInPaise: toMinorUnits(price.amount),
      currency: price.currency,
      receipt: registration.registration_id,
      notes: { registrationId: registration.registration_id, membershipPlan: plan.code },
    });

   
const { data: payment, error } = await db
  .from("payments")
  .insert({
    user_id: user!.id,
    registration_id: registration.id,
    amount: price.amount,
    currency: price.currency,
    status: "INITIATED",
    gateway: provider.name,
    gateway_order_id: order.orderId,
  })
  .select("id")
  .single();

if (error || !payment) {
  console.error("[payment/create] insert failed", error);
  throw new AppError(
    "Could not start the payment. Please try again.",
    500,
    "INTERNAL"
  );
}


    return {
      ok: true,
      paymentId: payment.id,
      orderId: order.orderId,
      amount: price.amount,
      amountInPaise: order.amountInPaise,
      currency: price.currency,
      gateway: provider.name,
      publicKey: order.publicKey ?? null,
    };
  },
);
