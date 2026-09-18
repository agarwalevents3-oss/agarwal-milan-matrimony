import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Session-less anon client for PUBLIC data only.
 *
 * The cookie-backed server client cannot be used inside a cached function —
 * caching a response that depends on a session would be wrong, and Next
 * rightly refuses. Public website content has no session to depend on, so it is
 * read with a plain anon client and is fully cacheable.
 *
 * Still bound by RLS: it can only reach rows whose policy grants `anon`, which
 * is exactly site_content, site_images and published FAQs.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
