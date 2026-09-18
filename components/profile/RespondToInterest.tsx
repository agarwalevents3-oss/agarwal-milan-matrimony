"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, PartyPopper } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Accept or decline an interest (PRD §10.2–10.4).
 *
 * The mutual-match check happens inside one database transaction, so the
 * response here simply reports what the database decided rather than
 * second-guessing it.
 */
export function RespondToInterest({
  interestId, senderName, onDone,
}: {
  interestId: string; senderName: string; onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);

  async function respond(action: "ACCEPT" | "REJECT") {
    setPending(action);
    setError(null);
    try {
      const response = await apiPost<{ result: { matched: boolean; new?: boolean } }>(
        "/api/interest/respond", { interestId, action },
      );
      if (response.result?.matched && response.result?.new) {
        setMatched(true);
      }
      onDone?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your response.");
    } finally {
      setPending(null);
    }
  }

  if (matched) {
    return (
      <Alert tone="success" title="It's a match!">
        You and {senderName} have both accepted. We have let you both know.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-3">
        <Button onClick={() => respond("ACCEPT")} disabled={pending !== null} className="flex-1">
          <Check className="h-4 w-4" aria-hidden />
          {pending === "ACCEPT" ? "Accepting…" : "Accept"}
        </Button>
        <Button variant="secondary" onClick={() => respond("REJECT")} disabled={pending !== null} className="flex-1">
          <X className="h-4 w-4" aria-hidden />
          {pending === "REJECT" ? "Declining…" : "Decline"}
        </Button>
      </div>
    </div>
  );
}

/** Celebration banner shown on a profile the viewer has matched with (PRD §10.5). */
export function MatchBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-primary-border bg-primary-soft px-5 py-4">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
        <PartyPopper className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-base font-semibold text-ink">You matched with {name}</p>
        <p className="mt-0.5 text-sm text-muted">
          Our team will be in touch to help you take the next step.
        </p>
      </div>
    </div>
  );
}
