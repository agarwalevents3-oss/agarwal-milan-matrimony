import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartHandshake, Send } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor } from "@/lib/auth/routing";
import { getReceivedInterests, getSentInterests } from "@/lib/services/engagement";
import { Card, CardHeader } from "@/components/ui/Card";
import { InterestBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PersonRow } from "@/components/profile/PersonRow";
import { RespondToInterest } from "@/components/profile/RespondToInterest";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Interests", robots: { index: false } };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Interests received and sent (PRD §10). */
export default async function InterestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.registrationStatus !== "VERIFIED") redirect(landingPathFor(user.registrationStatus));

  const [received, sent] = await Promise.all([
    getReceivedInterests(user.id),
    getSentInterests(user.id),
  ]);

  const awaiting = received.filter((i) => i.status === "PENDING");
  const answered = received.filter((i) => i.status !== "PENDING");

  return (
    <div className="container-page max-w-4xl py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl">Interests</h1>
      <p className="mt-1.5 text-sm text-muted">
        Interest is mutual by design — you connect only when both sides accept.
      </p>

      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader
            title="Waiting for your reply"
            description={awaiting.length ? `${awaiting.length} awaiting` : undefined}
          />
          {awaiting.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {awaiting.map((interest) => (
                <li key={interest.id}>
                  <PersonRow
                    person={interest.person}
                    meta={<p className="text-xs text-muted">Sent {formatDate(interest.createdAt)}</p>}
                    action={
                      <RespondToInterest
                        interestId={interest.id}
                        senderName={interest.person.fullName}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {answered.length > 0 && (
          <Card>
            <CardHeader title="Already answered" />
            <ul className="divide-y divide-line">
              {answered.map((interest) => (
                <li key={interest.id}>
                  <PersonRow
                    person={interest.person}
                    meta={<InterestBadge status={interest.status} />}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Interests you have sent" />
          {sent.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={Send}
                title="You have not sent any interests yet"
                description="Browse profiles and let someone know you are interested."
                action={<ButtonLink href="/dashboard">Discover profiles</ButtonLink>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {sent.map((interest) => (
                <li key={interest.id}>
                  <PersonRow
                    person={interest.person}
                    meta={
                      <div className="flex flex-wrap items-center gap-2">
                        <InterestBadge status={interest.status} />
                        <span className="text-xs text-muted">Sent {formatDate(interest.createdAt)}</span>
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {received.length === 0 && sent.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={HeartHandshake}
            title="No interests yet"
            description="Once you start sending and receiving interests, they will appear here."
          />
        </div>
      )}
    </div>
  );
}
