import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { getSiteContent } from "@/lib/services/content";
import { getUnreadCount } from "@/lib/services/engagement";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppNav } from "@/components/layout/AppNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Shell for every signed-in page.
 *
 * The session is resolved once here and shared. Each page still enforces its
 * own access rules server-side — this layout decides what to RENDER, not what
 * is allowed.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const verified = user.registrationStatus === "VERIFIED";
  const [{ contact }, unread] = await Promise.all([getSiteContent(), getUnreadCount()]);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link
            href={verified ? "/dashboard" : "/status"}
            className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold text-ink"
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
              <Heart className="h-4 w-4 fill-current" />
            </span>
            <span className="hidden truncate sm:inline">{contact.companyName || "Matrimony"}</span>
          </Link>

          {/* Navigation appears only once it can actually be used (PRD §7.2). */}
          {verified && <AppNav />}

          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell initialCount={unread} userId={user.id} />
            <AccountMenu registrationId={user.registrationId} verified={verified} />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* Bottom tab bar on phones — the primary navigation on mobile (PRD §24). */}
      {verified && <AppNav variant="mobile" />}
    </div>
  );
}
