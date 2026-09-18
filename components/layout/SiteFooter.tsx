import Link from "next/link";
import type { ContactContent, FooterContent } from "@/lib/services/content";

/** Public footer (PRD §4.2). All copy comes from site_content. */
export function SiteFooter({ contact, footer }: { contact: ContactContent; footer: FooterContent }) {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-lg font-semibold text-ink">{contact.companyName}</p>
          <p className="prose-body mt-2 text-sm text-muted">{footer.tagline}</p>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
            <li><Link href="/register" className="hover:text-primary">Register</Link></li>
            <li><Link href="/login" className="hover:text-primary">Login</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted">Reach us</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {contact.phone && (
              <li><a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-primary">{contact.phone}</a></li>
            )}
            {contact.email && (
              <li><a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a></li>
            )}
            {contact.address && <li className="text-muted">{contact.address}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-line py-5">
        <p className="container-page text-xs text-muted">
          © {new Date().getFullYear()} {contact.companyName}. {footer.copyright}
        </p>
      </div>
    </footer>
  );
}
