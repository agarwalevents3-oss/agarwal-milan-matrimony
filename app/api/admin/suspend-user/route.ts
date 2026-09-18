import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObjects, BUCKETS } from "@/lib/services/storage";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Suspends or restores an account (PRD §12.2).
 *
 * Suspension does three things that must happen together: the status change
 * (which is what RLS reads, so profile access dies on the next request), a
 * session revocation, and DELETION OF THE PUBLIC PHOTO OBJECTS. That last step
 * is what makes a public photo bucket safe — the image stops being reachable
 * even by someone holding the old URL.
 */
export const POST = route(
  {
    access: "admin",
    schema: z.object({ userId: z.string().uuid(), suspend: z.boolean().default(true) }),
  },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: registration } = await db
      .from("registrations").select("id, status, registration_id").eq("user_id", body.userId).maybeSingle();
    if (!registration) throw badRequest("Registration not found.");

    const nextStatus = body.suspend ? "SUSPENDED" : "VERIFIED";
    const { error } = await db
      .from("registrations").update({ status: nextStatus }).eq("id", registration.id);
    if (error) throw fromPostgres(error);

    await db.from("users")
      .update({ account_status: body.suspend ? "SUSPENDED" : "ACTIVE" })
      .eq("id", body.userId);

    if (body.suspend) {
      await db.auth.admin.signOut(body.userId, "global").catch(() => {});

      const { data: profile } = await db
        .from("profiles").select("photo_path, photo_thumb_path").eq("user_id", body.userId).maybeSingle();
      await deleteObjects(BUCKETS.photos, [profile?.photo_path, profile?.photo_thumb_path]);
    }

    await audit(user!.id, body.suspend ? "SUSPEND_USER" : "RESTORE_USER",
      { type: "registration", id: registration.registration_id });
    return { ok: true, status: nextStatus };
  },
);
