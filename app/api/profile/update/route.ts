import { route } from "@/lib/api/handler";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromPostgres } from "@/lib/utils/errors";
import type { z } from "zod";
import type { Database } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export const runtime = "nodejs";

/**
 * Edits the OPTIONAL parts of a profile (PRD §8.3).
 *
 * Name, gender, date of birth, Aadhaar and verification state are absent from
 * the schema AND blocked by guard_profile_update() in the database, so a
 * hand-crafted request cannot reach them either.
 */
export const POST = route(
  {
    access: "user",
    schema: profileUpdateSchema as z.ZodType<ProfileUpdateInput>,
    rateLimit: { limit: 60, windowSeconds: 3600 },
  },
  async ({ body, user }) => {
    const db = createAdminClient();
    const userId = user!.id;

    // Only fields the caller actually sent are touched, so a partial edit never
    // blanks out the rest of someone's profile.
    const profilePatch: ProfileUpdate = {};
    const assign = <K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K] | undefined) => {
      if (value !== undefined) profilePatch[key] = value;
    };

    assign("place_of_birth", body.placeOfBirth);
    assign("time_of_birth", body.timeOfBirth);
    assign("height_cm", body.heightCm);
    assign("marital_status", body.maritalStatus);
    assign("gotra", body.gotra);
    assign("subcaste", body.subcaste);
    assign("highest_qualification", body.highestQualification);
    assign("occupation", body.occupation);
    assign("company_business", body.companyBusiness);
    assign("annual_income_inr", body.annualIncomeInr);

    if (Object.keys(profilePatch).length) {
      const { error } = await db.from("profiles").update(profilePatch).eq("user_id", userId);
      if (error) throw fromPostgres(error);
    }

    if (body.address) {
      const { error } = await db.from("addresses").upsert({
        user_id: userId,
        line1: body.address.line1 ?? null, city: body.address.city ?? null,
        state: body.address.state ?? null, pincode: body.address.pincode ?? null,
      });
      if (error) throw fromPostgres(error);
    }

    if (body.family) {
      const { error } = await db.from("family_details").upsert({
        user_id: userId,
        father_name: body.family.fatherName ?? null, mother_name: body.family.motherName ?? null,
        native: body.family.native ?? null, siblings: body.family.siblings ?? null,
      });
      if (error) throw fromPostgres(error);
    }

    if (body.partnerPreferences) {
      const p = body.partnerPreferences;
      const { error } = await db.from("partner_preferences").upsert({
        user_id: userId,
        age_min: p.ageMin ?? null, age_max: p.ageMax ?? null,
        height_min_cm: p.heightMinCm ?? null, height_max_cm: p.heightMaxCm ?? null,
        education: p.education ?? null, occupation: p.occupation ?? null,
        location: p.location ?? null, other_expectations: p.otherExpectations ?? null,
      });
      if (error) throw fromPostgres(error);
    }

    return { ok: true };
  },
);
