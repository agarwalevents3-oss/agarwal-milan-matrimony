import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { listRegistrations, ADMIN_PAGE_SIZE } from "@/lib/services/admin";
import { Card } from "@/components/ui/Card";
import { StatusBadge, PaymentBadge } from "@/components/ui/Badge";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "./SearchBar";

export const metadata: Metadata = { title: "Registrations", robots: { index: false } };

/**
 * The registration queue (PRD §12.2).
 *
 * Searching, filtering and paging all happen in the database, so the admin can
 * work through thousands of records without the browser ever holding more than
 * twenty.
 */
export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const search = single("search");
  const status = single("status");
  const page = Math.max(1, Number(single("page") ?? 1) || 1);

  const { rows, total, totalPages } = await listRegistrations({ search, status, page });

  const hrefFor = (next: number) => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const q = query.toString();
    return q ? `/admin/registrations?${q}` : "/admin/registrations";
  };

  const first = total === 0 ? 0 : (page - 1) * ADMIN_PAGE_SIZE + 1;
  const last = Math.min(page * ADMIN_PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Registrations</h1>
        <p className="mt-1.5 text-sm text-muted" aria-live="polite">
          {total === 0 ? "No registrations found" : `Showing ${first}–${last} of ${total}`}
        </p>
      </div>

      <Suspense fallback={<div className="h-11" />}>
        <SearchBar />
      </Suspense>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description="No registration matches this search."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            {/* A table on desktop; the same data as cards below `md` (PRD §24). */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-canvas">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <th scope="col" className="px-5 py-3">Member</th>
                    <th scope="col" className="px-5 py-3">Registration</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Payment</th>
                    <th scope="col" className="px-5 py-3">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.userId} className="hover:bg-primary-soft/40">
                      <td className="px-5 py-3">
                        <Link href={`/admin/users/${row.userId}`} className="flex items-center gap-3">
                          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full">
                            <ProfilePhoto src={row.photoUrl} name={row.fullName} size="avatar" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{row.fullName}</span>
                            <span className="block truncate text-xs text-muted">{row.mobile}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{row.registrationId}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3"><PaymentBadge status={row.paymentStatus} /></td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {new Date(row.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((row) => (
                <li key={row.userId}>
                  <Link href={`/admin/users/${row.userId}`} className="flex gap-3 px-5 py-4 hover:bg-primary-soft/40">
                    <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full">
                      <ProfilePhoto src={row.photoUrl} name={row.fullName} size="avatar" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{row.fullName}</span>
                      <span className="block truncate font-mono text-xs text-muted">{row.registrationId}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={row.status} />
                        <PaymentBadge status={row.paymentStatus} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
