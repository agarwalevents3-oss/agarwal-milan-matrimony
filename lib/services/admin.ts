import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publicUrl, BUCKETS } from "@/lib/services/storage";
import { calculateAge } from "@/lib/utils/age";
import type { Enums } from "@/types/database";

/**
 * Admin reporting.
 *
 * Reads run under the ADMIN'S OWN session, not the service role: the admin RLS
 * policies already grant full visibility, so there is no reason to reach for a
 * key that bypasses every policy. If the admin role is ever revoked, these
 * queries stop returning data immediately.
 *
 * The heavier reports are SECURITY DEFINER functions that re-check is_admin()
 * internally (migration 0009), so they cannot be called by anyone else either.
 */

export interface DashboardStats {
  total_users: number; pending_verification: number; verified: number;
  pending_payments: number; suspended: number; rejected: number; drafts: number;
  interests: number; interests_pending: number; matches: number; revenue: number;
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) {
    console.error("[admin] dashboard stats failed", error);
    return null;
  }
  return data as unknown as DashboardStats;
}

export interface ActivityItem {
  kind: string; happened_at: string; registration_id: string;
  full_name: string; detail: string;
}

export async function getRecentActivity(limit = 12): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_recent_activity", { p_limit: limit });
  if (error) {
    console.error("[admin] recent activity failed", error);
    return [];
  }
  return (data ?? []) as unknown as ActivityItem[];
}

export interface RegistrationRow {
  userId: string;
  registrationId: string;
  fullName: string;
  gender: Enums["gender"];
  mobile: string;
  email: string;
  status: Enums["registration_status"];
  paymentStatus: Enums["payment_status"];
  createdAt: string;
  photoUrl: string | null;
}

export interface RegistrationPage {
  rows: RegistrationRow[];
  total: number;
  page: number;
  totalPages: number;
}

export const ADMIN_PAGE_SIZE = 20;

/** The registration queue, searched and filtered in the database (PRD §12.2). */
export async function listRegistrations(
  { search, status, page }: { search?: string; status?: string; page: number },
): Promise<RegistrationPage> {
  const supabase = await createClient();
  const offset = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;

  const { data, error } = await supabase.rpc("admin_registration_list", {
    p_search: search ?? null,
    p_status: status ?? null,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: offset,
  });

  if (error) {
    console.error("[admin] registration list failed", error);
    return { rows: [], total: 0, page, totalPages: 0 };
  }

  const rows = (data ?? []) as unknown as Array<{
    user_id: string; registration_id: string; full_name: string;
    gender: Enums["gender"]; mobile: string; email: string;
    status: Enums["registration_status"]; payment_status: Enums["payment_status"];
    created_at: string; photo_thumb_path: string | null; total_count: number;
  }>;

  const total = Number(rows[0]?.total_count ?? 0);

  return {
    rows: rows.map((row) => ({
      userId: row.user_id,
      registrationId: row.registration_id,
      fullName: row.full_name,
      gender: row.gender,
      mobile: row.mobile,
      email: row.email,
      status: row.status,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      photoUrl: publicUrl(BUCKETS.photos, row.photo_thumb_path),
    })),
    total,
    page,
    totalPages: Math.ceil(total / ADMIN_PAGE_SIZE),
  };
}

export interface AdminUserDetail {
  userId: string;
  registrationId: string;
  status: Enums["registration_status"];
  paymentStatus: Enums["payment_status"];
  rejectedReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  profile: {
    fullName: string; gender: Enums["gender"]; dob: string | null; age: number | null;
    placeOfBirth: string | null; timeOfBirth: string | null; heightCm: number | null;
    maritalStatus: Enums["marital_status"] | null; gotra: string | null; subcaste: string | null;
    highestQualification: string | null; occupation: string | null;
    companyBusiness: string | null; annualIncomeInr: number | null;
    photoUrl: string | null;
  };
  contact: { mobile: string; email: string };
  address: { line1: string | null; city: string | null; state: string | null; pincode: string | null } | null;
  family: { fatherName: string | null; motherName: string | null; native: string | null; siblings: string | null } | null;
  preferences: Record<string, string | number | null> | null;
  /** Document ids only. Files are fetched through short-lived signed URLs. */
  documents: { id: string; type: Enums["document_type"]; uploadedAt: string; consentText: string | null; consentTimestamp: string | null; sizeBytes: number }[];
  payments: { id: string; amount: number; currency: string; status: Enums["payment_status"]; gateway: string; gatewayPaymentId: string | null; createdAt: string }[];
}

