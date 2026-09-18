import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { handleError, badRequest, tooManyRequests } from "@/lib/utils/errors";
import { requireUser, requireVerified, requireAdmin, getClientIp, type SessionUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared Route Handler scaffolding.
 *
 * Every route declares what it needs — who may call it, what limits apply, what
 * the body must look like — and gets a validated, authorised context. Doing it
 * declaratively means a route cannot silently omit the auth check, and no route
 * ever hand-rolls its own error formatting (PRD §22).
 */

type Access = "public" | "user" | "verified" | "admin";

interface RouteConfig<TBody> {
  access: Access;
  schema?: ZodType<TBody>;
  /** Fixed-window limit applied per user, or per IP for public routes. */
  rateLimit?: { limit: number; windowSeconds: number; key?: string };
}

export interface RouteContext<TBody> {
  body: TBody;
  user: SessionUser | null;
  ip: string;
  request: NextRequest;
  params: Record<string, string>;
}

export function route<TBody = undefined>(
  config: RouteConfig<TBody>,
  handler: (ctx: RouteContext<TBody>) => Promise<NextResponse | object>,
) {
  return async (
    request: NextRequest,
    segment?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const context = `${request.method} ${new URL(request.url).pathname}`;

    try {
      const user =
        config.access === "admin" ? await requireAdmin()
        : config.access === "verified" ? await requireVerified()
        : config.access === "user" ? await requireUser()
        : null;

      const ip = getClientIp(request);

      if (config.rateLimit) {
        const subject = user?.id ?? ip;
        const key = `${config.rateLimit.key ?? new URL(request.url).pathname}:${subject}`;
        const db = createAdminClient();
        const { data: allowed } = await db.rpc("check_rate_limit", {
          p_key: key,
          p_limit: config.rateLimit.limit,
          p_window_seconds: config.rateLimit.windowSeconds,
        });
        if (allowed === false) throw tooManyRequests();
      }

      let body = undefined as TBody;
      if (config.schema) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          throw badRequest("Expected a JSON body.");
        }
        const parsed = config.schema.safeParse(raw);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw badRequest(first?.message ?? "Some details are not valid.");
        }
        body = parsed.data;
      }

      const params = segment ? await segment.params : {};
      const result = await handler({ body, user, ip, request, params });

      return result instanceof NextResponse ? result : NextResponse.json(result);
    } catch (error) {
      return handleError(error, context);
    }
  };
}

/** Writes an admin action to the audit trail (PRD §28 observability). */
export async function audit(
  actorUserId: string,
  action: string,
  target: { type: string; id: string },
  metadata?: Record<string, unknown>,
) {
  const db = createAdminClient();
  await db.from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: target.type,
    target_id: target.id,
    metadata: (metadata ?? null) as never,
  });
}
