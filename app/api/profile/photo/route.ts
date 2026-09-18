import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUploadedObject, deleteObjects, BUCKETS } from "@/lib/services/storage";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const schema = z.object({
  photoPath: z.string().min(1),
  photoThumbPath: z.string().min(1),
});

/**
 * Replaces the profile photo (PRD §8.3).
 *
 * The OLD objects are hard-deleted. That matters because the photo bucket is
 * public: without this, a replaced photo would stay reachable at its old URL
 * forever. A new upload always lands on a fresh random path, so the old URL
 * dies with the object.
 */
export const POST = route(
  { access: "user", schema, rateLimit: { limit: 20, windowSeconds: 3600 } },
  async ({ body, user }) => {
    const userId = user!.id;
    const db = createAdminClient();

    const [photo] = await Promise.all([
      verifyUploadedObject(BUCKETS.photos, body.photoPath, userId),
      verifyUploadedObject(BUCKETS.photos, body.photoThumbPath, userId),
    ]);

    const { data: current } = await db
      .from("profiles").select("photo_path, photo_thumb_path").eq("user_id", userId).maybeSingle();

    const { error } = await db
      .from("profiles")
      .update({ photo_path: body.photoPath, photo_thumb_path: body.photoThumbPath })
      .eq("user_id", userId);
    if (error) throw fromPostgres(error);

    await db.from("documents").insert({
      user_id: userId, document_type: "PROFILE_PHOTO", storage_path: photo.path,
      mime_type: photo.mimeType, size_bytes: photo.sizeBytes,
    });

    if (current?.photo_path && current.photo_path !== body.photoPath) {
      await deleteObjects(BUCKETS.photos, [current.photo_path, current.photo_thumb_path]);
    }

    return { ok: true, photoPath: body.photoPath };
  },
);
