import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { AccountMenu } from "@/components/layout/AccountMenu";

/**
 * Admin shell.
 *
 * The role is confirmed against the DATABASE here, not just the JWT claim the
 * proxy checked — a stale or tampered token gets nothing. Every /api/admin/*
 * route re-checks independently, and RLS enforces it a third time.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const db = createAdminClient();
  const { data } = await db.from("users").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-ink text-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Admin
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-full px-3 py-2 text-sm text-white/70 hover:text-white sm:block">
              View website
            </Link>
            <AccountMenu registrationId="Administrator" verified={false} />
          </div>
        </div>
      </header>

      <div className="container-page flex-1 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr] lg:items-start">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
