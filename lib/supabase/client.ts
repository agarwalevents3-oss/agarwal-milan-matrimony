"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser client. Carries the anon key and the user's session cookie, so every
 * query it makes is subject to Row Level Security.
 *
 * Profile search runs through this client on purpose: it goes straight to
 * Postgres without touching a serverless function, which is both the fastest
 * and the cheapest path for our highest-traffic read.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
