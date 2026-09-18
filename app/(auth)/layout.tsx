import type { ReactNode } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getSiteContent } from "@/lib/services/content";

/** Focused shell for login and registration — no marketing nav to wander into. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { contact } = await getSiteContent();

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-primary-soft to-canvas">
      <header className="container-page flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-surface text-primary">
            <Heart className="h-4 w-4 fill-current" />
          </span>
          {contact.companyName || "Matrimony"}
        </Link>
      </header>
      <main className="container-page flex flex-1 items-start justify-center py-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}
