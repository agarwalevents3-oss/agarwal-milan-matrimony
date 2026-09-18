import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Nightly retention sweep (Vercel Cron).
 *
 * Purges expired OTP records, stale rate-limit buckets and long-read
 * notifications. This is what keeps the database comfortably inside the free
 * tier's 500 MB no matter how long the site runs.
 */
export async function GET(request: NextRequest) {
  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${env.secrets.cron}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: deleted, error } = await db.rpc("cleanup_expired");
  if (error) {
    console.error("[cron/cleanup]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  // Abandoned signups. The RPC removes the application rows and hands back the
  // ids; the matching auth users must go too, otherwise the mobile number stays
  // claimed by an account that no longer exists anywhere else.
  const { data: purgedIds } = await db.rpc("purge_abandoned_drafts", { p_older_than_days: 14 });
  let purgedAuthUsers = 0;
  for (const id of purgedIds ?? []) {
    const { error: authError } = await db.auth.admin.deleteUser(id);
    if (authError) console.error("[cron/cleanup] could not delete auth user", id, authError);
    else purgedAuthUsers += 1;
  }

  return NextResponse.json({ ok: true, deleted, purgedAuthUsers });
}
