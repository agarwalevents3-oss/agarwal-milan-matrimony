import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publicUrl, BUCKETS } from "@/lib/services/storage";
import type { Enums } from "@/types/database";

/**
 * The signed-in member's own profile, for viewing and editing (PRD §8.3).
 *
 * Reads everything under the member's own session, so RLS limits it to their
 * own rows. Note what comes back about documents: the fact that an Aadhaar
 * EXISTS, and nothing else — no storage path is ever handed to the browser.
 */
export interface MyProfile {
  fullName: string;
  gender: Enums["gender"];
  mobile: string;
  email: string;
  photoUrl: string | null;
  dob: string | null;
  placeOfBirth: string | null;
  timeOfBirth: string | null;
  heightCm: number | null;
  maritalStatus: Enums["marital_status"] | null;
  gotra: string | null;
  subcaste: string | null;
  highestQualification: string | null;
  occupation: string | null;
  companyBusiness: string | null;
  annualIncomeInr: number | null;
  address: { line1: string | null; city: string | null; state: string | null; pincode: string | null };
  family: { fatherName: string | null; motherName: string | null; native: string | null; siblings: string | null };
  preferences: {
    ageMin: number | null; ageMax: number | null;
    heightMinCm: number | null; heightMaxCm: number | null;
    education: string | null; occupation: string | null;
    location: string | null; otherExpectations: string | null;
  };
  documents: { hasAadhaar: boolean; hasCertificate: boolean };
}

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const supabase = await createClient();

  const [{ data: profile }, { data: user }, { data: address }, { data: family }, { data: preferences }, { data: documents }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("users").select("mobile, email").eq("id", userId).maybeSingle(),
      supabase.from("addresses").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("family_details").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("partner_preferences").select("*").eq("user_id", userId).maybeSingle(),
      // Only the TYPE is selected — never the storage path (PRD §8.2).
      supabase.from("documents").select("document_type").eq("user_id", userId),
    ]);

  if (!profile) return null;

  const types = new Set((documents ?? []).map((d) => d.document_type));

  return {
    fullName: profile.full_name,
    gender: profile.gender,
    mobile: user?.mobile ?? "",
    email: user?.email ?? "",
    photoUrl: publicUrl(BUCKETS.photos, profile.photo_path ?? profile.photo_thumb_path),
    dob: profile.dob,
    placeOfBirth: profile.place_of_birth,
    timeOfBirth: profile.time_of_birth,
    heightCm: profile.height_cm,
    maritalStatus: profile.marital_status,
    gotra: profile.gotra,
    subcaste: profile.subcaste,
    highestQualification: profile.highest_qualification,
    occupation: profile.occupation,
    companyBusiness: profile.company_business,
    annualIncomeInr: profile.annual_income_inr,
    address: {
      line1: address?.line1 ?? null, city: address?.city ?? null,
      state: address?.state ?? null, pincode: address?.pincode ?? null,
    },
    family: {
      fatherName: family?.father_name ?? null, motherName: family?.mother_name ?? null,
      native: family?.native ?? null, siblings: family?.siblings ?? null,
    },
    preferences: {
      ageMin: preferences?.age_min ?? null, ageMax: preferences?.age_max ?? null,
      heightMinCm: preferences?.height_min_cm ?? null, heightMaxCm: preferences?.height_max_cm ?? null,
      education: preferences?.education ?? null, occupation: preferences?.occupation ?? null,
      location: preferences?.location ?? null, otherExpectations: preferences?.other_expectations ?? null,
    },
    documents: {
      hasAadhaar: types.has("AADHAAR"),
      hasCertificate: types.has("EDUCATIONAL_CERTIFICATE"),
    },
  };
}
