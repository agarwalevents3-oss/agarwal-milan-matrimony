"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Check, Clock } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import type { Enums } from "@/types/database";

/**
 * Send interest (PRD §10.1).
 *
 * Optimistically flips to "Interest sent" and reverts if the server disagrees.
 * The duplicate guard is a unique constraint in the database, so a double-click
 * or two tabs cannot create two interests — the second simply gets a clear
 * message back.
 */
export function InterestButton({
  receiverUserId, initialStatus, size = "sm", className,
}: {
  receiverUserId: string;
  initialStatus: Enums["interest_status"] | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setPending(true);
    setError(null);
    const previous = status;
    setStatus("PENDING");

    try {
      await apiPost("/api/interest/send", { receiverUserId });
      router.refresh();
    } catch (e) {
      setStatus(previous);
      setError(e instanceof Error ? e.message : "Could not send your interest.");
    } finally {
      setPending(false);
    }
  }

  if (status === "ACCEPTED") {
    return (
      <Button variant="secondary" size={size} disabled className={className}>
        <Check className="h-4 w-4" aria-hidden />
        Accepted
      </Button>
    );
  }

  if (status === "PENDING") {
    return (
      <Button variant="secondary" size={size} disabled className={className}>
        <Clock className="h-4 w-4" aria-hidden />
        Interest sent
      </Button>
    );
  }

  if (status === "REJECTED") {
    return (
      <Button variant="ghost" size={size} disabled className={className}>
        Not accepted
      </Button>
    );
  }

  return (
    <div className={className}>
      <Button size={size} onClick={send} disabled={pending} className="w-full">
        <Heart className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Interested"}
      </Button>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
