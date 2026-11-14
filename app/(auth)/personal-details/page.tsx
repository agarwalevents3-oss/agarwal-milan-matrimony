import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor, needsPersonalDetails, PERSONAL_DETAILS_PATH } from "@/lib/auth/routing";
import { getMyProfile } from "@/lib/services/myProfile";
import { PersonalDetailsForm } from "./PersonalDetailsForm";
import type { ProfileFormValues } from "../register/ProfileStep";

export const metadata: Metadata = { title: "Your personal details", robots: { index: false } };

/**
 * Mandatory personal details after payment (Website Improvements §3).
 *
 * Reached only by a member whose payment has succeeded but whose mandatory
 * details are incomplete — in practice, someone who skipped the step before it
 * became mandatory. The member-area layout and the API guards send them here
 * and nowhere else until it is saved; closing the browser changes nothing,
 * because the next login lands here again.
 *
 * Payment is never re-requested: this page is only reachable after it has
 * succeeded, and saving touches profile rows only.
 */
export default async function PersonalDetailsPage() {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${PERSONAL_DETAILS_PATH}`);
  if (user.role === "admin") redirect("/admin");
  if (!needsPersonalDetails(user)) redirect(landingPathFor(user.registrationStatus));

  const profile = await getMyProfile(user.id);
  if (!profile) notFound();

  const text = (v: string | null) => v ?? "";
  const digits = (v: number | null) => (v === null ? "" : String(v));

  // Everything already saved is carried into the form, so completing it never
  // means retyping — and never blanks what is there.
  const initial: ProfileFormValues = {
    dob: text(profile.dob),
    placeOfBirth: text(profile.placeOfBirth),
    // Postgres returns HH:MM:SS; the form and its schema work in HH:MM.
    timeOfBirth: text(profile.timeOfBirth).slice(0, 5),
    heightCm: digits(profile.heightCm),
    maritalStatus: text(profile.maritalStatus),
    gotra: text(profile.gotra),
    subcaste: text(profile.subcaste),
    highestQualification: text(profile.highestQualification),
    occupation: text(profile.occupation),
    companyBusiness: text(profile.companyBusiness),
    annualIncomeInr: digits(profile.annualIncomeInr),
    line1: text(profile.address.line1),
    city: text(profile.address.city),
    state: text(profile.address.state),
    pincode: text(profile.address.pincode),
    fatherName: text(profile.family.fatherName),
    motherName: text(profile.family.motherName),
    native: text(profile.family.native),
    siblings: text(profile.family.siblings),
    ageMin: digits(profile.preferences.ageMin),
    ageMax: digits(profile.preferences.ageMax),
    education: text(profile.preferences.education),
    partnerOccupation: text(profile.preferences.occupation),
    partnerLocation: text(profile.preferences.location),
    otherExpectations: text(profile.preferences.otherExpectations),
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Registration {user.registrationId}
        </p>
        <div className="mt-5">
          <PersonalDetailsForm initial={initial} dobLocked={Boolean(profile.dob)} />
        </div>
      </div>
    </div>
  );
}
