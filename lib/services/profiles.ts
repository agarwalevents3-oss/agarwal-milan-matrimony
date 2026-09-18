import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ageRangeToDobRange } from "@/lib/utils/age";
import { RESULTS_PER_PAGE, type Filters } from "@/lib/validation/filters";
import { publicUrl, BUCKETS } from "@/lib/services/storage";
import type { Enums } from "@/types/database";

/**
 * Profile search (PRD §9).
 *
 * Runs SERVER-SIDE, under the viewer's own session, so RLS still decides every
 * row. The original plan put this in the browser to avoid a function
 * invocation, but the authenticated layout already resolves the session on the
 * server — the page is being rendered there regardless. Adding this query to
 * that same render costs one more round trip inside an invocation we are
 * already paying for, and it removes a client-side waterfall (HTML → JS →
 * query) that hurt first paint badly on mobile. Cheaper AND faster.
 *
 * What does NOT change: filters stay in local React state until DONE is
 * pressed, and DONE produces exactly one navigation and one query (PRD §9.2).
 */

export interface ProfileCardData {
  userId: string;
  fullName: string;
  dob: string | null;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  occupation: string | null;
  heightCm: number | null;
  /** The viewer's own interest toward this profile, if any. */
  interestStatus: Enums["interest_status"] | null;
}

export interface SearchResult {
  profiles: ProfileCardData[];
  total: number;
  page: number;
  totalPages: number;
}

/** Columns for a card. Deliberately minimal — see PRD §23. */
const CARD_COLUMNS =
  "user_id, full_name, dob, photo_thumb_path, city, state, occupation, height_cm";

export async function searchProfiles(filters: Filters, viewerId: string): Promise<SearchResult> {
  const supabase = await createClient();

  let query = supabase
    .from("verified_profiles")
    .select(CARD_COLUMNS, { count: "exact" })
    // You are never a result in your own search.
    .neq("user_id", viewerId);

  if (filters.gender) query = query.eq("gender", filters.gender);
  if (filters.maritalStatus) query = query.eq("marital_status", filters.maritalStatus);

  // Age is not stored; it is expressed as a dob range so the index can be used.
  const { from, to } = ageRangeToDobRange(filters.ageMin, filters.ageMax);
  if (from) query = query.gte("dob", from);
  if (to) query = query.lte("dob", to);

  if (filters.heightMinCm) query = query.gte("height_cm", filters.heightMinCm);
  if (filters.heightMaxCm) query = query.lte("height_cm", filters.heightMaxCm);
  if (filters.incomeMin) query = query.gte("annual_income_inr", filters.incomeMin);
  if (filters.incomeMax) query = query.lte("annual_income_inr", filters.incomeMax);

  // Free-text fields are matched case-insensitively and partially, because
  // people type "engineer" when the profile says "Software Engineer".
  for (const [column, value] of [
    ["gotra", filters.gotra],
    ["subcaste", filters.subcaste],
    ["highest_qualification", filters.highestQualification],
    ["occupation", filters.occupation],
    ["company_business", filters.companyBusiness],
    ["city", filters.city],
    ["state", filters.state],
  ] as const) {
    if (value) query = query.ilike(column, `%${value}%`);
  }

  const page = Math.max(1, filters.page);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Paginated in the DATABASE. Nothing beyond the current page is ever sent
  // to the browser (PRD §9.3, §9.4).
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: true })
    .range(offset, offset + RESULTS_PER_PAGE - 1);

  if (error) {
    console.error("[profiles] search failed", error);
    return { profiles: [], total: 0, page, totalPages: 0 };
  }

  // Postgres reports every VIEW column as nullable regardless of the base
  // table's constraints, so the generated types say `string | null` here. The
  // guard narrows that honestly; user_id is the view's primary key and cannot
  // actually be null.
  const rows = (data ?? []).filter(
    (row): row is typeof row & { user_id: string } => row.user_id !== null,
  );
  const interests = await getViewerInterests(viewerId, rows.map((r) => r.user_id));

  return {
    profiles: rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name ?? "Member",
      dob: row.dob,
      photoUrl: publicUrl(BUCKETS.photos, row.photo_thumb_path),
      city: row.city,
      state: row.state,
      occupation: row.occupation,
      heightCm: row.height_cm,
      interestStatus: interests.get(row.user_id) ?? null,
    })),
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / RESULTS_PER_PAGE),
  };
}

