"use client";

import { useState } from "react";
import { FileText, ExternalLink, Lock } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

const LABELS = {
  AADHAAR: "Aadhaar",
  EDUCATIONAL_CERTIFICATE: "Educational certificate",
  PROFILE_PHOTO: "Profile photo",
} as const;

interface DocumentInfo {
  id: string;
  type: keyof typeof LABELS;
  uploadedAt: string;
  consentText: string | null;
  consentTimestamp: string | null;
  sizeBytes: number;
}

/**
 * Private document access for the admin (PRD §12.2, §17).
 *
 * The page never holds a storage path. It asks the server for a link by
 * document id, gets one valid for five minutes, and opens it. Every request is
 * written to the audit log — looking at someone's Aadhaar should leave a trace.
 */
export function DocumentViewer({ documents }: { documents: DocumentInfo[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const privateDocs = documents.filter((d) => d.type !== "PROFILE_PHOTO");

  async function open(documentId: string) {
    setOpening(documentId);
    setError(null);
    try {
      const { url } = await apiPost<{ url: string }>("/api/admin/document-url", { documentId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that document.");
    } finally {
      setOpening(null);
    }
  }

  if (!privateDocs.length) {
    return <p className="text-sm text-muted">No documents were uploaded.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {privateDocs.map((doc) => (
        <div key={doc.id} className="rounded-xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-medium text-ink">{LABELS[doc.type]}</p>
                <p className="text-xs text-muted">
                  {(doc.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                  {new Date(doc.uploadedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <Button
              variant="secondary" size="sm"
              onClick={() => open(doc.id)}
              disabled={opening === doc.id}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {opening === doc.id ? "Opening…" : "View"}
            </Button>
          </div>

          {doc.type === "AADHAAR" && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success"><Lock className="h-3 w-3" aria-hidden /> Locked</Badge>
                {doc.consentTimestamp && (
                  <span className="text-xs text-muted">
                    Consent given{" "}
                    {new Date(doc.consentTimestamp).toLocaleString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {doc.consentText && (
                <p className="mt-2 text-xs italic leading-relaxed text-muted">&quot;{doc.consentText}&quot;</p>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="text-xs leading-relaxed text-muted">
        Links expire after five minutes. Every document you open is recorded in
        the audit log.
      </p>
    </div>
  );
}
