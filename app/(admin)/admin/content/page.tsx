import type { Metadata } from "next";
import { getSiteContent, getSiteImages } from "@/lib/services/content";
import { IMAGE_SLOTS, publicUrl, BUCKETS } from "@/lib/services/storage";
import { ContentEditor } from "./ContentEditor";
import { ImageManager, type SiteImage } from "./ImageManager";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Website content", robots: { index: false } };

/** CMS for the public site (PRD §13). */
export default async function AdminContentPage() {
  const [content, imageRows] = await Promise.all([getSiteContent(), getSiteImages()]);

  const images: SiteImage[] = imageRows.map((row) => ({
    slot: row.slot,
    url: publicUrl(BUCKETS.siteAssets, row.storage_path),
    altText: row.alt_text,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Website content</h1>
        <p className="mt-1.5 text-sm text-muted">
          Edit the public website. Changes go live immediately — no deployment needed.
        </p>
      </div>

      <Alert tone="info">
        Each section saves on its own. Empty optional sections are hidden from
        the website rather than shown blank.
      </Alert>

      <ImageManager slots={IMAGE_SLOTS} images={images} />

      <ContentEditor content={content} />
    </div>
  );
}
