"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Pagination over a database-level LIMIT/OFFSET (PRD §9.4).
 *
 * Links rather than buttons: each page is a real URL, so it is shareable and
 * the back button behaves. Page numbers are windowed so the control stays one
 * line on a phone even at page 300.
 */
export function Pagination({ page, totalPages, hrefFor }: {
  page: number; totalPages: number; hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const window = 1;
  const pages: (number | "gap")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const near = Math.abs(i - page) <= window;
    if (i === 1 || i === totalPages || near) pages.push(i);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  const arrow = "grid h-10 w-10 place-items-center rounded-full border border-line text-body hover:bg-primary-soft hover:text-primary";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={arrow} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden><ChevronLeft className="h-4 w-4" /></span>
      )}

      {pages.map((entry, i) =>
        entry === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>…</span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-medium",
              entry === page
                ? "bg-primary text-white"
                : "border border-line text-body hover:bg-primary-soft hover:text-primary",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={arrow} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden><ChevronRight className="h-4 w-4" /></span>
      )}
    </nav>
  );
}
