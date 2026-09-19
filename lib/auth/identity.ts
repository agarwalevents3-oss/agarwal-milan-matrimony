import "server-only";

import { env } from "@/lib/env";
import { mobileSchema, toE164 } from "@/lib/validation/common";
import * as core from "./identity-core";

export type { AuthIdentity } from "./identity-core";

/**
 * Server-side auth-identity adapter.
 *
 * Strategy is selected by NEXT_PUBLIC_AUTH_IDENTITY_STRATEGY (see lib/env.ts —
 * public despite the name, because it is a config fact, not a credential; both
 * this file and lib/auth/identity-client.ts must read the identical value, so
 * it has to be visible to the browser bundle too).
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
 * spelled, so this is genuinely just a seam — see docs/DECISIONS.md §13.
 *
 * The actual branching lives in identity-core.ts, shared with
 * lib/auth/identity-client.ts (the browser's login form) and
 * scripts/seed-admin.mjs (a plain Node script that can import neither, since
 * it runs outside the Next.js runtime — it duplicates the branching, kept in
 * sync by reading the same env var).
 */

const STRATEGY = env.auth.identityStrategy;

/** Normalises whatever the user typed into the canonical E.164 form we store. */
export function normaliseMobile(input: string): string {
  return toE164(mobileSchema.parse(input));
}

export function identityFor(mobileE164: string) {
  return core.identityFor(mobileE164, STRATEGY);
}

/** Credentials for supabase.auth.signInWithPassword(). */
export function signInCredentials(mobileE164: string, password: string) {
  return core.signInCredentials(mobileE164, password, STRATEGY);
}

/** Attributes for supabase.auth.admin.createUser(). */
export function createUserAttributes(
  mobileE164: string,
  password: string,
  role: "user" | "admin" = "user",
) {
  return core.createUserAttributes(mobileE164, password, STRATEGY, role);
}
