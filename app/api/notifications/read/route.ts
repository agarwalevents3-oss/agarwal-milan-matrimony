import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Marks notifications read (PRD §11.3).
 *
 * Runs under the user's own session: RLS scopes the update to their own rows,
 * and a column-level grant means is_read is the only field they can touch.
 */
export const POST = route(
  {
    access: "user",
    schema: z.object({ notificationId: z.string().uuid().optional(), all: z.boolean().optional() }),
  },
  async ({ body, user }) => {
    const supabase = await createClient();
    let query = supabase.from("notifications").update({ is_read: true })
      .eq("recipient_user_id", user!.id).eq("is_read", false);

    if (!body.all && body.notificationId) query = query.eq("id", body.notificationId);

    const { error } = await query;
    if (error) throw fromPostgres(error);
    return { ok: true };
  },
);
