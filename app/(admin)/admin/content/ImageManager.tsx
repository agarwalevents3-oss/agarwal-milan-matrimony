"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { uploadSiteImage, UploadError } from "@/lib/services/upload";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export interface SiteImage {
  slot: string;
  url: string | null;
  altText: string;
}

/**
 * Website imagery (PRD §13).
 *
 * Files go from the browser straight into the `site-assets` bucket — whose
 * storage policy already restricts writes to admins — and the server then
 * records the path and destroys whatever the slot held before.
 */
export function ImageManager({ slots, images }: {
  slots: Record<string, string>;
  images: SiteImage[];
}) {
  const bySlot = new Map(images.map((image) => [image.slot, image]));

  return (
    <Card>
      <CardHeader
        title="Website images"
        description="Replace the placeholder panels on the home page"
      />
      <div className="divide-y divide-line">
        {Object.entries(slots).map(([slot, label]) => (
          <ImageSlot key={slot} slot={slot} label={label} current={bySlot.get(slot) ?? null} />
        ))}
      </div>
    </Card>
  );
}

function ImageSlot({ slot, label, current }: {
  slot: string; label: string; current: SiteImage | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [altText, setAltText] = useState(current?.altText ?? "");

  async function upload(file: File) {
    setError(null);
    try {
      const { path } = await uploadSiteImage(file, slot, setBusy);
      setBusy("Saving…");
      await apiPost("/api/admin/images", {
        action: "set",
        slot,
        storagePath: path,
        altText: altText.trim() || label,
      });
      router.refresh();
    } catch (e) {
      setError(
        e instanceof UploadError || e instanceof Error ? e.message : "Could not upload that image.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("Removing…");
    setError(null);
    try {
      await apiPost("/api/admin/images", { action: "remove", slot });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that image.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-muted">
            Landscape works best. Images are resized and converted automatically.
          </p>
        </div>

        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-primary-border bg-surface px-4 text-sm font-medium text-primary hover:bg-primary-soft">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {busy ?? (current?.url ? "Replace" : "Upload")}
            <input
              type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
          </label>

          {current?.url && (
            <Button variant="ghost" size="sm" onClick={remove} disabled={Boolean(busy)}
                    className="text-danger hover:bg-danger-soft">
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">Remove {label}</span>
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {current?.url && (
        <div className="overflow-hidden rounded-xl border border-line bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.altText || label}
               className="aspect-4/3 w-full object-cover" />
        </div>
      )}

      <Field label="Alt text" hint="Describes the image for screen readers and when it fails to load.">
        {({ id }) => (
          <Input id={id} value={altText} onChange={(e) => setAltText(e.target.value)}
                 placeholder={label} />
        )}
      </Field>
    </div>
  );
}
