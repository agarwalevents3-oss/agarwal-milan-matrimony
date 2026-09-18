import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { getSiteContent } from "@/lib/services/content";
import { AccountMenu } from "@/components/layout/AccountMenu";

/**
 * Shell for every signed-in page.
 *
 * The session is resolved once here. Each page still enforces its own access
 * rules server-side — this layout decides what to render, not what is allowed.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, { contact }] = await Promise.all([getSessionUser(), getSiteContent()]);

  if (!user) redirect("/login");

  const verified = user.registrationStatus === "VERIFIED";

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link
            href={verified ? "/dashboard" : "/status"}
            className="flex items-center gap-2 font-display text-lg font-semibold text-ink"
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
              <Heart className="h-4 w-4 fill-current" />
            </span>
            <span className="truncate">{contact.companyName || "Matrimony"}</span>
          </Link>

          {/* Navigation only appears once it can actually be used (PRD §7.2). */}
          {verified && (
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              <NavLink href="/dashboard">Discover</NavLink>
              <NavLink href="/interests">Interests</NavLink>
              <NavLink href="/matches">Matches</NavLink>
            </nav>
          )}

          <AccountMenu
            name={user.id}
            registrationId={user.registrationId}
            verified={verified}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-primary-soft hover:text-primary"
    >
      {children}
    </Link>
  );
}
