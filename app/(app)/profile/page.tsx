import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Lock, FileCheck2, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getMyProfile } from "@/lib/services/myProfile";
import { calculateAge } from "@/lib/utils/age";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PhotoUploader } from "./PhotoUploader";
import { EditProfileForm } from "./EditProfileForm";

export const metadata: Metadata = { title: "My profile", robots: { index: false } };

/**
 * The member's own profile (PRD §8.3).
 *
 * Identity and documents are shown but not editable. Aadhaar in particular is
 * displayed as a locked fact — there is no control to change it, and the
 * database would refuse even if there were.
 */
export default async function MyProfilePage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  const profile = await getMyProfile(user.id);
  if (!profile) notFound();

  const age = profile.dob ? calculateAge(profile.dob) : null;

  return (
    <div className="container-page max-w-4xl py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl">My profile</h1>
      <p className="mt-1.5 text-sm text-muted">
        Keep your details up to date — a fuller profile gets better matches.
      </p>

      <div className="mt-8 space-y-5">
        <Card className="p-6 sm:p-8">
          <PhotoUploader userId={user.id} photoUrl={profile.photoUrl} name={profile.fullName} />

          <div className="mt-6 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">{profile.fullName}</h2>
            <p className="mt-1 text-sm text-muted">
              {[age !== null ? `${age} years` : null, user.registrationId].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3 flex justify-center">
              <StatusBadge status={user.registrationStatus} />
            </div>
          </div>

          {/*
            Fixed identity. Shown so the member can see what we hold, with no
            control to change it — matching what the database enforces.
          */}
          <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
            {[
              { label: "Full name", value: profile.fullName },
              { label: "Gender", value: profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase() },
              { label: "Mobile", value: profile.mobile },
              { label: "Email", value: profile.email },
            ].map((item) => (
              <div key={item.label}>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Lock className="h-3 w-3" aria-hidden />
                  {item.label}
                </dt>
                <dd className="mt-1 break-words text-sm text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted">
            These cannot be changed after registration. Contact our team if
            something is wrong.
          </p>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-base font-semibold text-ink">Your documents</h2>
          <p className="mt-1 text-sm text-muted">
            Private. Visible only to our verification team — never to other members.
          </p>

          <ul className="mt-5 space-y-3">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-ink">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                Aadhaar
              </span>
              {profile.documents.hasAadhaar ? (
                <Badge tone="success"><Lock className="h-3 w-3" aria-hidden /> Locked</Badge>
              ) : (
                <Badge tone="warning">Not uploaded</Badge>
              )}
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-ink">
                <FileCheck2 className="h-4 w-4 text-muted" aria-hidden />
                Educational certificate
              </span>
              {profile.documents.hasCertificate
                ? <Badge tone="success">Uploaded</Badge>
                : <Badge>Not provided</Badge>}
            </li>
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Your Aadhaar is locked once your registration is submitted and can
            never be edited or replaced — not by you, and not by us.
          </p>
        </Card>

        <EditProfileForm profile={profile} />
      </div>
    </div>
  );
}
