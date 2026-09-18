import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/** Rejects a pending registration, optionally recording why (PRD §6.5). */
export const POST = route(
  {
    access: "admin",
    schema: z.object({ userId: z.string().uuid(), reason: z.string().trim().max(500).optional() }),
  },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: registration } = await db
      .from("registrations").select("id, status, registration_id").eq("user_id", body.userId).maybeSingle();
    if (!registration) throw badRequest("Registration not found.");
    if (registration.status !== "PENDING_VERIFICATION") {
      throw badRequest("Only a registration awaiting verification can be rejected.");
    }

    const { error } = await db
      .from("registrations")
      .update({ status: "REJECTED", rejected_reason: body.reason ?? null })
      .eq("id", registration.id);
    if (error) throw fromPostgres(error);

    await db.rpc("notify_user", {
      p_recipient: body.userId,
      p_type: "PROFILE_REJECTED",
      p_title: "Your registration was not approved",
      p_message: body.reason ?? "Please contact our team for details.",
    });

    await audit(user!.id, "REJECT_USER", { type: "registration", id: registration.registration_id },
      { reason: body.reason });
    return { ok: true, status: "REJECTED" };
  },
);
