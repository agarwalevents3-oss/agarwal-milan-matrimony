import Link from "next/link";
import { MapPin, Briefcase } from "lucide-react";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { InterestButton } from "@/components/profile/InterestButton";
import { ButtonLink } from "@/components/ui/Button";
import { calculateAge, formatHeight } from "@/lib/utils/age";
import type { ProfileCardData } from "@/lib/services/profiles";

/**
 * A single result (PRD §8.1): photo, name, age, Know More, Interested.
 *
 * Nothing private is ever in scope here — the search query selects four
 * columns, and contact details are not among them.
 */
export function ProfileCard({ profile, priority }: { profile: ProfileCardData; priority?: boolean }) {
  const age = profile.dob ? calculateAge(profile.dob) : null;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-soft">
      <Link href={`/profiles/${profile.userId}`} className="block overflow-hidden" tabIndex={-1} aria-hidden>
        <ProfilePhoto src={profile.photoUrl} name={profile.fullName} priority={priority} />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold text-ink">
          <Link href={`/profiles/${profile.userId}`} className="hover:text-primary">
            {profile.fullName}
          </Link>
        </h3>

        <p className="mt-0.5 text-sm text-muted">
          {[age !== null ? `${age} years` : null, profile.heightCm ? formatHeight(profile.heightCm).split(" (")[0] : null]
            .filter(Boolean)
            .join(" · ") || "Details not shared"}
        </p>

        <dl className="mt-3 space-y-1.5 text-sm text-muted">
          {profile.occupation && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Occupation</dt>
              <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <dd className="truncate">{profile.occupation}</dd>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <dd className="truncate">{location}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-col gap-2 pt-1 sm:flex-row">
          <ButtonLink
            href={`/profiles/${profile.userId}`}
            variant="secondary" size="sm" className="flex-1"
          >
            Know more
          </ButtonLink>
          <InterestButton
            receiverUserId={profile.userId}
            initialStatus={profile.interestStatus}
            className="flex-1"
          />
        </div>
      </div>
    </article>
  );
}
