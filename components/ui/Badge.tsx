import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { Enums } from "@/types/database";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  primary: "bg-primary-soft text-primary border-primary-border",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger:  "bg-danger-soft text-danger border-danger/25",
};

export function Badge({ tone = "neutral", className, children }: {
  tone?: Tone; className?: string; children: ReactNode;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
      TONES[tone], className,
    )}>
      {children}
    </span>
  );
}

/**
 * Registration status, rendered consistently everywhere it appears. Keeping the
 * label and the colour in one place stops the admin list and the detail view
 * drifting apart.
 */
const REGISTRATION_TONE: Record<Enums["registration_status"], { tone: Tone; label: string }> = {
  DRAFT:                { tone: "neutral", label: "Draft" },
  SUBMITTED:            { tone: "neutral", label: "Submitted" },
  PAYMENT_PENDING:      { tone: "warning", label: "Payment pending" },
  PAYMENT_FAILED:       { tone: "danger",  label: "Payment failed" },
  PAYMENT_SUCCESS:      { tone: "primary", label: "Paid" },
  PENDING_VERIFICATION: { tone: "warning", label: "Awaiting review" },
  VERIFIED:             { tone: "success", label: "Verified" },
  REJECTED:             { tone: "danger",  label: "Rejected" },
  SUSPENDED:            { tone: "danger",  label: "Suspended" },
  DELETED:              { tone: "neutral", label: "Deleted" },
};

export function StatusBadge({ status }: { status: Enums["registration_status"] }) {
  const { tone, label } = REGISTRATION_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const PAYMENT_TONE: Record<Enums["payment_status"], { tone: Tone; label: string }> = {
  PENDING:   { tone: "neutral", label: "Pending" },
  INITIATED: { tone: "warning", label: "Initiated" },
  SUCCESS:   { tone: "success", label: "Paid" },
  FAILED:    { tone: "danger",  label: "Failed" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

export function PaymentBadge({ status }: { status: Enums["payment_status"] }) {
  const { tone, label } = PAYMENT_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const INTEREST_TONE: Record<Enums["interest_status"], { tone: Tone; label: string }> = {
  PENDING:  { tone: "warning", label: "Awaiting reply" },
  ACCEPTED: { tone: "success", label: "Accepted" },
  REJECTED: { tone: "neutral", label: "Declined" },
};

export function InterestBadge({ status }: { status: Enums["interest_status"] }) {
  const { tone, label } = INTEREST_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
}
