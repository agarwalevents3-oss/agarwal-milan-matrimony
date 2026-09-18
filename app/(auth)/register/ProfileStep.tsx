"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiPost } from "@/lib/api/client";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Step 4 — everything optional from PRD §5.3.
 *
 * Nothing here blocks progress: a user can skip the lot and fill it in later
 * from their profile page. Grouped into sections so the form stays manageable
 * on a phone (PRD §24).
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

const EMPTY: FormValues = {
  dob: "", placeOfBirth: "", timeOfBirth: "", heightCm: "", maritalStatus: "",
  gotra: "", subcaste: "", highestQualification: "", occupation: "",
  companyBusiness: "", annualIncomeInr: "", line1: "", city: "", state: "", pincode: "",
  fatherName: "", motherName: "", native: "", siblings: "",
  ageMin: "", ageMax: "", education: "", partnerOccupation: "", partnerLocation: "",
  otherExpectations: "",
};

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const str = (v: string) => (v.trim() === "" ? undefined : v.trim());

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-card border border-line bg-canvas p-5">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ProfileStep({ onSaved }: { onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<FormValues>({ defaultValues: EMPTY });

  async function save(values: FormValues) {
    setFormError(null);
    try {
      await apiPost("/api/register/draft", {
        dob: str(values.dob), placeOfBirth: str(values.placeOfBirth),
        timeOfBirth: str(values.timeOfBirth), heightCm: num(values.heightCm),
        maritalStatus: str(values.maritalStatus), gotra: str(values.gotra),
        subcaste: str(values.subcaste),
        highestQualification: str(values.highestQualification),
        occupation: str(values.occupation), companyBusiness: str(values.companyBusiness),
        annualIncomeInr: num(values.annualIncomeInr),
        address: { line1: str(values.line1), city: str(values.city), state: str(values.state), pincode: str(values.pincode) },
        family: { fatherName: str(values.fatherName), motherName: str(values.motherName), native: str(values.native), siblings: str(values.siblings) },
        partnerPreferences: {
          ageMin: num(values.ageMin), ageMax: num(values.ageMax),
          education: str(values.education), occupation: str(values.partnerOccupation),
          location: str(values.partnerLocation), otherExpectations: str(values.otherExpectations),
        },
      });
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save your details.");
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">About you</h1>
        <p className="mt-2 text-sm text-muted">
          All of this is optional and can be added later — but a fuller profile
          gets far better matches.
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <Section title="Personal">
        <Field label="Date of birth" hint="Used to show your age. It cannot be changed once set.">
          {({ id }) => <Input id={id} type="date" {...register("dob")} />}
        </Field>
        <Field label="Height (cm)">
          {({ id }) => <Input id={id} type="number" min={120} max={250} placeholder="165" {...register("heightCm")} />}
        </Field>
        <Field label="Place of birth">{({ id }) => <Input id={id} {...register("placeOfBirth")} />}</Field>
        <Field label="Time of birth">{({ id }) => <Input id={id} type="time" {...register("timeOfBirth")} />}</Field>
        <Field label="Marital status">
          {({ id }) => (
            <Select id={id} defaultValue="" {...register("maritalStatus")}>
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
        <Field label="Highest qualification">{({ id }) => <Input id={id} placeholder="B.Tech" {...register("highestQualification")} />}</Field>
        <Field label="Occupation">{({ id }) => <Input id={id} placeholder="Software Engineer" {...register("occupation")} />}</Field>
        <Field label="Company or business">{({ id }) => <Input id={id} {...register("companyBusiness")} />}</Field>
        <Field label="Annual income (₹)">{({ id }) => <Input id={id} type="number" min={0} placeholder="1200000" {...register("annualIncomeInr")} />}</Field>
      </Section>

      <Section title="Where you live">
        <div className="sm:col-span-2">
          <Field label="Address">
            {({ id }) => <Input id={id} placeholder="House / street" autoComplete="address-line1" {...register("line1")} />}
          </Field>
        </div>
        <Field label="City">{({ id }) => <Input id={id} {...register("city")} />}</Field>
        <Field label="State">{({ id }) => <Input id={id} {...register("state")} />}</Field>
        <Field label="PIN code">{({ id }) => <Input id={id} inputMode="numeric" maxLength={6} {...register("pincode")} />}</Field>
      </Section>

      <Section title="Family">
        <Field label="Father's name">{({ id }) => <Input id={id} {...register("fatherName")} />}</Field>
        <Field label="Mother's name">{({ id }) => <Input id={id} {...register("motherName")} />}</Field>
        <Field label="Native place">{({ id }) => <Input id={id} {...register("native")} />}</Field>
        <Field label="Siblings">{({ id }) => <Input id={id} placeholder="One younger sister" {...register("siblings")} />}</Field>
      </Section>

      <Section title="What you are looking for">
        <Field label="Preferred age from">{({ id }) => <Input id={id} type="number" min={18} max={100} {...register("ageMin")} />}</Field>
        <Field label="Preferred age to">{({ id }) => <Input id={id} type="number" min={18} max={100} {...register("ageMax")} />}</Field>
        <Field label="Preferred education">{({ id }) => <Input id={id} {...register("education")} />}</Field>
        <Field label="Preferred occupation">{({ id }) => <Input id={id} {...register("partnerOccupation")} />}</Field>
        <Field label="Preferred location">{({ id }) => <Input id={id} {...register("partnerLocation")} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Anything else">
            {({ id }) => <Textarea id={id} placeholder="Other expectations…" {...register("otherExpectations")} />}
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" size="lg" disabled={isSubmitting} className="sm:flex-1">
          {isSubmitting ? "Saving…" : "Save and continue"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onSaved} disabled={isSubmitting}>
          Skip for now
        </Button>
      </div>
    </form>
  );
}
