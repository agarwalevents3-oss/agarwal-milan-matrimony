import { route } from "@/lib/api/handler";
import { saveDraftSchema, type SaveDraftInput } from "@/lib/validation/registration";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, fromPostgres } from "@/lib/utils/errors";
import type { z } from "zod";

export const runtime = "nodejs";

/** Saves the optional profile sections while the registration is still a draft. */
export const POST = route(
  {
    access: "user",
    schema: saveDraftSchema as z.ZodType<SaveDraftInput>,
    rateLimit: { limit: 120, windowSeconds: 3600 },
  },
  async ({ body, user }) => {
    if (user!.registrationStatus !== "DRAFT") {
      throw badRequest("Your registration has already been submitted.");
    }

    const db = createAdminClient();
    const { error } = await db.rpc("save_draft_profile", {
      p_user_id: user!.id,
      p_profile: {
        dob: body.dob ?? null, placeOfBirth: body.placeOfBirth ?? null,
        timeOfBirth: body.timeOfBirth ?? null, heightCm: body.heightCm ?? null,
        maritalStatus: body.maritalStatus ?? null, gotra: body.gotra ?? null,
        subcaste: body.subcaste ?? null,
        highestQualification: body.highestQualification ?? null,
        occupation: body.occupation ?? null, companyBusiness: body.companyBusiness ?? null,
        annualIncomeInr: body.annualIncomeInr ?? null,
      } as never,
      p_address: (body.address ?? null) as never,
      p_family: (body.family ?? null) as never,
      p_preferences: (body.partnerPreferences ?? null) as never,
    });
    if (error) throw fromPostgres(error);

    return { ok: true };
  },
);
