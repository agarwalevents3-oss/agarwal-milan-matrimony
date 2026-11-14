import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronRight, Mail, Phone, ReceiptText, ScrollText, ShieldCheck } from "lucide-react";
import type { ContactContent, FooterContent } from "@/lib/services/content";
import {
  BRAND_NAME, CONTACT_EMAIL_PLACEHOLDER, CONTACT_NUMBER_PLACEHOLDER,
  confirmedEmail, confirmedPhone, telHref,
} from "@/lib/utils/contact";

/**
 * Public footer (PRD §4.2, Website Improvements §2).
 *
 * Four groups — brand, quick links, legal, contact — on one column on phones,
 * two on tablets and four on desktop. The legal pages get the most visual
 * weight. The tagline and copyright wording stay editable from /admin/content;
 * the contact number and email appear only once the admin has entered real
 * ones, and otherwise show a clearly marked placeholder rather than the seeded
 * stand-ins.
 */

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms & Conditions", Icon: ScrollText },
  { href: "/privacy-policy", label: "Privacy Policy", Icon: ShieldCheck },
  { href: "/refund-policy", label: "Refund & Cancellation Policy", Icon: ReceiptText },
];

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-primary">
      {children}
    </h2>
  );
}

export function SiteFooter({ contact, footer }: { contact: ContactContent; footer: FooterContent }) {
  const phone = confirmedPhone(contact.phone);
  const email = confirmedEmail(contact.email);

  return (
    <footer className="mt-24 border-t border-[#EAD9DE] bg-[#FFF7F8]">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1.1fr_1.15fr] lg:gap-12">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="group inline-flex items-center gap-3" aria-label={`${BRAND_NAME} — home`}>
            <Image
              src="/agarwal-milan-logo.png"
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="font-display text-xl font-semibold leading-tight text-ink">{BRAND_NAME}</span>
          </Link>
          {footer.tagline && (
            <p className="prose-body mt-4 max-w-xs text-sm leading-6 text-muted">{footer.tagline}</p>
          )}
        </div>

        {/* Quick links */}
        <nav aria-label="Quick links">
          <Heading>Quick Links</Heading>
          <ul className="mt-4 space-y-2.5 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-center gap-1.5 text-body transition-colors hover:text-primary"
                >
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 text-primary/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Legal — given the strongest emphasis */}
        <nav aria-label="Legal">
          <Heading>Legal</Heading>
          <ul className="mt-4 space-y-2.5">
            {LEGAL_LINKS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-[#F0E1E5] bg-white px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary-border hover:bg-primary-soft hover:text-primary hover:shadow"
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <Heading>Contact</Heading>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                <Phone className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs text-muted">Official contact number</span>
                {phone ? (
                  <a href={telHref(phone)} className="font-medium text-ink transition-colors hover:text-primary">{phone}</a>
                ) : (
                  <span className="font-medium text-ink">{CONTACT_NUMBER_PLACEHOLDER}</span>
                )}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted">Official email</span>
                {email ? (
                  <a href={`mailto:${email}`} className="break-all font-medium text-ink transition-colors hover:text-primary">{email}</a>
                ) : (
                  <span className="font-medium text-ink">{CONTACT_EMAIL_PLACEHOLDER}</span>
                )}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#EAD9DE]">
        <p className="container-page py-5 text-center text-xs text-muted sm:text-left">
          Copyright © {new Date().getFullYear()} {BRAND_NAME}. {footer.copyright || "All Rights Reserved."}
        </p>
      </div>
    </footer>
  );
}
