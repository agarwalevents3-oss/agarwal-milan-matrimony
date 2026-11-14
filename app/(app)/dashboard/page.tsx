import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor } from "@/lib/auth/routing";
import { decodeFilters, encodeFilters, RESULTS_PER_PAGE } from "@/lib/validation/filters";
import { searchProfiles } from "@/lib/services/profiles";
import { FilterPanel, AppliedFilters } from "@/components/filters/FilterPanel";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Discover", robots: { index: false } };

/**
 * Profile discovery (PRD §7.3, §9).
 *
 * Server-rendered from the URL's filters, so there is exactly one database
 * query per search — the one the DONE button caused by navigating here. Only
 * 20 rows ever cross the wire (PRD §9.4).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const user = await getSessionUser();
if (!user) redirect("/login");

// Admin accounts should use the admin dashboard, not member registration.
if (user.role === "admin") {
  redirect("/admin");
}

// Member access requires a verified registration.
if (user.registrationStatus !== "VERIFIED") {
  redirect(landingPathFor(user.registrationStatus));
}

  const filters = decodeFilters(await searchParams);
  const { profiles, total, page, totalPages } = await searchProfiles(filters, user.id);

  const hrefFor = (next: number) => {
    const query = encodeFilters({ ...filters, page: next });
    return query ? `/dashboard?${query}` : "/dashboard";
  };

  const firstResult = total === 0 ? 0 : (page - 1) * RESULTS_PER_PAGE + 1;
  const lastResult = Math.min(page * RESULTS_PER_PAGE, total);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <FilterPanel applied={filters} />

        <div className="min-w-0">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl">Discover</h1>
            <p className="mt-1.5 text-sm text-muted" aria-live="polite">
              {total === 0
                ? "No profiles match your filters"
                : `Showing ${firstResult}–${lastResult} of ${total} ${total === 1 ? "profile" : "profiles"}`}
            </p>
            <div className="mt-3">
              <AppliedFilters applied={filters} />
            </div>
          </header>

          {profiles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nothing matched"
              description="Try widening your filters — a broader age or location range usually helps."
              action={<ButtonLink href="/dashboard" variant="secondary">Clear all filters</ButtonLink>}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {profiles.map((profile, index) => (
                  <li key={profile.userId}>
                    {/* The first row is eager-loaded; it is the LCP element. */}
                    <ProfileCard profile={profile} priority={index < 3} />
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
