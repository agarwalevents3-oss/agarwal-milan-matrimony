import "server-only";

import { nanoid } from "nanoid";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest } from "@/lib/utils/errors";

/**
 * Storage helpers.
 *
 * Uploads go from the browser straight to Supabase Storage, which enforces the
 * per-bucket size and MIME limits declared in migration 0006. What this module
 * adds is the step that matters afterwards: reading the object's REAL size and
 * type back from the Storage API before any metadata row is written, so nothing
 * downstream ever trusts a client-supplied Content-Type (PRD §17, §22).
 */

export const BUCKETS = {
  photos: "profile-photos",
  aadhaar: "aadhaar-documents",
  certificates: "educational-documents",
  siteAssets: "site-assets",
} as const;

/** Slots the public website renders images into (PRD §13). */
export const IMAGE_SLOTS = {
  hero: "Hero image",
  couple: "Couple / lifestyle image",
} as const;

export type ImageSlot = keyof typeof IMAGE_SLOTS;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const ALLOWED: Record<BucketName, { mime: string[]; maxBytes: number }> = {
  "profile-photos":        { mime: ["image/webp", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  "aadhaar-documents":     { mime: ["image/webp", "image/jpeg", "image/png", "application/pdf"], maxBytes: 10 * 1024 * 1024 },
  "educational-documents": { mime: ["image/webp", "image/jpeg", "image/png", "application/pdf"], maxBytes: 10 * 1024 * 1024 },
  "site-assets":           { mime: ["image/webp", "image/jpeg", "image/png", "image/svg+xml"], maxBytes: 5 * 1024 * 1024 },
};

/**
 * Object paths are `{userId}/{nanoid(21)}.{ext}`.
 *
 * The user-id prefix is what the storage policies pin writes to. The random
 * segment is what makes a public profile-photo URL unguessable from a user id —
 * the product decision was a public photo bucket, and this is the part that
 * keeps it defensible.
 */
export function buildObjectPath(userId: string, extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase();
  return `${userId}/${nanoid(21)}.${ext}`;
}

export interface ObjectFacts {
  path: string;
  sizeBytes: number;
  mimeType: string;
}

/** Reads back what is actually stored, and rejects it if it breaks the rules. */
export async function verifyUploadedObject(
  bucket: BucketName,
  path: string,
  expectedOwnerId: string,
): Promise<ObjectFacts> {
  if (!path.startsWith(`${expectedOwnerId}/`)) {
    throw badRequest("That upload does not belong to your account.");
  }

  const db = createAdminClient();
  const folder = path.slice(0, path.lastIndexOf("/"));
  const filename = path.slice(path.lastIndexOf("/") + 1);

  const { data, error } = await db.storage.from(bucket).list(folder, { search: filename, limit: 1 });
  if (error) throw badRequest("Could not read the uploaded file. Please try again.");

  const object = data?.find((o) => o.name === filename);
  if (!object) throw badRequest("The upload was not found. Please try again.");

  const metadata = (object.metadata ?? {}) as { size?: number; mimetype?: string };
  const sizeBytes = metadata.size ?? 0;
  const mimeType = metadata.mimetype ?? "application/octet-stream";
  const rules = ALLOWED[bucket];

  if (sizeBytes <= 0) throw badRequest("The uploaded file appears to be empty.");
  if (sizeBytes > rules.maxBytes) {
    throw badRequest(`That file is too large. The limit is ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`);
  }
  if (!rules.mime.includes(mimeType)) {
    throw badRequest("That file type is not accepted.");
  }

  return { path, sizeBytes, mimeType };
}

/** Public CDN URL. Only ever called for buckets that are genuinely public. */
export function publicUrl(bucket: BucketName, path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Short-lived signed URL for private documents — admin document review only. */
export async function signedUrl(bucket: BucketName, path: string, expiresInSeconds = 300) {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw badRequest("Could not open that document.");
  return data.signedUrl;
}

/**
 * Hard-deletes objects. Called when a photo is replaced and when an account is
 * suspended or deleted — which is what stops a leaked public photo URL from
 * outliving the account it belonged to.
 */
export async function deleteObjects(bucket: BucketName, paths: (string | null | undefined)[]) {
  const real = paths.filter((p): p is string => Boolean(p));
  if (!real.length) return;
  const db = createAdminClient();
  const { error } = await db.storage.from(bucket).remove(real);
  if (error) console.error(`[storage] failed to delete from ${bucket}`, error);
}
