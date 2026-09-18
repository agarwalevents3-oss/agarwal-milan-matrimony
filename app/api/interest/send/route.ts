import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Sends an interest (PRD §10.1).
 *
 * Runs as the USER, not the service role: send_interest() is SECURITY DEFINER
 * and does its own eligibility checks against auth.uid(), so calling it with
 * the caller's own session keeps the database as the single source of truth
 * about who may do this. Duplicates are caught by a unique constraint.
 */
export const POST = route(
  {
    access: "verified",
    schema: z.object({ receiverUserId: z.string().uuid() }),
    rateLimit: { limit: 50, windowSeconds: 3600 },
  },
  async ({ body }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("send_interest", { p_receiver: body.receiverUserId });
    if (error) throw fromPostgres(error);
    return { ok: true, interest: data };
  },
);
