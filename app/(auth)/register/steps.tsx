"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const STEPS = [
  { key: "mobile",    label: "Mobile" },
  { key: "otp",       label: "Verify" },
  { key: "account",   label: "Account" },
  { key: "profile",   label: "Profile" },
  { key: "documents", label: "Documents" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

/** Progress indicator. Compact on phones, where registration mostly happens. */
export function StepIndicator({ current }: { current: StepKey }) {
  const index = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Registration progress">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li key={step.key} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  done || active ? "bg-primary" : "bg-primary-border/50",
                )}
              />
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  active ? "text-primary" : done ? "text-muted" : "text-muted/60",
                )}
              >
                {done ? <Check className="mr-1 inline h-3 w-3" aria-hidden /> : null}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted sm:hidden">
        Step {index + 1} of {STEPS.length} — {STEPS[index].label}
      </p>
    </nav>
  );
}
