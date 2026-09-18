import "server-only";

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbidden, unauthorized } from "@/lib/utils/errors";
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
}

/** The signed-in user with their live status, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // One joined read under RLS: a user may always see their own rows.
  const { data } = await supabase
    .from("users")
    .select("id, mobile, email, role, account_status, registrations(registration_id, status, payment_status)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  const registration = Array.isArray(data.registrations)
    ? data.registrations[0]
    : data.registrations;

  return {
    id: data.id,
    mobile: data.mobile,
    email: data.email,
    role: data.role,
    accountStatus: data.account_status,
    registrationStatus: registration?.status ?? "DRAFT",
    paymentStatus: registration?.payment_status ?? "PENDING",
    registrationId: registration?.registration_id ?? "",
  };
}

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
