import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSiteContent } from "@/lib/services/content";
import { badRequest, fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/** Add, edit, delete, reorder, enable and disable FAQs (PRD §4.4). */
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    question: z.string().trim().min(3).max(300),
    answer: z.string().trim().min(3).max(3000),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    question: z.string().trim().min(3).max(300).optional(),
    answer: z.string().trim().min(3).max(3000).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({
    action: z.literal("reorder"),
    // The complete ordered list, so a reorder is one atomic intent rather than
    // a sequence of swaps that could interleave badly.
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
]);

export const POST = route({ access: "admin", schema }, async ({ body, user }) => {
  const db = createAdminClient();

  switch (body.action) {
    case "create": {
      const { data: last } = await db
        .from("faqs").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();

      const { data, error } = await db.from("faqs").insert({
        question: body.question,
        answer: body.answer,
        sort_order: (last?.sort_order ?? 0) + 1,
      }).select("id").single();
      if (error) throw fromPostgres(error);

      await audit(user!.id, "CREATE_FAQ", { type: "faq", id: data.id });
      await revalidateSiteContent();
      return { ok: true, id: data.id };
    }

    case "update": {
      const patch: Record<string, unknown> = {};
      if (body.question !== undefined) patch.question = body.question;
      if (body.answer !== undefined) patch.answer = body.answer;
      if (body.isActive !== undefined) patch.is_active = body.isActive;
      if (!Object.keys(patch).length) throw badRequest("Nothing to update.");

      const { error } = await db.from("faqs").update(patch as never).eq("id", body.id);
      if (error) throw fromPostgres(error);

      await audit(user!.id, "UPDATE_FAQ", { type: "faq", id: body.id });
      await revalidateSiteContent();
      return { ok: true };
    }

    case "delete": {
      const { error } = await db.from("faqs").delete().eq("id", body.id);
      if (error) throw fromPostgres(error);

      await audit(user!.id, "DELETE_FAQ", { type: "faq", id: body.id });
      await revalidateSiteContent();
      return { ok: true };
    }

    case "reorder": {
      for (const [index, id] of body.ids.entries()) {
        const { error } = await db.from("faqs").update({ sort_order: index + 1 }).eq("id", id);
        if (error) throw fromPostgres(error);
      }
      await audit(user!.id, "REORDER_FAQS", { type: "faq", id: "all" });
      await revalidateSiteContent();
      return { ok: true };
    }
  }
});
