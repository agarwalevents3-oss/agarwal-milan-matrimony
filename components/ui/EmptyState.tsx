import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Consistent "nothing here" treatment, so empty screens never look broken. */
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="prose-body mt-2 text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
