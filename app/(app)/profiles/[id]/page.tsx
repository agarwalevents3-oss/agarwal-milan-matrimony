import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor } from "@/lib/auth/routing";
import { getProfileDetail, getAdminContactNumber } from "@/lib/services/profiles";
import { calculateAge, formatHeight, formatIncome } from "@/lib/utils/age";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { Card } from "@/components/ui/Card";
import { DetailList, DetailSection } from "@/components/profile/DetailList";
import { InterestButton } from "@/components/profile/InterestButton";
import { RespondToInterest, MatchBanner } from "@/components/profile/RespondToInterest";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

const MARITAL_LABEL = {
  NEVER_MARRIED: "Never married", DIVORCED: "Divorced",
  WIDOWED: "Widowed", SEPARATED: "Separated",
} as const;

/**
 * "Know more" (PRD §8.2).
 *
 * Shows permitted profile information only. The member's own mobile number is
 * never fetched, let alone rendered — the page shows the configured admin
 * contact number instead. Aadhaar, certificates and payment records are not
 * reachable from any query on this page.
 */
export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.registrationStatus !== "VERIFIED") {
    redirect(landingPathFor(user.registrationStatus));
  }

  const { id } = await params;
  if (id === user.id) redirect("/profile");

  const [profile, adminContact] = await Promise.all([
    getProfileDetail(id, user.id),
    getAdminContactNumber(),
  ]);

  // RLS returns nothing for a profile the viewer may not see, which is the same
  // as one that does not exist — so this cannot be used to probe who is a member.
  if (!profile) notFound();

  const age = profile.dob ? calculateAge(profile.dob) : null;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <div className="container-page py-6 lg:py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to discover
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <ProfilePhoto src={profile.photoUrl} name={profile.fullName} size="detail" priority />
            <div className="p-5">
              <h1 className="font-display text-xl font-semibold text-ink">{profile.fullName}</h1>
              <p className="mt-1 text-sm text-muted">
                {[age !== null ? `${age} years` : null, location || null].filter(Boolean).join(" · ") || "—"}
              </p>

              <div className="mt-5">
                {profile.incomingInterestId ? (
                  <RespondToInterest
                    interestId={profile.incomingInterestId}
                    senderName={profile.fullName}
                  />
                ) : (
                  <InterestButton
                    receiverUserId={profile.userId}
                    initialStatus={profile.interestStatus}
                    size="md"
                    className="w-full"
                  />
                )}
              </div>
            </div>
          </Card>

          {/*
            PRD §8.2: the profile owner's personal number is NEVER shown. The
            office number is displayed in its place, and is the only contact
            route between members.
          */}
          {adminContact && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                To take this forward
              </h2>
              <a
                href={`tel:${adminContact.replace(/\s/g, "")}`}
                className="mt-2 block font-display text-lg font-semibold text-primary hover:underline"
              >
                {adminContact}
              </a>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Members&apos; personal numbers are never shared. Call our team and we
                will help arrange the introduction.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {profile.isMatched && <MatchBanner name={profile.fullName} />}

          <Card>
            <div className="flex items-center gap-2 px-5 py-4 sm:px-6">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
              <p className="text-sm font-medium text-ink">Verified by our team</p>
            </div>

            <DetailSection title="Personal">
              <DetailList
                items={[
                  { label: "Age", value: age !== null ? `${age} years` : null },
                  { label: "Height", value: profile.heightCm ? formatHeight(profile.heightCm) : null },
                  { label: "Marital status", value: profile.maritalStatus ? MARITAL_LABEL[profile.maritalStatus] : null },
                  { label: "Place of birth", value: profile.placeOfBirth },
                  { label: "Gotra", value: profile.gotra },
                  { label: "Subcaste", value: profile.subcaste },
                  { label: "Location", value: location },
                ]}
              />
            </DetailSection>

            <DetailSection title="Education & career">
              <DetailList
                items={[
                  { label: "Qualification", value: profile.highestQualification },
                  { label: "Occupation", value: profile.occupation },
                  { label: "Company or business", value: profile.companyBusiness },
                  { label: "Annual income", value: profile.annualIncomeInr ? formatIncome(profile.annualIncomeInr) : null },
                ]}
              />
            </DetailSection>

            {profile.preferences && (
              <DetailSection title="What they are looking for">
                <DetailList
                  items={[
                    {
                      label: "Age",
                      value: profile.preferences.ageMin || profile.preferences.ageMax
                        ? `${profile.preferences.ageMin ?? "any"} – ${profile.preferences.ageMax ?? "any"} years`
                        : null,
                    },
                    {
                      label: "Height",
                      value: profile.preferences.heightMinCm || profile.preferences.heightMaxCm
                        ? `${profile.preferences.heightMinCm ?? "any"} – ${profile.preferences.heightMaxCm ?? "any"} cm`
                        : null,
                    },
                    { label: "Education", value: profile.preferences.education },
                    { label: "Occupation", value: profile.preferences.occupation },
                    { label: "Location", value: profile.preferences.location },
                    { label: "Other expectations", value: profile.preferences.otherExpectations },
                  ]}
                />
              </DetailSection>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
