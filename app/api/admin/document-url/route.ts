import { z } from "zod";
import { route, audit } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl, BUCKETS } from "@/lib/services/storage";
import { notFound } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Hands the admin a short-lived link to a private document (PRD §12.2).
 *
 * The browser never receives a storage path — it asks for a document by its id,
 * and gets back a URL valid for five minutes. Every access is written to the
 * audit log, because looking at someone's Aadhaar should leave a trace.
 */
export const POST = route(
  {
    access: "admin",
    schema: z.object({ documentId: z.string().uuid() }),
    rateLimit: { limit: 200, windowSeconds: 3600 },
  },
  async ({ body, user }) => {
    const db = createAdminClient();

    const { data: document } = await db
      .from("documents")
      .select("id, user_id, document_type, storage_path")
      .eq("id", body.documentId)
      .maybeSingle();

    if (!document) throw notFound("That document does not exist.");

    const bucket =
      document.document_type === "AADHAAR" ? BUCKETS.aadhaar
      : document.document_type === "EDUCATIONAL_CERTIFICATE" ? BUCKETS.certificates
      : BUCKETS.photos;

    const url = await signedUrl(bucket, document.storage_path, 300);

    await audit(user!.id, "VIEW_DOCUMENT", { type: "document", id: document.id }, {
      documentType: document.document_type,
      subjectUserId: document.user_id,
    });

    return { ok: true, url, expiresInSeconds: 300 };
  },
);
