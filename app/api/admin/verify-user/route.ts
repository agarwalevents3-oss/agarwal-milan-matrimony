import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Verifies a registration (PRD §6.5, §12.2).
 *
 * The payment check below is a courtesy that produces a clear message — the
 * real guarantee is enforce_payment_before_verification() in the database,
 * which rejects the update outright if payment is not SUCCESS.
 */
export const POST = route(
  { access: "admin", schema: z.object({ userId: z.string().uuid() }) },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: registration } = await db
      .from("registrations")
      .select("id, status, payment_status, registration_id")
      .eq("user_id", body.userId)
      .maybeSingle();

    if (!registration) throw badRequest("Registration not found.");
    if (registration.payment_status !== "SUCCESS") {
      throw badRequest("This registration cannot be verified until its payment has succeeded.");
    }
    if (registration.status !== "PENDING_VERIFICATION" && registration.status !== "SUSPENDED") {
      throw badRequest(`A registration in state ${registration.status} cannot be verified.`);
    }

    const { error } = await db
      .from("registrations").update({ status: "VERIFIED" }).eq("id", registration.id);
    if (error) throw fromPostgres(error);

    await db.rpc("notify_user", {
      p_recipient: body.userId,
      p_type: "PROFILE_VERIFIED",
      p_title: "Your profile is verified",
      p_message: "You now have full access. Start discovering profiles.",
    });

    await audit(user!.id, "VERIFY_USER", { type: "registration", id: registration.registration_id });
    return { ok: true, status: "VERIFIED" };
  },
);
