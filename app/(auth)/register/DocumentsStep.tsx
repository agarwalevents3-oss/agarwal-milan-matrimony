"use client";

import { useState } from "react";
import { Upload, FileCheck2, Lock, X } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { uploadProfilePhoto, uploadDocument, BUCKETS, UploadError } from "@/lib/services/upload";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** The exact wording stored alongside the consent record. Keep in step with the API. */
const CONSENT_TEXT =
  "I confirm this Aadhaar document belongs to me and I consent to it being stored " +
  "securely and used solely to verify my identity for this matrimonial service. " +
  "I understand it will never be shown to other members.";

interface Uploaded { label: string; path: string; thumbPath?: string }

function FilePicker({
  label, hint, accept, required, value, busy, onPick, onClear,
}: {
  label: string; hint: string; accept: string; required?: boolean;
  value: Uploaded | null; busy: string | null;
  onPick: (file: File) => void; onClear: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {label}
            {required
              ? <span className="ml-0.5 text-primary" aria-hidden>*</span>
              : <span className="ml-1.5 text-xs font-normal text-muted">Optional</span>}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
        </div>
        {value && (
          <button
            type="button" onClick={onClear}
            className="shrink-0 rounded-full p-1.5 text-muted hover:bg-primary-soft hover:text-primary"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4">
        {value ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
            Uploaded
          </p>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary-border bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-primary-soft">
            <Upload className="h-4 w-4" aria-hidden />
            {busy ?? "Choose file"}
            <input
              type="file" accept={accept} className="sr-only" disabled={Boolean(busy)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Step 5 — documents and consent (PRD §5.2, §18.1).
 *
 * Files go from the browser straight to Supabase Storage; nothing passes
 * through a serverless function. Images are compressed to WebP first, which is
 * what keeps storage inside the free tier.
 */
export function DocumentsStep({ userId, onSubmitted }: { userId: string; onSubmitted: () => void }) {
  const [photo, setPhoto] = useState<Uploaded | null>(null);
  const [aadhaar, setAadhaar] = useState<Uploaded | null>(null);
  const [certificate, setCertificate] = useState<Uploaded | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function describeError(error: unknown, fallback: string) {
    return error instanceof UploadError || error instanceof Error ? error.message : fallback;
  }

  async function pickPhoto(file: File) {
    setFormError(null);
    try {
      const result = await uploadProfilePhoto(file, userId, (label) =>
        setBusy((b) => ({ ...b, photo: label })));
      setPhoto({ label: file.name, path: result.photoPath, thumbPath: result.photoThumbPath });
    } catch (error) {
      setFormError(describeError(error, "Could not upload your photo."));
    } finally {
      setBusy((b) => ({ ...b, photo: null }));
    }
  }

  async function pickDocument(
    file: File,
    key: "aadhaar" | "certificate",
    bucket: typeof BUCKETS.aadhaar | typeof BUCKETS.certificates,
    set: (u: Uploaded) => void,
  ) {
    setFormError(null);
    try {
      const { path } = await uploadDocument(file, userId, bucket, (label) =>
        setBusy((b) => ({ ...b, [key]: label })));
      set({ label: file.name, path });
    } catch (error) {
      setFormError(describeError(error, "Could not upload that file."));
    } finally {
      setBusy((b) => ({ ...b, [key]: null }));
    }
  }

  async function submit() {
    setFormError(null);

    if (!photo) return setFormError("A profile photo is required.");
    if (!aadhaar) return setFormError("An Aadhaar document is required.");
    if (!consent) return setFormError("Please accept the Aadhaar consent to continue.");

    setSubmitting(true);
    try {
      await apiPost("/api/register/submit", {
        photoPath: photo.path,
        photoThumbPath: photo.thumbPath,
        aadhaarPath: aadhaar.path,
        aadhaarConsent: true,
        educationalCertificatePath: certificate?.path,
      });
      onSubmitted();
    } catch (error) {
      setFormError(describeError(error, "Could not submit your registration."));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Documents</h1>
        <p className="mt-2 text-sm text-muted">
          Your photo appears on your profile. Your documents are private and seen
          only by our verification team.
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <FilePicker
        label="Profile photo" required
        hint="A clear, recent photo of your face. Shown to other members."
        accept="image/jpeg,image/png,image/webp"
        value={photo} busy={busy.photo ?? null}
        onPick={pickPhoto} onClear={() => setPhoto(null)}
      />

      <FilePicker
        label="Aadhaar" required
        hint="Upload a masked Aadhaar if you have one — only the last 4 digits need to be visible. JPG, PNG or PDF."
        accept="image/jpeg,image/png,image/webp,application/pdf"
        value={aadhaar} busy={busy.aadhaar ?? null}
        onPick={(f) => pickDocument(f, "aadhaar", BUCKETS.aadhaar, setAadhaar)}
        onClear={() => setAadhaar(null)}
      />

      <FilePicker
        label="Educational certificate"
        hint="Helps us verify your qualification faster."
        accept="image/jpeg,image/png,image/webp,application/pdf"
        value={certificate} busy={busy.certificate ?? null}
        onPick={(f) => pickDocument(f, "certificate", BUCKETS.certificates, setCertificate)}
        onClear={() => setCertificate(null)}
      />

      <div className="rounded-card border border-primary-border bg-primary-soft p-5">
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox" checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span className="leading-relaxed text-body">{CONSENT_TEXT}</span>
        </label>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3 w-3" aria-hidden />
          Once submitted, your Aadhaar is locked and can never be edited or replaced.
        </p>
      </div>

      <Button type="button" size="lg" onClick={submit} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit registration"}
      </Button>
    </div>
  );
}
