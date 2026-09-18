"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { uploadProfilePhoto, UploadError } from "@/lib/services/upload";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { Alert } from "@/components/ui/Alert";

/**
 * Replace the profile photo (PRD §8.3).
 *
 * The old objects are hard-deleted server-side once the new ones are recorded,
 * so a previously shared URL stops working — which is what makes a public photo
 * bucket defensible.
 */
export function PhotoUploader({ userId, photoUrl, name }: {
  userId: string; photoUrl: string | null; name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    try {
      const { photoPath, photoThumbPath } = await uploadProfilePhoto(file, userId, setBusy);
      setBusy("Saving…");
      await apiPost("/api/profile/photo", { photoPath, photoThumbPath });
      router.refresh();
    } catch (e) {
      setError(
        e instanceof UploadError || e instanceof Error
          ? e.message
          : "Could not update your photo.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="relative mx-auto h-36 w-36">
        <div className="h-36 w-36 overflow-hidden rounded-full">
          <ProfilePhoto src={photoUrl} name={name} size="avatar" priority />
        </div>

        <label className="absolute bottom-0 right-0 grid h-11 w-11 cursor-pointer place-items-center rounded-full border-2 border-surface bg-primary text-white shadow-soft hover:bg-primary-hover">
          <Camera className="h-4 w-4" aria-hidden />
          <span className="sr-only">Change profile photo</span>
          <input
            type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pick(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {busy && <p className="mt-3 text-center text-xs text-muted" aria-live="polite">{busy}</p>}
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
    </div>
  );
}
