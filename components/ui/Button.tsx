import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:   "bg-primary text-white hover:bg-primary-hover shadow-sm",
  secondary: "bg-white text-primary border border-primary-border hover:bg-primary-soft",
  ghost:     "text-body hover:bg-primary-soft hover:text-primary",
  danger:    "bg-danger text-white hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  // 44px min height on the medium size: comfortable touch target on mobile.
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-full font-medium transition-colors " +
  "disabled:opacity-55 disabled:pointer-events-none whitespace-nowrap";

interface Shared { variant?: Variant; size?: Size; className?: string; children: ReactNode }

export function Button({
  variant = "primary", size = "md", className, children, ...props
}: Shared & ComponentProps<"button">) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary", size = "md", className, children, ...props
}: Shared & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}