/**
 * One extra query for the whole page, rather than one per card. Tells each card
 * whether to show "Interested" or "Interest sent" (PRD §10.1).
 */
async function getViewerInterests(viewerId: string, targetIds: string[]) {
  const map = new Map<string, Enums["interest_status"]>();
  if (!targetIds.length) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("interests")
    .select("receiver_user_id, status")
    .eq("sender_user_id", viewerId)
    .in("receiver_user_id", targetIds);

  for (const row of data ?? []) map.set(row.receiver_user_id, row.status);
  return map;
}

// ── Profile detail ──────────────────────────────────────────────────────────

export interface ProfileDetail {
  userId: string;
  fullName: string;
  gender: Enums["gender"];
  dob: string | null;
  photoUrl: string | null;
  placeOfBirth: string | null;
  heightCm: number | null;
  maritalStatus: Enums["marital_status"] | null;
  gotra: string | null;
  subcaste: string | null;
  highestQualification: string | null;
  occupation: string | null;
  companyBusiness: string | null;
  annualIncomeInr: number | null;
  city: string | null;
  state: string | null;
  preferences: {
    ageMin: number | null; ageMax: number | null;
    heightMinCm: number | null; heightMaxCm: number | null;
    education: string | null; occupation: string | null;
    location: string | null; otherExpectations: string | null;
  } | null;
  interestStatus: Enums["interest_status"] | null;
  /** An interest THEY sent to the viewer that is still awaiting a reply. */
  incomingInterestId: string | null;
  isMatched: boolean;
}

/**
 * A verified member's profile as another verified member may see it (PRD §8.2).
 *
 * Reads through `verified_profiles`, whose column list structurally cannot
 * include a mobile number, an email, a document or a payment. Family details
 * are deliberately absent: they name third parties.
 *
 * Returns null when RLS says the viewer may not see it, which is also what a
 * non-existent profile returns — so this cannot be used to probe who exists.
 */
export async function getProfileDetail(
  targetUserId: string,
  viewerId: string,
): Promise<ProfileDetail | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("verified_profiles")
    .select("*")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!profile || !profile.user_id) return null;

  const [{ data: preferences }, { data: sent }, { data: incoming }, { data: match }] =
    await Promise.all([
      supabase.from("partner_preferences").select("*").eq("user_id", targetUserId).maybeSingle(),
      supabase.from("interests").select("status")
        .eq("sender_user_id", viewerId).eq("receiver_user_id", targetUserId).maybeSingle(),
      supabase.from("interests").select("id")
        .eq("sender_user_id", targetUserId).eq("receiver_user_id", viewerId)
        .eq("status", "PENDING").maybeSingle(),
      supabase.from("matches").select("id")
        .or(`and(user_a_id.eq.${viewerId},user_b_id.eq.${targetUserId}),` +
            `and(user_a_id.eq.${targetUserId},user_b_id.eq.${viewerId})`)
        .maybeSingle(),
    ]);

  return {
    userId: profile.user_id,
    fullName: profile.full_name ?? "Member",
    gender: profile.gender ?? "OTHER",
    dob: profile.dob,
    photoUrl: publicUrl(BUCKETS.photos, profile.photo_path ?? profile.photo_thumb_path),
    placeOfBirth: profile.place_of_birth,
    heightCm: profile.height_cm,
    maritalStatus: profile.marital_status,
    gotra: profile.gotra,
    subcaste: profile.subcaste,
    highestQualification: profile.highest_qualification,
    occupation: profile.occupation,
    companyBusiness: profile.company_business,
    annualIncomeInr: profile.annual_income_inr,
    city: profile.city,
    state: profile.state,
    preferences: preferences
      ? {
          ageMin: preferences.age_min, ageMax: preferences.age_max,
          heightMinCm: preferences.height_min_cm, heightMaxCm: preferences.height_max_cm,
          education: preferences.education, occupation: preferences.occupation,
          location: preferences.location, otherExpectations: preferences.other_expectations,
        }
      : null,
    interestStatus: sent?.status ?? null,
    incomingInterestId: incoming?.id ?? null,
    isMatched: Boolean(match),
  };
}

/** The admin contact number shown in place of a member's own (PRD §8.2). */
export async function getAdminContactNumber(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_settings").select("value").eq("key", "admin_contact_number").maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}
