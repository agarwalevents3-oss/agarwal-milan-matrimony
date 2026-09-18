import Link from "next/link";
import type { ReactNode } from "react";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import type { Person } from "@/lib/services/engagement";

/** Compact person row, shared by the interests and matches lists. */
export function PersonRow({ person, meta, action }: {
  person: Person; meta?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
      <Link href={`/profiles/${person.userId}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <div className="h-14 w-14 overflow-hidden rounded-full">
          <ProfilePhoto src={person.photoUrl} name={person.fullName} size="avatar" />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold text-ink">
          <Link href={`/profiles/${person.userId}`} className="hover:text-primary">
            {person.fullName}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted">
          {[person.age !== null ? `${person.age} years` : null, person.occupation]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        {meta && <div className="mt-2">{meta}</div>}
      </div>

      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}
