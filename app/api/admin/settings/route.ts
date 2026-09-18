import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSiteContent } from "@/lib/services/content";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

const schema = z.object({
  adminContactNumber: z.string().trim().min(6).max(20).optional(),
  registrationFee: z.object({
    amount: z.number().int().min(0).max(1_000_000),
    currency: z.string().trim().length(3),
  }).optional(),
});

/** Admin settings (PRD §13): the displayed contact number and the fee. */
export const POST = route({ access: "admin", schema }, async ({ body, user }) => {
  const db = createAdminClient();
  const updates: { key: string; value: unknown }[] = [];

  if (body.adminContactNumber !== undefined) {
    updates.push({ key: "admin_contact_number", value: body.adminContactNumber });
  }
  if (body.registrationFee !== undefined) {
    updates.push({ key: "registration_fee", value: body.registrationFee });
  }

  for (const update of updates) {
    const { error } = await db
      .from("admin_settings")
      .upsert({ key: update.key, value: update.value as never, updated_at: new Date().toISOString() });
    if (error) throw fromPostgres(error);
    await audit(user!.id, "UPDATE_SETTING", { type: "admin_settings", id: update.key });
  }

  // The contact number appears on cached pages, so drop the cache immediately
  // rather than waiting out the revalidation window.
  await revalidateSiteContent();
  return { ok: true, updated: updates.length };
});
