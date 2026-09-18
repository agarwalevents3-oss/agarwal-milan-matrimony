"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Ban, Trash2, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Field";
import type { Enums } from "@/types/database";

/**
 * Verify, reject, suspend and delete (PRD §12.2).
 *
 * Note what is NOT here: any way to edit the member's profile. The PRD is
 * explicit that admins cannot change user data, and the database has no UPDATE
 * policy for them on `profiles` — so this UI matches what is actually possible.
 *
 * The destructive actions require a typed confirmation, because suspending or
 * deleting a member destroys their uploaded files.
 */
export function MemberActions({ userId, status, paymentStatus, name }: {
  userId: string;
  status: Enums["registration_status"];
  paymentStatus: Enums["payment_status"];
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"suspend" | "delete" | null>(null);

  async function act(
    label: string, endpoint: string, payload: Record<string, unknown>, message: string,
  ) {
    setBusy(label);
    setError(null);
    setSuccess(null);
    try {
      await apiPost(endpoint, { userId, ...payload });
      setSuccess(message);
      setRejecting(false);
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  const canVerify = status === "PENDING_VERIFICATION" && paymentStatus === "SUCCESS";
  const awaitingButUnpaid = status === "PENDING_VERIFICATION" && paymentStatus !== "SUCCESS";
  const canReject = status === "PENDING_VERIFICATION";
  const isSuspended = status === "SUSPENDED";
  const isDeleted = status === "DELETED";

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {awaitingButUnpaid && (
        <Alert tone="warning" title="Cannot verify yet">
          This registration has not been paid for. Verification is blocked until
          the payment succeeds.
        </Alert>
      )}

      {isDeleted ? (
        <Alert tone="warning" title="This account has been deleted">
          Its uploaded files were destroyed. The record is kept for audit only.
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {canVerify && (
            <Button
              onClick={() => act("verify", "/api/admin/verify-user", {}, `${name} is now verified.`)}
              disabled={busy !== null}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {busy === "verify" ? "Verifying…" : "Verify"}
            </Button>
          )}

          {canReject && !rejecting && (
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              <XCircle className="h-4 w-4" aria-hidden />
              Reject
            </Button>
          )}

          {isSuspended && (
            <Button
              variant="secondary"
              onClick={() => act("restore", "/api/admin/suspend-user", { suspend: false }, `${name} has been restored.`)}
              disabled={busy !== null}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {busy === "restore" ? "Restoring…" : "Restore access"}
            </Button>
          )}

          {!isSuspended && status === "VERIFIED" && (
            <Button variant="secondary" onClick={() => setConfirming("suspend")} disabled={busy !== null}>
              <Ban className="h-4 w-4" aria-hidden />
              Suspend
            </Button>
          )}

          <Button variant="danger" onClick={() => setConfirming("delete")} disabled={busy !== null}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        </div>
      )}

      {rejecting && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <label htmlFor="reject-reason" className="text-sm font-medium text-ink">
            Why is this being rejected?
          </label>
          <p className="mt-1 text-xs text-muted">
            This is shown to the member, so keep it clear and courteous.
          </p>
          <div className="mt-3">
            <Textarea
              id="reject-reason" rows={3} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The Aadhaar image was not readable. Please contact us to re-submit."
            />
          </div>
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="danger"
              onClick={() => act("reject", "/api/admin/reject-user", { reason: reason.trim() || undefined }, `${name}'s registration was rejected.`)}
              disabled={busy !== null}
            >
              {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="rounded-xl border border-danger/25 bg-danger-soft p-4">
          <p className="text-sm font-semibold text-ink">
            {confirming === "suspend" ? `Suspend ${name}?` : `Delete ${name}'s account?`}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-body">
            {confirming === "suspend"
              ? "They will be signed out immediately, lose access to profiles, and disappear from everyone's search results. Their profile photo will be deleted."
              : "Every uploaded file — photo, Aadhaar and certificate — will be permanently destroyed. The registration record is kept for audit. This cannot be undone."}
          </p>
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="danger"
              onClick={() =>
                confirming === "suspend"
                  ? act("suspend", "/api/admin/suspend-user", { suspend: true }, `${name} has been suspended.`)
                  : act("delete", "/api/admin/delete-user", {}, `${name}'s account has been deleted.`)
              }
              disabled={busy !== null}
            >
              {busy ? "Working…" : confirming === "suspend" ? "Yes, suspend" : "Yes, delete permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
        Administrators cannot edit a member&apos;s profile details. If something is
        wrong, ask the member to correct it themselves.
      </p>
    </div>
  );
}
