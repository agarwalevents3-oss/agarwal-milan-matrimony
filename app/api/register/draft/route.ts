import { route } from "@/lib/api/handler";
import { personalDetailsSchema, type PersonalDetailsInput } from "@/lib/validation/registration";
import { needsPersonalDetails } from "@/lib/auth/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, fromPostgres } from "@/lib/utils/errors";
import type { z } from "zod";

export const runtime = "nodejs";

/**
 * Saves the "About you" details (PRD §5.3) with the mandatory set enforced
 * (Website Improvements §3). Two callers, one endpoint:
 *
 *   · the registration wizard, while the registration is still a DRAFT;
 *   · /personal-details, for a member whose payment has succeeded but whose
 *     mandatory details are missing. That window closes as soon as they are
 *     complete — later edits go through /api/profile/update as before.
 *
 * save_draft_profile merges (it never blanks a field it is not given), so
 * whatever a member saved earlier is preserved.
 */
export const POST = route(
  {
    access: "user",
    schema: personalDetailsSchema as z.ZodType<PersonalDetailsInput>,
    rateLimit: { limit: 120, windowSeconds: 3600 },
  },
  async ({ body, user }) => {
    const completingAfterPayment = needsPersonalDetails(user!);
    if (user!.registrationStatus !== "DRAFT" && !completingAfterPayment) {
      throw badRequest("Your registration has already been submitted.");
    }

    const db = createAdminClient();

    // After submission, date of birth is set-once: save_draft_profile runs as
    // the owner (bypassing guard_profile_update), so the lock is applied here.
    let dob: string | null = body.dob;
    if (completingAfterPayment) {
      const { data: current, error } = await db
        .from("profiles").select("dob").eq("user_id", user!.id).maybeSingle();
      if (error) throw fromPostgres(error);
      if (current?.dob) dob = null; // keep the stored value
    }

    const { error } = await db.rpc("save_draft_profile", {
      p_user_id: user!.id,
      p_profile: {
        dob, placeOfBirth: body.placeOfBirth ?? null,
        timeOfBirth: body.timeOfBirth ?? null, heightCm: body.heightCm,
        maritalStatus: body.maritalStatus, gotra: body.gotra,
        subcaste: body.subcaste ?? null,
        highestQualification: body.highestQualification,
        occupation: body.occupation, companyBusiness: body.companyBusiness ?? null,
        annualIncomeInr: body.annualIncomeInr ?? null,
      } as never,
      p_address: body.address as never,
      p_family: body.family as never,
      p_preferences: (body.partnerPreferences ?? null) as never,
    });
    if (error) throw fromPostgres(error);

    return { ok: true };
  },
);
