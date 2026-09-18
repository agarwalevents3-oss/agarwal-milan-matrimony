import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSiteContent } from "@/lib/services/content";
import { deleteObjects, BUCKETS, IMAGE_SLOTS } from "@/lib/services/storage";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const SLOTS = Object.keys(IMAGE_SLOTS) as [string, ...string[]];

/**
 * Website images (PRD §13).
 *
 * The file itself is uploaded by the browser straight into the `site-assets`
 * bucket, whose storage policy already restricts writes to admins. This route
 * records it, retires whatever was in that slot before, and deletes the old
 * object so the bucket does not accumulate orphans.
 */
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    slot: z.enum(SLOTS),
    storagePath: z.string().min(1).max(400),
    altText: z.string().trim().max(200),
  }),
  z.object({ action: z.literal("remove"), slot: z.enum(SLOTS) }),
]);

export const POST = route({ access: "admin", schema }, async ({ body, user }) => {
  const db = createAdminClient();

  // Whatever is currently in this slot, so its object can be destroyed.
  const { data: existing } = await db
    .from("site_images").select("id, storage_path").eq("slot", body.slot);

  if (body.action === "remove") {
    if (!existing?.length) throw badRequest("There is no image in that slot.");

    const { error } = await db.from("site_images").delete().eq("slot", body.slot);
    if (error) throw fromPostgres(error);

    await deleteObjects(BUCKETS.siteAssets, existing.map((row) => row.storage_path));
    await audit(user!.id, "REMOVE_SITE_IMAGE", { type: "site_images", id: body.slot });
    await revalidateSiteContent();
    return { ok: true };
  }

  if (!body.storagePath.startsWith(`${body.slot}/`)) {
    throw badRequest("That upload does not belong to this slot.");
  }

  // One image per slot: replace rather than accumulate.
  const { error: clearError } = await db.from("site_images").delete().eq("slot", body.slot);
  if (clearError) throw fromPostgres(clearError);

  const { error } = await db.from("site_images").insert({
    slot: body.slot,
    storage_path: body.storagePath,
    alt_text: body.altText,
    is_active: true,
  });
  if (error) throw fromPostgres(error);

  await deleteObjects(
    BUCKETS.siteAssets,
    (existing ?? []).map((row) => row.storage_path).filter((p) => p !== body.storagePath),
  );

  await audit(user!.id, "SET_SITE_IMAGE", { type: "site_images", id: body.slot });
  await revalidateSiteContent();
  return { ok: true };
});
