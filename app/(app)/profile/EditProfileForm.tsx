"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiPost } from "@/lib/api/client";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { MyProfile } from "@/lib/services/myProfile";

/**
 * Edit the optional parts of a profile (PRD §8.3).
 *
 * Name, gender and Aadhaar are absent by design, and date of birth is shown
 * read-only once set. All three are also locked by a database trigger, so this
 * form is the polite first line rather than the only defence.
 */

interface FormValues {
  dob: string; placeOfBirth: string; timeOfBirth: string; heightCm: string;
  maritalStatus: string; gotra: string; subcaste: string;
  highestQualification: string; occupation: string; companyBusiness: string; annualIncomeInr: string;
  line1: string; city: string; state: string; pincode: string;
  fatherName: string; motherName: string; native: string; siblings: string;
  ageMin: string; ageMax: string; education: string; partnerOccupation: string;
  partnerLocation: string; otherExpectations: string;
}

const str = (v: string) => (v.trim() === "" ? undefined : v.trim());
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const text = (v: string | null) => v ?? "";
const digits = (v: number | null) => (v === null ? "" : String(v));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function EditProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting, isDirty } } = useForm<FormValues>({
    defaultValues: {
      dob: text(profile.dob), placeOfBirth: text(profile.placeOfBirth),
      timeOfBirth: text(profile.timeOfBirth), heightCm: digits(profile.heightCm),
      maritalStatus: text(profile.maritalStatus), gotra: text(profile.gotra),
      subcaste: text(profile.subcaste),
      highestQualification: text(profile.highestQualification),
      occupation: text(profile.occupation), companyBusiness: text(profile.companyBusiness),
      annualIncomeInr: digits(profile.annualIncomeInr),
      line1: text(profile.address.line1), city: text(profile.address.city),
      state: text(profile.address.state), pincode: text(profile.address.pincode),
      fatherName: text(profile.family.fatherName), motherName: text(profile.family.motherName),
      native: text(profile.family.native), siblings: text(profile.family.siblings),
      ageMin: digits(profile.preferences.ageMin), ageMax: digits(profile.preferences.ageMax),
      education: text(profile.preferences.education),
      partnerOccupation: text(profile.preferences.occupation),
      partnerLocation: text(profile.preferences.location),
      otherExpectations: text(profile.preferences.otherExpectations),
    },
  });

  const dobLocked = Boolean(profile.dob);

  async function save(values: FormValues) {
    setError(null);
    setSaved(false);
    try {
      await apiPost("/api/profile/update", {
        // dob is sent only when it has never been set; the database refuses
        // any later change regardless.
        ...(dobLocked ? {} : { dob: str(values.dob) }),
        placeOfBirth: str(values.placeOfBirth), timeOfBirth: str(values.timeOfBirth),
        heightCm: num(values.heightCm), maritalStatus: str(values.maritalStatus),
        gotra: str(values.gotra), subcaste: str(values.subcaste),
        highestQualification: str(values.highestQualification),
        occupation: str(values.occupation), companyBusiness: str(values.companyBusiness),
        annualIncomeInr: num(values.annualIncomeInr),
        address: {
          line1: str(values.line1), city: str(values.city),
          state: str(values.state), pincode: str(values.pincode),
        },
        family: {
          fatherName: str(values.fatherName), motherName: str(values.motherName),
          native: str(values.native), siblings: str(values.siblings),
        },
        partnerPreferences: {
          ageMin: num(values.ageMin), ageMax: num(values.ageMax),
          education: str(values.education), occupation: str(values.partnerOccupation),
          location: str(values.partnerLocation), otherExpectations: str(values.otherExpectations),
        },
      });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your changes.");
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Your profile has been updated.</Alert>}

      <Section title="Personal">
        <Field
          label="Date of birth"
          hint={dobLocked ? "Your date of birth cannot be changed once set." : "Used to show your age. It cannot be changed later."}
        >
          {({ id }) => <Input id={id} type="date" disabled={dobLocked} {...register("dob")} />}
        </Field>
        <Field label="Height (cm)">
          {({ id }) => <Input id={id} type="number" min={120} max={250} {...register("heightCm")} />}
        </Field>
        <Field label="Place of birth">{({ id }) => <Input id={id} {...register("placeOfBirth")} />}</Field>
        <Field label="Time of birth">{({ id }) => <Input id={id} type="time" {...register("timeOfBirth")} />}</Field>
        <Field label="Marital status">
          {({ id }) => (
            <Select id={id} {...register("maritalStatus")}>
              <option value="">Select</option>
              <option value="NEVER_MARRIED">Never married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="SEPARATED">Separated</option>
            </Select>
          )}
        </Field>
        <Field label="Gotra">{({ id }) => <Input id={id} {...register("gotra")} />}</Field>
        <Field label="Subcaste">{({ id }) => <Input id={id} {...register("subcaste")} />}</Field>
      </Section>

      <Section title="Education & career">
        <Field label="Highest qualification">{({ id }) => <Input id={id} {...register("highestQualification")} />}</Field>
        <Field label="Occupation">{({ id }) => <Input id={id} {...register("occupation")} />}</Field>
        <Field label="Company or business">{({ id }) => <Input id={id} {...register("companyBusiness")} />}</Field>
        <Field label="Annual income (₹)">{({ id }) => <Input id={id} type="number" min={0} {...register("annualIncomeInr")} />}</Field>
      </Section>

      <Section title="Where you live">
        <div className="sm:col-span-2">
          <Field label="Address">{({ id }) => <Input id={id} {...register("line1")} />}</Field>
        </div>
        <Field label="City">{({ id }) => <Input id={id} {...register("city")} />}</Field>
        <Field label="State">{({ id }) => <Input id={id} {...register("state")} />}</Field>
        <Field label="PIN code">{({ id }) => <Input id={id} inputMode="numeric" maxLength={6} {...register("pincode")} />}</Field>
      </Section>

      <Section title="Family">
        <Field label="Father's name">{({ id }) => <Input id={id} {...register("fatherName")} />}</Field>
        <Field label="Mother's name">{({ id }) => <Input id={id} {...register("motherName")} />}</Field>
        <Field label="Native place">{({ id }) => <Input id={id} {...register("native")} />}</Field>
        <Field label="Siblings">{({ id }) => <Input id={id} {...register("siblings")} />}</Field>
      </Section>

      <Section title="What you are looking for">
        <Field label="Preferred age from">{({ id }) => <Input id={id} type="number" min={18} max={100} {...register("ageMin")} />}</Field>
        <Field label="Preferred age to">{({ id }) => <Input id={id} type="number" min={18} max={100} {...register("ageMax")} />}</Field>
        <Field label="Preferred education">{({ id }) => <Input id={id} {...register("education")} />}</Field>
        <Field label="Preferred occupation">{({ id }) => <Input id={id} {...register("partnerOccupation")} />}</Field>
        <Field label="Preferred location">{({ id }) => <Input id={id} {...register("partnerLocation")} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Anything else">{({ id }) => <Textarea id={id} {...register("otherExpectations")} />}</Field>
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" disabled={isSubmitting || !isDirty} className="shadow-lift">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
