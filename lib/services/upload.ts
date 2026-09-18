"use client";

import imageCompression from "browser-image-compression";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side upload pipeline.
 *
 * Images are resized and re-encoded to WebP IN THE BROWSER before they are sent.
 * This is not a micro-optimisation — it is the single measure that makes the
 * project viable on Supabase's free tier. A typical phone photo is 3–5 MB; the
 * two renditions produced here total roughly 120 KB, which is the difference
 * between the 1 GB storage cap holding for a few hundred users and holding for
 * a few thousand.
 *
 * Producing two fixed sizes here also means we never pay for an image
 * transformation service: the grid uses the thumbnail, the profile page uses
 * the full rendition, and both are plain cacheable objects.
 */

export const RENDITIONS = {
  /** Profile cards, 20 to a page. */
  thumb: { maxWidthOrHeight: 240, maxSizeMB: 0.05 },
  /** Profile detail view. */
  full: { maxWidthOrHeight: 900, maxSizeMB: 0.25 },
} as const;

export const BUCKETS = {
  photos: "profile-photos",
  aadhaar: "aadhaar-documents",
  certificates: "educational-documents",
  siteAssets: "site-assets",
} as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class UploadError extends Error {}

function objectPath(userId: string, extension: string) {
  // The random segment is what makes a public profile-photo URL unguessable
  // from a user id — see docs/DECISIONS.md on the public photo bucket.
  return `${userId}/${nanoid(21)}.${extension}`;
}

async function toWebp(file: File, preset: { maxWidthOrHeight: number; maxSizeMB: number }) {
  return imageCompression(file, {
    maxWidthOrHeight: preset.maxWidthOrHeight,
    maxSizeMB: preset.maxSizeMB,
    fileType: "image/webp",
    useWebWorker: true,
    // Honours EXIF orientation, so portrait phone photos are not sideways.
    preserveExif: false,
  });
}

/** Uploads the profile photo as two WebP renditions. Returns both paths. */
export async function uploadProfilePhoto(
  file: File,
  userId: string,
  onProgress?: (label: string) => void,
): Promise<{ photoPath: string; photoThumbPath: string }> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new UploadError("Please choose a JPG, PNG or WebP image.");
  }

  onProgress?.("Optimising your photo…");
  const [full, thumb] = await Promise.all([
    toWebp(file, RENDITIONS.full),
    toWebp(file, RENDITIONS.thumb),
  ]);

  const photoPath = objectPath(userId, "webp");
  const photoThumbPath = objectPath(userId, "webp");

  onProgress?.("Uploading…");
  const supabase = createClient();
  const results = await Promise.all([
    supabase.storage.from(BUCKETS.photos).upload(photoPath, full, {
      contentType: "image/webp", cacheControl: "31536000", upsert: false,
    }),
    supabase.storage.from(BUCKETS.photos).upload(photoThumbPath, thumb, {
      contentType: "image/webp", cacheControl: "31536000", upsert: false,
    }),
  ]);

  for (const { error } of results) {
    if (error) throw new UploadError("We could not upload your photo. Please try again.");
  }

  return { photoPath, photoThumbPath };
}

/**
 * Uploads a private document (Aadhaar or a certificate).
 *
 * Images are compressed; PDFs are passed through untouched, because
 * re-encoding a PDF would risk making an identity document unreadable for the
 * admin who has to verify it.
 */
export async function uploadDocument(
  file: File,
  userId: string,
  bucket: (typeof BUCKETS)["aadhaar"] | (typeof BUCKETS)["certificates"],
  onProgress?: (label: string) => void,
): Promise<{ path: string }> {
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.includes(file.type)) {
    throw new UploadError("Please upload a JPG, PNG, WebP or PDF file.");
  }
  if (isPdf && file.size > 10 * 1024 * 1024) {
    throw new UploadError("That file is too large. The limit is 10 MB.");
  }

  let payload: Blob = file;
  let extension = "pdf";
  let contentType = "application/pdf";

  if (!isPdf) {
    onProgress?.("Optimising…");
    // Kept large enough that the ID text stays legible for the verifier.
    payload = await toWebp(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.6 });
    extension = "webp";
    contentType = "image/webp";
  }

  const path = objectPath(userId, extension);

  onProgress?.("Uploading…");
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, payload, {
    contentType, cacheControl: "3600", upsert: false,
  });
  if (error) throw new UploadError("We could not upload that file. Please try again.");

  return { path };
}

/** Public CDN URL for a profile photo. */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKETS.photos}/${path}`;
}

/**
 * Uploads a website image from the admin CMS (PRD §13).
 *
 * Compressed like everything else, but to a wider maximum — these are hero and
 * section images that span the page, not thumbnails. Only an admin can write to
 * this bucket; the storage policy enforces that, not this function.
 */
export async function uploadSiteImage(
  file: File,
  slot: string,
  onProgress?: (label: string) => void,
): Promise<{ path: string }> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new UploadError("Please choose a JPG, PNG or WebP image.");
  }

  onProgress?.("Optimising…");
  const optimised = await toWebp(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.4 });

  const path = `${slot}/${nanoid(21)}.webp`;

  onProgress?.("Uploading…");
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKETS.siteAssets).upload(path, optimised, {
    contentType: "image/webp", cacheControl: "31536000", upsert: false,
  });
  if (error) throw new UploadError("We could not upload that image. Please try again.");

  return { path };
}

/** Public CDN URL for a website image. */
export function siteAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKETS.siteAssets}/${path}`;
}
