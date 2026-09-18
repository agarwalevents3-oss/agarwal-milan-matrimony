"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/dashboard", label: "Discover", icon: Search },
  { href: "/interests", label: "Interests", icon: Heart },
  { href: "/matches", label: "Matches", icon: Sparkles },
];

/**
 * Primary navigation for verified members.
 *
 * A row in the header on desktop; a bottom tab bar on phones, which is where
 * thumbs actually are.
 */
export function AppNav({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "mobile") {
    return (
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      >
        <ul className="flex">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  isActive(href) ? "text-primary" : "text-muted",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive(href) && "fill-primary/15")} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            isActive(href)
              ? "bg-primary-soft text-primary"
              : "text-body hover:bg-primary-soft hover:text-primary",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
