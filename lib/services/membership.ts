import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { demoPaymentsAllowed, env, razorpayConfigured } from "@/lib/env";
import { buildMembershipPlan, type MembershipPlan } from "@/lib/membership";

/**
 * The membership plan with its authoritative price (Website Improvements §6.2).
 *
 * The fee is read with the service role because admin_settings is admin-only
 * under RLS — which is why the payment page used to fall back to a hard-coded
 * ₹999 while /api/payment/create charged whatever the admin had set. Both now
 * call this one function, so the displayed price and the charged price cannot
 * differ.
 */
export async function getMembershipPlan(): Promise<MembershipPlan> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_settings").select("value").eq("key", "registration_fee").maybeSingle();
  if (error) console.error("[membership] could not read the registration fee", error);
  return buildMembershipPlan(data?.value);
}

export type PaymentAvailability =
  | { available: true; demo: boolean }
  | { available: false; demo: false; reason: string };

/**
 * Whether a member can pay right now, and whether it would be a demo payment.
 * Shared by the payment page (to explain) and /api/payment/create (to refuse).
 */
export function paymentAvailability(plan: MembershipPlan): PaymentAvailability {
  if (!plan.price) {
    return {
      available: false, demo: false,
      reason: "Membership pricing is being finalised, so online payment is not open yet. Please contact us.",
    };
  }
  if (env.payment.mode === "razorpay") {
    return razorpayConfigured()
      ? { available: true, demo: false }
      : { available: false, demo: false, reason: "Online payment is temporarily unavailable. Please contact us." };
  }
  return demoPaymentsAllowed()
    ? { available: true, demo: true }
    : { available: false, demo: false, reason: "Online payment is not available yet. Please contact us to complete your membership." };
}
