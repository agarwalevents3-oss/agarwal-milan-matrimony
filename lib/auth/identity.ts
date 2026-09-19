import "server-only";

import { env } from "@/lib/env";
import { mobileSchema, toE164 } from "@/lib/validation/common";

/**
 * The auth-identity adapter.
 *
 * Two supported strategies, selected by AUTH_IDENTITY_STRATEGY (see lib/env.ts):
 *
 *   "phone"           auth.users.phone is the login credential, so
 *                      signInWithPassword({ phone, password }) works natively.
 *                      Needs the Supabase Phone provider enabled — which, on a
 *                      real project, needs a configured SMS provider (Twilio,
 *                      MessageBird, ...) before Supabase will save the toggle
 *                      at all, EVEN THOUGH our own OTP service is what
 *                      actually verifies the number (see lib/services/otp).
 *                      Confirmed against a live project 2026-09-19.
 *
 *   "synthetic-email" a non-deliverable {mobile}@phone.internal address is
 *                      used as the Auth identity instead. No dashboard
 *                      configuration needed at all. This is the default,
 *                      because it lets a real SMS provider be deferred
 *                      indefinitely without blocking login.
 *
 * Everything downstream keys off auth.uid(), never off how the identity was
 * spelled, so this is genuinely just a seam — see docs/DECISIONS.md.
 *
 * scripts/seed-admin.mjs branches on the SAME env var, because it runs outside
 * the Next.js runtime and cannot import this file.
 */

export type AuthIdentity =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string };

const STRATEGY = env.auth.identityStrategy;

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
