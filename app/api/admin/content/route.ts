import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSiteContent } from "@/lib/services/content";
import { fromPostgres } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Website content (PRD §13).
 *
 * Content is stored as JSON per key, so a new section is a new row rather than
 * a schema change — which is what lets the admin edit copy without a redeploy.
 * The shape is validated per key so a malformed payload cannot break the
 * public pages.
 */
const SHAPES = {
  hero: z.object({
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(400),
    ctaPrimary: z.string().trim().min(1).max(40),
    ctaSecondary: z.string().trim().min(1).max(40),
  }),
  about: z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(4000),
  }),
  why_choose_us: z.object({
    title: z.string().trim().min(1).max(120),
    items: z.array(z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().max(600),
    })).max(8),
  }),
  cta: z.object({
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(400),
    button: z.string().trim().min(1).max(40),
  }),
  contact: z.object({
    companyName: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(24),
    email: z.string().trim().max(160),
    address: z.string().trim().max(400),
    hours: z.string().trim().max(160).optional(),
  }),
  footer: z.object({
    tagline: z.string().trim().max(240),
    copyright: z.string().trim().max(160),
  }),
} as const;

const schema = z.object({
  key: z.enum(Object.keys(SHAPES) as [keyof typeof SHAPES, ...(keyof typeof SHAPES)[]]),
  value: z.unknown(),
});

export const POST = route({ access: "admin", schema }, async ({ body, user }) => {
  const parsed = SHAPES[body.key].safeParse(body.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: `${issue.path.join(".") || "value"}: ${issue.message}`, code: "BAD_REQUEST" },
      { status: 400 },
    ) as never;
  }

  const db = createAdminClient();
  const { error } = await db.from("site_content").upsert({
    key: body.key,
    value: parsed.data as never,
    updated_at: new Date().toISOString(),
    updated_by: user!.id,
  });
  if (error) throw fromPostgres(error);

  await audit(user!.id, "UPDATE_CONTENT", { type: "site_content", id: body.key });

  // Invalidate immediately so the change is live on the next page view.
  await revalidateSiteContent();
  return { ok: true };
});
