import "server-only";

import { mobileSchema, toE164 } from "@/lib/validation/common";

/**
 * The auth-identity adapter.
 *
 * We use Supabase's NATIVE phone identity: auth.users.phone is the login
 * credential and signInWithPassword({ phone, password }) needs no SMS provider,
 * because our own OTP service owns verification (see lib/services/otp).
 *
 * This module exists as a seam. If a Supabase project cannot enable the phone
 * provider without SMS credentials, switching to a synthetic-email identity is
 * a change to THIS FILE ONLY — everything downstream keys off auth.uid(), not
 * off how the identity was spelled. See docs/DECISIONS.md.
 */

export type AuthIdentity =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string };

const STRATEGY: "phone" | "synthetic-email" = "phone";

/** Normalises whatever the user typed into the canonical E.164 form we store. */
export function normaliseMobile(input: string): string {
  return toE164(mobileSchema.parse(input));
}

/** The credential object handed to Supabase Auth for sign-in and creation. */
export function identityFor(mobileE164: string): AuthIdentity {
  if (STRATEGY === "phone") {
    return { kind: "phone", phone: mobileE164 };
  }
  // Fallback: a synthetic, non-deliverable address derived from the number.
  return { kind: "email", email: `${mobileE164.replace("+", "")}@phone.internal` };
}

/** Credentials for supabase.auth.signInWithPassword(). */
export function signInCredentials(mobileE164: string, password: string) {
  const identity = identityFor(mobileE164);
  return identity.kind === "phone"
    ? { phone: identity.phone, password }
    : { email: identity.email, password };
}

/** Attributes for supabase.auth.admin.createUser(). */
export function createUserAttributes(mobileE164: string, password: string, role: "user" | "admin" = "user") {
  const identity = identityFor(mobileE164);
  const base = {
    password,
    // Our OTP service already proved ownership, so the identity is confirmed
    // at creation; no Supabase-side SMS is ever sent.
    app_metadata: { role },
  };
  return identity.kind === "phone"
    ? { ...base, phone: identity.phone, phone_confirm: true }
    : { ...base, email: identity.email, email_confirm: true };
}
