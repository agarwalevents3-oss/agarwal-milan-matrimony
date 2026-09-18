import { z } from "zod";
import { route } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Accept or reject (PRD §10.2–10.4).
 *
 * All of it — the status change, the mutual check, the match insert and the
 * three notifications — happens inside one transaction in the database, so
 * two people accepting at the same moment cannot produce two matches.
 */
export const POST = route(
  {
    access: "verified",
    schema: z.object({
      interestId: z.string().uuid(),
      action: z.enum(["ACCEPT", "REJECT"]),
    }),
    rateLimit: { limit: 100, windowSeconds: 3600 },
  },
  async ({ body }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("respond_to_interest", {
      p_interest_id: body.interestId,
      p_action: body.action,
    });
    if (error) throw fromPostgres(error);
    return { ok: true, result: data };
  },
);
