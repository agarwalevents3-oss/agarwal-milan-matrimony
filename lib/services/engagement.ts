import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publicUrl, BUCKETS } from "@/lib/services/storage";
import { calculateAge } from "@/lib/utils/age";
import type { Enums } from "@/types/database";

/**
 * Interests, matches and notifications for the signed-in member.
 *
 * Every query runs under the member's own session, so RLS scopes it to rows
 * they are a party to — there is no "and where user_id = me" to forget.
 *
 * Profiles are fetched in a second query rather than as a PostgREST embed: the
 * foreign keys on `interests` and `matches` point at `users`, not `profiles`,
 * so an embed would depend on relationship inference through an intermediate
 * table. One extra round trip on a small list is the clearer trade.
 */

export interface Person {
  userId: string;
  fullName: string;
  age: number | null;
  photoUrl: string | null;
  occupation: string | null;
}

const PROFILE_COLUMNS = "user_id, full_name, dob, photo_thumb_path, occupation";

const UNKNOWN: Person = {
  userId: "", fullName: "Member", age: null, photoUrl: null, occupation: null,
};

/** Loads the card-level details for a set of members, keyed by user id. */
async function loadPeople(userIds: string[]): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return people;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("user_id", unique);

  for (const row of data ?? []) {
    people.set(row.user_id, {
      userId: row.user_id,
      fullName: row.full_name,
      age: row.dob ? calculateAge(row.dob) : null,
      photoUrl: publicUrl(BUCKETS.photos, row.photo_thumb_path),
      occupation: row.occupation,
    });
  }
  return people;
}

export interface InterestSummary {
  id: string;
  status: Enums["interest_status"];
  createdAt: string;
  respondedAt: string | null;
  person: Person;
}

async function loadInterests(
  userId: string,
  direction: "received" | "sent",
): Promise<InterestSummary[]> {
  const supabase = await createClient();
  const ownColumn = direction === "received" ? "receiver_user_id" : "sender_user_id";
  const otherColumn = direction === "received" ? "sender_user_id" : "receiver_user_id";

  const { data, error } = await supabase
    .from("interests")
    .select("id, status, created_at, responded_at, sender_user_id, receiver_user_id")
    .eq(ownColumn, userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[engagement] ${direction} interests failed`, error);
    return [];
  }

  const rows = data ?? [];
  const people = await loadPeople(rows.map((r) => r[otherColumn]));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    person: people.get(row[otherColumn]) ?? UNKNOWN,
  }));
}

/** Interests this member has received (PRD §10.2). */
export const getReceivedInterests = (userId: string) => loadInterests(userId, "received");

/** Interests this member has sent (PRD §10.1). */
export const getSentInterests = (userId: string) => loadInterests(userId, "sent");

export interface MatchSummary {
  id: string;
  createdAt: string;
  person: Person;
}

/** Mutual matches (PRD §10.4). */
export async function getMatches(userId: string): Promise<MatchSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, created_at, user_a_id, user_b_id")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[engagement] matches failed", error);
    return [];
  }

  const rows = data ?? [];
  // The pair is stored in canonical order (a < b), so which side is "the other
  // person" depends on where the viewer sits.
  const otherIds = rows.map((row) => (row.user_a_id === userId ? row.user_b_id : row.user_a_id));
  const people = await loadPeople(otherIds);

  return rows.map((row, index) => ({
    id: row.id,
    createdAt: row.created_at,
    person: people.get(otherIds[index]) ?? UNKNOWN,
  }));
}

export interface NotificationItem {
  id: string;
  type: Enums["notification_type"];
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedUserId: string | null;
  relatedInterestId: string | null;
  relatedMatchId: string | null;
}

export async function getNotifications(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at, related_user_id, related_interest_id, related_match_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[engagement] notifications failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
    relatedUserId: row.related_user_id,
    relatedInterestId: row.related_interest_id,
    relatedMatchId: row.related_match_id,
  }));
}

/** Unread count for the header badge. `head: true` fetches no rows at all. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return count ?? 0;
}