/** The complete record for one member (PRD §12.3). Admin-only by RLS. */
export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();

  const [
    { data: registration }, { data: profile }, { data: user },
    { data: address }, { data: family }, { data: preferences },
    { data: documents }, { data: payments },
  ] = await Promise.all([
    supabase.from("registrations").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("mobile, email").eq("id", userId).maybeSingle(),
    supabase.from("addresses").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("family_details").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("partner_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("documents")
      .select("id, document_type, uploaded_at, consent_text, consent_timestamp, size_bytes")
      .eq("user_id", userId).order("uploaded_at", { ascending: false }),
    supabase.from("payments")
      .select("id, amount, currency, status, gateway, gateway_payment_id, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  if (!registration || !profile) return null;

  return {
    userId,
    registrationId: registration.registration_id,
    status: registration.status,
    paymentStatus: registration.payment_status,
    rejectedReason: registration.rejected_reason,
    createdAt: registration.created_at,
    verifiedAt: registration.verified_at,
    profile: {
      fullName: profile.full_name, gender: profile.gender, dob: profile.dob,
      age: profile.dob ? calculateAge(profile.dob) : null,
      placeOfBirth: profile.place_of_birth, timeOfBirth: profile.time_of_birth,
      heightCm: profile.height_cm, maritalStatus: profile.marital_status,
      gotra: profile.gotra, subcaste: profile.subcaste,
      highestQualification: profile.highest_qualification, occupation: profile.occupation,
      companyBusiness: profile.company_business, annualIncomeInr: profile.annual_income_inr,
      photoUrl: publicUrl(BUCKETS.photos, profile.photo_path ?? profile.photo_thumb_path),
    },
    contact: { mobile: user?.mobile ?? "", email: user?.email ?? "" },
    address: address
      ? { line1: address.line1, city: address.city, state: address.state, pincode: address.pincode }
      : null,
    family: family
      ? { fatherName: family.father_name, motherName: family.mother_name, native: family.native, siblings: family.siblings }
      : null,
    preferences: preferences
      ? {
          "Age": preferences.age_min || preferences.age_max
            ? `${preferences.age_min ?? "any"} – ${preferences.age_max ?? "any"}` : null,
          "Height (cm)": preferences.height_min_cm || preferences.height_max_cm
            ? `${preferences.height_min_cm ?? "any"} – ${preferences.height_max_cm ?? "any"}` : null,
          "Education": preferences.education,
          "Occupation": preferences.occupation,
          "Location": preferences.location,
          "Other expectations": preferences.other_expectations,
        }
      : null,
    documents: (documents ?? []).map((d) => ({
      id: d.id, type: d.document_type, uploadedAt: d.uploaded_at,
      consentText: d.consent_text, consentTimestamp: d.consent_timestamp,
      sizeBytes: d.size_bytes,
    })),
    payments: (payments ?? []).map((p) => ({
      id: p.id, amount: Number(p.amount), currency: p.currency, status: p.status,
      gateway: p.gateway, gatewayPaymentId: p.gateway_payment_id, createdAt: p.created_at,
    })),
  };
}

export interface AdminInterestRow {
  id: string; status: Enums["interest_status"]; createdAt: string; respondedAt: string | null;
  sender: { userId: string; name: string; registrationId: string };
  receiver: { userId: string; name: string; registrationId: string };
}

async function namesFor(userIds: string[]) {
  const map = new Map<string, { name: string; registrationId: string }>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return map;

  const supabase = await createClient();
  const [{ data: profiles }, { data: registrations }] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name").in("user_id", unique),
    supabase.from("registrations").select("user_id, registration_id").in("user_id", unique),
  ]);

  const regById = new Map((registrations ?? []).map((r) => [r.user_id, r.registration_id]));
  for (const p of profiles ?? []) {
    map.set(p.user_id, { name: p.full_name, registrationId: regById.get(p.user_id) ?? "—" });
  }
  return map;
}

/** All interests, for oversight (PRD §12.4). */
export async function listInterests(limit = 100): Promise<AdminInterestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interests")
    .select("id, status, created_at, responded_at, sender_user_id, receiver_user_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[admin] interests failed", error);
    return [];
  }

  const rows = data ?? [];
  const people = await namesFor(rows.flatMap((r) => [r.sender_user_id, r.receiver_user_id]));
  const unknown = { name: "Unknown", registrationId: "—" };

  return rows.map((row) => ({
    id: row.id, status: row.status, createdAt: row.created_at, respondedAt: row.responded_at,
    sender: { userId: row.sender_user_id, ...(people.get(row.sender_user_id) ?? unknown) },
    receiver: { userId: row.receiver_user_id, ...(people.get(row.receiver_user_id) ?? unknown) },
  }));
}

export interface AdminMatchRow {
  id: string; createdAt: string; status: Enums["match_status"];
  a: { userId: string; name: string; registrationId: string };
  b: { userId: string; name: string; registrationId: string };
}

/** All matches (PRD §12.5). */
export async function listMatches(limit = 100): Promise<AdminMatchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, created_at, status, user_a_id, user_b_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[admin] matches failed", error);
    return [];
  }

  const rows = data ?? [];
  const people = await namesFor(rows.flatMap((r) => [r.user_a_id, r.user_b_id]));
  const unknown = { name: "Unknown", registrationId: "—" };

  return rows.map((row) => ({
    id: row.id, createdAt: row.created_at, status: row.status,
    a: { userId: row.user_a_id, ...(people.get(row.user_a_id) ?? unknown) },
    b: { userId: row.user_b_id, ...(people.get(row.user_b_id) ?? unknown) },
  }));
}
