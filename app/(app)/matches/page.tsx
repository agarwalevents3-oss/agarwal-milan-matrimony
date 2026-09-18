import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, Phone } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor } from "@/lib/auth/routing";
import { getMatches } from "@/lib/services/engagement";
import { getAdminContactNumber } from "@/lib/services/profiles";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PersonRow } from "@/components/profile/PersonRow";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Matches", robots: { index: false } };

/**
 * Mutual matches (PRD §10.5).
 *
 * Note what is deliberately absent: matching does NOT unlock personal contact
 * details. Both members still go through our team, which is exactly what the
 * PRD specifies.
 */
export default async function MatchesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.registrationStatus !== "VERIFIED") redirect(landingPathFor(user.registrationStatus));

  const [matches, adminContact] = await Promise.all([getMatches(user.id), getAdminContactNumber()]);

  return (
    <div className="container-page max-w-4xl py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl">Your matches</h1>
      <p className="mt-1.5 text-sm text-muted">
        People who accepted your interest, and whose interest you accepted too.
      </p>

      <div className="mt-8">
        {matches.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No matches yet"
            description="A match happens when interest is accepted on both sides. Keep exploring."
            action={<ButtonLink href="/dashboard">Discover profiles</ButtonLink>}
          />
        ) : (
          <>
            <Card>
              <CardHeader title={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`} />
              <ul className="divide-y divide-line">
                {matches.map((match) => (
                  <li key={match.id}>
                    <PersonRow
                      person={match.person}
                      meta={
                        <p className="text-xs text-muted">
                          Matched on{" "}
                          {new Date(match.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </p>
                      }
                      action={
                        <ButtonLink href={`/profiles/${match.person.userId}`} variant="secondary" size="sm">
                          View profile
                        </ButtonLink>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Card>

            {adminContact && (
              <div className="mt-5 flex items-start gap-3 rounded-card border border-primary-border bg-primary-soft px-5 py-4">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-sm leading-relaxed text-body">
                  Ready for the next step? Call our team on{" "}
                  <a href={`tel:${adminContact.replace(/\s/g, "")}`} className="font-semibold text-primary hover:underline">
                    {adminContact}
                  </a>{" "}
                  and we will arrange the introduction. Personal numbers are never
                  shared, even after a match.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
