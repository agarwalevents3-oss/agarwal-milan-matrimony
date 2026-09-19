/**
 * Browser-side auth-identity adapter — the client counterpart to
 * lib/auth/identity.ts. See that file and identity-core.ts for the full
 * explanation; this one exists only because LoginForm signs a returning
 * member in directly against Supabase Auth from the browser, with no Route
 * Handler in between, so it needs the SAME strategy the server used when the
 * account was created.
 *
 * Reads NEXT_PUBLIC_AUTH_IDENTITY_STRATEGY directly rather than through
 * lib/env.ts, which is wrapped in "server-only" and cannot be imported here.
 */

import { toE164, mobileSchema } from "@/lib/validation/common";
import * as core from "./identity-core";
import type { IdentityStrategy } from "./identity-core";

const STRATEGY = (process.env.NEXT_PUBLIC_AUTH_IDENTITY_STRATEGY as IdentityStrategy | undefined) ?? "phone";

export function normaliseMobile(input: string): string {
  return toE164(mobileSchema.parse(input));
}

/** Credentials for supabase.auth.signInWithPassword(), called from the browser. */
export function clientSignInCredentials(mobileE164: string, password: string) {
  return core.signInCredentials(mobileE164, password, STRATEGY);
}
