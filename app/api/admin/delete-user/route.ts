import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObjects, BUCKETS } from "@/lib/services/storage";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Removes an account (PRD §12.2).
 *
 * Deliberately a SOFT delete of the record plus a HARD delete of the files. The
 * registration row stays for audit and for the REG-id sequence, but every
 * uploaded object — photo, Aadhaar, certificate — is destroyed, because keeping
 * identity documents for a deleted account is exactly the kind of retention the
 * DPDP Act asks us not to do.
 */
export const POST = route(
  { access: "admin", schema: z.object({ userId: z.string().uuid() }) },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: registration } = await db
      .from("registrations").select("id, registration_id").eq("user_id", body.userId).maybeSingle();
    if (!registration) throw badRequest("Registration not found.");

    const { data: documents } = await db
      .from("documents").select("document_type, storage_path").eq("user_id", body.userId);

    const byBucket: Record<string, string[]> = {
      [BUCKETS.photos]: [], [BUCKETS.aadhaar]: [], [BUCKETS.certificates]: [],
    };
    for (const doc of documents ?? []) {
      const bucket =
        doc.document_type === "AADHAAR" ? BUCKETS.aadhaar
        : doc.document_type === "EDUCATIONAL_CERTIFICATE" ? BUCKETS.certificates
        : BUCKETS.photos;
      byBucket[bucket].push(doc.storage_path);
    }
    for (const [bucket, paths] of Object.entries(byBucket)) {
      await deleteObjects(bucket as never, paths);
    }

    const { error } = await db
      .from("registrations").update({ status: "DELETED" }).eq("id", registration.id);
    if (error) throw fromPostgres(error);

    await db.from("users").update({ account_status: "DELETED" }).eq("id", body.userId);
    await db.auth.admin.signOut(body.userId, "global").catch(() => {});

    await audit(user!.id, "DELETE_USER", { type: "registration", id: registration.registration_id });
    return { ok: true, status: "DELETED" };
  },
);
