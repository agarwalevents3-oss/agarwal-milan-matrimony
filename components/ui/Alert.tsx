import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { className: string; Icon: typeof Info }> = {
  info:    { className: "bg-primary-soft text-ink border-primary-border", Icon: Info },
  success: { className: "bg-success-soft text-ink border-success/25", Icon: CheckCircle2 },
  warning: { className: "bg-warning-soft text-ink border-warning/25", Icon: TriangleAlert },
  danger:  { className: "bg-danger-soft text-ink border-danger/25", Icon: AlertCircle },
};

const ICON_COLOUR: Record<Tone, string> = {
  info: "text-primary", success: "text-success", warning: "text-warning", danger: "text-danger",
};

export function Alert({
  tone = "info", title, children, className,
}: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div
      // Errors are announced immediately; the rest are polite.
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4 text-sm", toneClass, className)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLOUR[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-1", "leading-relaxed")}>{children}</div>}
      </div>
    </div>
  );
}
