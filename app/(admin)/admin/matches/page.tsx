import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Heart } from "lucide-react";
import { listMatches } from "@/lib/services/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Matches", robots: { index: false } };

/** Match oversight (PRD §12.5). */
export default async function AdminMatchesPage() {
  const matches = await listMatches();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Matches</h1>
        <p className="mt-1.5 text-sm text-muted">
          Pairs who accepted each other&apos;s interest.
        </p>
      </div>

      {matches.length === 0 ? (
        <EmptyState icon={Sparkles} title="No matches yet"
          description="A match forms when interest is accepted on both sides." />
      ) : (
        <Card>
          <CardHeader title={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`} />
          <ul className="divide-y divide-line">
            {matches.map((match) => (
              <li key={match.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link href={`/admin/users/${match.a.userId}`}
                        className="text-sm font-medium text-ink hover:text-primary">
                    {match.a.name}
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                      {match.a.registrationId}
                    </span>
                  </Link>

                  <Heart className="h-4 w-4 shrink-0 fill-current text-primary" aria-hidden />

                  <Link href={`/admin/users/${match.b.userId}`}
                        className="text-sm font-medium text-ink hover:text-primary">
                    {match.b.name}
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                      {match.b.registrationId}
                    </span>
                  </Link>

                  <span className="ml-auto flex items-center gap-3">
                    <Badge tone={match.status === "ACTIVE" ? "success" : "neutral"}>
                      {match.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                    <time dateTime={match.createdAt} className="text-xs text-muted">
                      {new Date(match.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </time>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
