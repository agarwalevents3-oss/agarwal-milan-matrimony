import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Form primitives.
 *
 * Every control is wired to its label and, when invalid, to its error message
 * via aria-describedby and aria-invalid, so screen readers announce the problem
 * rather than users discovering it visually (PRD §28).
 */

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-primary" aria-hidden>*</span>}
        {!required && <span className="ml-1.5 text-xs font-normal text-muted">Optional</span>}
      </label>
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">{error}</p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors " +
  "placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 " +
  "disabled:bg-canvas disabled:text-muted";

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? "border-danger" : "border-line focus:border-primary", className)}
      {...props}
    />
  );
}

export function Select({ invalid, className, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "appearance-none bg-[length:1rem] pr-9", invalid ? "border-danger" : "border-line focus:border-primary", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      rows={4}
      className={cn(CONTROL, "resize-y", invalid ? "border-danger" : "border-line focus:border-primary", className)}
      {...props}
    />
  );
}
