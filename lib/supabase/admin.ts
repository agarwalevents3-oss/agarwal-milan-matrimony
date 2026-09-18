import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES ALL ROW LEVEL SECURITY.
 *
 * This is the only file in the repository permitted to read the service-role
 * key (enforced by an ESLint rule). Every caller must have already established
 * who the user is and what they are allowed to do — see lib/auth/guards.ts.
 *
 * Reach for this only when an operation genuinely cannot be expressed under
 * RLS: creating auth users, writing payment rows, or admin state changes.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
