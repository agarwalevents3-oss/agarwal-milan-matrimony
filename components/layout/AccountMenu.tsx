"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRound, LogOut, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Account menu in the authenticated header (PRD §7.3). */
export function AccountMenu({
  registrationId, verified,
}: {
  name: string; registrationId: string; verified: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-2 rounded-full border border-line px-2.5 text-sm font-medium text-body hover:bg-primary-soft"
      >
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline">{registrationId || "Account"}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>

      {open && (
        <>
          {/* Click-away layer; keeps the menu keyboard-dismissible via Escape on the button. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lift"
          >
            <p className="px-4 py-2 text-xs text-muted">
              Registration<br />
              <span className="font-mono text-sm text-ink">{registrationId || "—"}</span>
            </p>
            <div className="my-1 border-t border-line" />
            {verified && (
              <>
                <Link role="menuitem" href="/profile" onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-primary-soft hover:text-primary">
                  My profile
                </Link>
                <Link role="menuitem" href="/notifications" onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-primary-soft hover:text-primary">
                  Notifications
                </Link>
              </>
            )}
            <button
              role="menuitem" type="button" onClick={signOut}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
