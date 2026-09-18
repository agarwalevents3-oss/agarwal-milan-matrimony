import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { listInterests } from "@/lib/services/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { InterestBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Interests", robots: { index: false } };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Interest oversight (PRD §12.4). */
export default async function AdminInterestsPage() {
  const interests = await listInterests();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Interests</h1>
        <p className="mt-1.5 text-sm text-muted">
          The 100 most recent interests sent across the platform.
        </p>
      </div>

      {interests.length === 0 ? (
        <EmptyState icon={Heart} title="No interests yet"
          description="Interests will appear here as members start connecting." />
      ) : (
        <Card>
          <CardHeader title={`${interests.length} recent`} />
          <ul className="divide-y divide-line">
            {interests.map((interest) => (
              <li key={interest.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link href={`/admin/users/${interest.sender.userId}`}
                        className="text-sm font-medium text-ink hover:text-primary">
                    {interest.sender.name}
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                      {interest.sender.registrationId}
                    </span>
                  </Link>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />

                  <Link href={`/admin/users/${interest.receiver.userId}`}
                        className="text-sm font-medium text-ink hover:text-primary">
                    {interest.receiver.name}
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                      {interest.receiver.registrationId}
                    </span>
                  </Link>

                  <span className="ml-auto flex items-center gap-3">
                    <InterestBadge status={interest.status} />
                    <time dateTime={interest.createdAt} className="text-xs text-muted">
                      {formatDate(interest.createdAt)}
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
