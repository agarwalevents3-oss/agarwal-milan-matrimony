/**
 * Pure auth-identity logic — no env access, no "server-only" guard, safe to
 * import from either the server or the browser.
 *
 * This exists because the identity strategy has to be applied in TWO places
 * that cannot share code any other way:
 *   - server-side, when /api/register/account creates the account
 *   - client-side, when LoginForm signs a returning member in directly
 *     against Supabase Auth (no Route Handler in between)
 *
 * lib/auth/identity.ts (server) and lib/auth/identity-client.ts (browser) are
 * both thin wrappers around this file, differing only in where they read the
 * strategy from. Keeping the actual branching in one place is what stops the
 * two from silently disagreeing about how a phone number becomes a Supabase
 * Auth identity — see docs/DECISIONS.md §13.
 */

export type IdentityStrategy = "phone" | "synthetic-email";

export type AuthIdentity =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string };

/** The credential object handed to Supabase Auth for sign-in and creation. */
export function identityFor(mobileE164: string, strategy: IdentityStrategy): AuthIdentity {
  if (strategy === "phone") {
    return { kind: "phone", phone: mobileE164 };
  }
  // A synthetic, non-deliverable address derived from the number.
  return { kind: "email", email: `${mobileE164.replace("+", "")}@phone.internal` };
}

/** Credentials for supabase.auth.signInWithPassword(). */
export function signInCredentials(
  mobileE164: string,
  password: string,
  strategy: IdentityStrategy,
) {
  const identity = identityFor(mobileE164, strategy);
  return identity.kind === "phone"
    ? { phone: identity.phone, password }
    : { email: identity.email, password };
}

/** Attributes for supabase.auth.admin.createUser(). Server-only in practice. */
export function createUserAttributes(
  mobileE164: string,
  password: string,
  strategy: IdentityStrategy,
  role: "user" | "admin" = "user",
) {
  const identity = identityFor(mobileE164, strategy);
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
