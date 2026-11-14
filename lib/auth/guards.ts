import "server-only";

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbidden, unauthorized } from "@/lib/utils/errors";
import { missingPersonalDetails } from "@/lib/validation/registration";
import type { Enums } from "@/types/database";

/**
 * Server-side authorisation.
 *
 * PRD §15.2: route hiding is not authorisation. Middleware redirects for a
 * decent user experience; THESE functions, plus RLS, are what actually decide
 * access. Every guard re-reads the database rather than trusting a JWT claim,
 * so a suspension or rejection takes effect on the very next request.
 */

export interface SessionUser {
  id: string;
  mobile: string;
  email: string;
  role: Enums["user_role"];
  accountStatus: Enums["account_status"];
  registrationStatus: Enums["registration_status"];
  paymentStatus: Enums["payment_status"];
  registrationId: string;
  /** Every mandatory personal detail is filled in (Website Improvements §3). */
  personalDetailsComplete: boolean;
}

/** Embedded rows come back as an object for 1:1 relations, an array otherwise. */
const one = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);

/** The signed-in user with their live status, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // One joined read under RLS: a user may always see their own rows. The
  // required personal details ride along in the same request, so the
  // post-payment completeness gate costs no extra round trip.
  const { data } = await supabase
    .from("users")
    .select(
      "id, mobile, email, role, account_status, " +
      "registrations(registration_id, status, payment_status), " +
      "profiles(dob, height_cm, marital_status, gotra, highest_qualification, occupation), " +
      "addresses(city, state, pincode), " +
      "family_details(father_name, mother_name)",
    )
    .eq("id", user.id)
    .maybeSingle<{
      id: string; mobile: string; email: string;
      role: Enums["user_role"]; account_status: Enums["account_status"];
      registrations: RegistrationRow | RegistrationRow[] | null;
      profiles: ProfileDetailsRow | ProfileDetailsRow[] | null;
      addresses: AddressRow | AddressRow[] | null;
      family_details: FamilyRow | FamilyRow[] | null;
    }>();

  if (!data) return null;

  const registration = one(data.registrations);
  const profile = one(data.profiles);
  const address = one(data.addresses);
  const family = one(data.family_details);

  const missing = missingPersonalDetails({
    dob: profile?.dob, heightCm: profile?.height_cm, maritalStatus: profile?.marital_status,
    gotra: profile?.gotra, highestQualification: profile?.highest_qualification,
    occupation: profile?.occupation,
    city: address?.city, state: address?.state, pincode: address?.pincode,
    fatherName: family?.father_name, motherName: family?.mother_name,
  });

  return {
    id: data.id,
    mobile: data.mobile,
    email: data.email,
    role: data.role,
    accountStatus: data.account_status,
    // A member with no registration row at all is treated as awaiting
    // verification (Website Improvements §4: "missing status — treat as
    // pending"), so they get the holding screen and nothing more. The admin
    // never has a registration row and keeps its previous fallback.
    registrationStatus:
      registration?.status ?? (data.role === "admin" ? "DRAFT" : "PENDING_VERIFICATION"),
    paymentStatus: registration?.payment_status ?? "PENDING",
    registrationId: registration?.registration_id ?? "",
    personalDetailsComplete: missing.length === 0,
  };
}

interface RegistrationRow {
  registration_id: string;
  status: Enums["registration_status"];
  payment_status: Enums["payment_status"];
}
interface ProfileDetailsRow {
  dob: string | null; height_cm: number | null; marital_status: Enums["marital_status"] | null;
  gotra: string | null; highest_qualification: string | null; occupation: string | null;
}
interface AddressRow { city: string | null; state: string | null; pincode: string | null }
interface FamilyRow { father_name: string | null; mother_name: string | null }

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (user.accountStatus === "DELETED") throw forbidden("This account is no longer active.");
  return user;
}

/** Full matrimonial access: verified, not suspended (PRD §7.2). */
export async function requireVerified(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.registrationStatus === "SUSPENDED" || user.accountStatus === "SUSPENDED") {
    throw forbidden("Your account is currently suspended. Please contact support.");
  }
  if (user.registrationStatus !== "VERIFIED") {
    throw forbidden("Your profile is not verified yet.");
  }
  // The mandatory personal details cannot be bypassed by calling the API
  // directly while the pages keep redirecting to the form.
  if (!user.personalDetailsComplete) {
    throw forbidden("Please complete your personal details to continue.");
  }
  return user;
}

/**
 * Admin access. Deliberately checks the DATABASE role rather than the JWT
 * claim, so revoking admin takes effect immediately and a stale token cannot
 * be replayed. RLS separately checks the claim, so both must agree.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden("Administrator access is required.");

  const db = createAdminClient();
  const { data } = await db.from("users").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") throw forbidden("Administrator access is required.");

  return user;
}

/** Best-effort client IP for rate limiting and consent records. */
export function getClientIp(request: NextRequest | Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
