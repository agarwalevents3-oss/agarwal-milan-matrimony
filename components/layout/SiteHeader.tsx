"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Heart } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Public header (PRD §4.1). Collapses to a disclosure menu on mobile, which is
 * the one piece of the marketing site that genuinely needs client JS.
 */
export function SiteHeader({ companyName }: { companyName: string }) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
            <Heart className="h-4 w-4 fill-current" />
          </span>
          <span className="truncate">{companyName || "Matrimony"}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-primary-soft hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="secondary" size="sm">Login</ButtonLink>
          <ButtonLink href="/register" size="sm">Register</ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-body md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-surface md:hidden">
          <nav aria-label="Main" className="container-page flex flex-col py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-body hover:bg-primary-soft hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <ButtonLink href="/login" variant="secondary" onClick={() => setOpen(false)}>Login</ButtonLink>
              <ButtonLink href="/register" onClick={() => setOpen(false)}>Register</ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
