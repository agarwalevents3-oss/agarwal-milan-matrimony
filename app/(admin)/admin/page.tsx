import type { Metadata } from "next";
import Link from "next/link";
import {
  Users, Clock, ShieldCheck, CreditCard, Heart, Sparkles, IndianRupee, Ban,
} from "lucide-react";
import { getDashboardStats, getRecentActivity } from "@/lib/services/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** Admin dashboard (PRD §12.1). */
export default async function AdminDashboardPage() {
  const [stats, activity] = await Promise.all([getDashboardStats(), getRecentActivity()]);

  if (!stats) {
    return <Alert tone="danger" title="Could not load the dashboard">Please try again.</Alert>;
  }

  const tiles = [
    { label: "Members", value: stats.total_users, icon: Users, href: "/admin/registrations" },
    { label: "Awaiting review", value: stats.pending_verification, icon: Clock, href: "/admin/registrations?status=PENDING_VERIFICATION", highlight: stats.pending_verification > 0 },
    { label: "Verified", value: stats.verified, icon: ShieldCheck, href: "/admin/registrations?status=VERIFIED" },
    { label: "Payment pending", value: stats.pending_payments, icon: CreditCard, href: "/admin/registrations?status=PAYMENT_PENDING" },
    { label: "Interests", value: stats.interests, icon: Heart, href: "/admin/interests" },
    { label: "Matches", value: stats.matches, icon: Sparkles, href: "/admin/matches" },
    { label: "Suspended", value: stats.suspended, icon: Ban, href: "/admin/registrations?status=SUSPENDED" },
    { label: "Collected", value: `₹${Number(stats.revenue).toLocaleString("en-IN")}`, icon: IndianRupee },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Dashboard</h1>
        <p className="mt-1.5 text-sm text-muted">An overview of the platform.</p>
      </div>

      {stats.pending_verification > 0 && (
        <Alert tone="warning" title={`${stats.pending_verification} ${stats.pending_verification === 1 ? "profile is" : "profiles are"} waiting for review`}>
          <div className="mt-2">
            <ButtonLink href="/admin/registrations?status=PENDING_VERIFICATION" size="sm">
              Review now
            </ButtonLink>
          </div>
        </Alert>
      )}

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href, highlight }) => {
          const body = (
            <div className={`h-full rounded-card border bg-surface p-5 transition-colors ${
              highlight ? "border-primary-border bg-primary-soft" : "border-line"
            } ${href ? "hover:border-primary-border" : ""}`}>
              <div className="flex items-center gap-2 text-muted">
                <Icon className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
              </div>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
            </div>
          );
          return <li key={label}>{href ? <Link href={href} className="block h-full">{body}</Link> : body}</li>;
        })}
      </ul>

      <Card>
        <CardHeader title="Recent activity" />
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">Nothing has happened yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((item, index) => (
              <li key={`${item.kind}-${item.registration_id}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {item.full_name}{" "}
                    <span className="font-mono text-xs font-normal text-muted">{item.registration_id}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                </div>
                <time
                  dateTime={item.happened_at}
                  className="shrink-0 text-xs text-muted"
                >
                  {new Date(item.happened_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
