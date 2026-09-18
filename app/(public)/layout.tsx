import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSiteContent } from "@/lib/services/content";

/**
 * Shell for the marketing pages.
 *
 * Content is fetched here once and cached by tag, so Home and Contact are
 * served from the CDN and an admin edit invalidates them immediately — no
 * redeploy, and effectively no serverless cost (PRD §13, §23).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader companyName={content.contact.companyName} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter contact={content.contact} footer={content.footer} />
    </div>
  );
}
