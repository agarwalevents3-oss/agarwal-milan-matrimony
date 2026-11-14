"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiPost } from "@/lib/api/client";
import { personalDetailsSchema } from "@/lib/validation/registration";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Step 4 — the member's personal details (PRD §5.3, Website Improvements §3).
 *
 * A core set of these fields is mandatory and the step can no longer be
 * skipped. The set is defined once, in personalDetailsSchema, which this form
 * and /api/register/draft both validate against — so the browser and the
 * server cannot disagree about what is required.
 *
 * The same component is the post-payment form at /personal-details, for a
 * member who paid before the details became mandatory. There it is prefilled
 * with whatever they already saved, so nothing is lost or typed twice.
 *
 * Grouped into sections so the form stays manageable on a phone (PRD §24).
 */

export interface ProfileFormValues {
  dob: string; placeOfBirth: string; timeOfBirth: string; heightCm: string;
  maritalStatus: string; gotra: string; subcaste: string;
  highestQualification: string; occupation: string; companyBusiness: string; annualIncomeInr: string;
  line1: string; city: string; state: string; pincode: string;
  fatherName: string; motherName: string; native: string; siblings: string;
  ageMin: string; ageMax: string; education: string; partnerOccupation: string;
  partnerLocation: string; otherExpectations: string;
}

type FieldName = keyof ProfileFormValues;

const EMPTY: ProfileFormValues = {
  dob: "", placeOfBirth: "", timeOfBirth: "", heightCm: "", maritalStatus: "",
  gotra: "", subcaste: "", highestQualification: "", occupation: "",
  companyBusiness: "", annualIncomeInr: "", line1: "", city: "", state: "", pincode: "",
  fatherName: "", motherName: "", native: "", siblings: "",
  ageMin: "", ageMax: "", education: "", partnerOccupation: "", partnerLocation: "",
  otherExpectations: "",
};

/** Maps a validation issue's path in the API payload back to its form field. */
const FIELD_FOR_PATH: Record<string, FieldName> = {
  "address": "city",
  "address.line1": "line1", "address.city": "city", "address.state": "state", "address.pincode": "pincode",
  "family": "fatherName",
  "family.fatherName": "fatherName", "family.motherName": "motherName",
  "family.native": "native", "family.siblings": "siblings",
  "partnerPreferences.ageMin": "ageMin", "partnerPreferences.ageMax": "ageMax",
  "partnerPreferences.education": "education", "partnerPreferences.occupation": "partnerOccupation",
  "partnerPreferences.location": "partnerLocation",
  "partnerPreferences.otherExpectations": "otherExpectations",
};

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const str = (v: string) => (v.trim() === "" ? undefined : v.trim());

/** The request body for /api/register/draft. */
function toPayload(values: ProfileFormValues) {
  return {
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
  };
}

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

export function ProfileStep({
  onSaved,
  initial,
  dobLocked = false,
  title = "About you",
  intro = "Fields marked * are required. The rest are optional, but a fuller profile gets far better matches.",
  submitLabel = "Save and continue",
}: {
  onSaved: () => void;
  /** Saved values to start from, when completing an existing profile. */
  initial?: Partial<ProfileFormValues>;
  /** Date of birth already set: shown, but it cannot be changed. */
  dobLocked?: boolean;
  title?: string;
  intro?: string;
  submitLabel?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<ProfileFormValues>({ defaultValues: { ...EMPTY, ...initial } });

  async function save(values: ProfileFormValues) {
    setFormError(null);
    const payload = toPayload(values);

    // Same schema the server applies, so every problem is shown at once and
    // next to its own field instead of one at a time from the API.
    const parsed = personalDetailsSchema.safeParse(payload);
    if (!parsed.success) {
      const flagged = new Set<FieldName>();
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        const field = FIELD_FOR_PATH[path] ?? (path as FieldName);
        if (!(field in EMPTY) || flagged.has(field)) continue;
        setError(field, { message: issue.message }, { shouldFocus: flagged.size === 0 });
        flagged.add(field);
      }
      setFormError("Please complete the required details highlighted below.");
      return;
    }

    try {
      await apiPost("/api/register/draft", payload);
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save your details.");
    }
  }

  /** Label/error wiring shared by every control. */
  const control = (name: FieldName) => ({
    error: errors[name]?.message,
  });

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{intro}</p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <Section title="Personal">
        <Field
          label="Date of birth" required {...control("dob")}
          hint={dobLocked ? "Your date of birth is already saved and cannot be changed." : "Used to show your age. It cannot be changed once set."}
        >
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} type="date"
                   readOnly={dobLocked} {...register("dob")} />
          )}
        </Field>
        <Field label="Height (cm)" required {...control("heightCm")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   type="number" min={120} max={250} placeholder="165" {...register("heightCm")} />
          )}
        </Field>
        <Field label="Place of birth" {...control("placeOfBirth")}>
          {({ id }) => <Input id={id} {...register("placeOfBirth")} />}
        </Field>
        <Field label="Time of birth" {...control("timeOfBirth")}>
          {({ id }) => <Input id={id} type="time" {...register("timeOfBirth")} />}
        </Field>
        <Field label="Marital status" required {...control("maritalStatus")}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register("maritalStatus")}>
              <option value="">Select</option>
              <option value="NEVER_MARRIED">Never married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="SEPARATED">Separated</option>
            </Select>
          )}
        </Field>
        <Field label="Gotra" required {...control("gotra")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register("gotra")} />
          )}
        </Field>
        <Field label="Subcaste" {...control("subcaste")}>
          {({ id }) => <Input id={id} {...register("subcaste")} />}
        </Field>
      </Section>

      <Section title="Education & career">
        <Field label="Highest qualification" required {...control("highestQualification")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   placeholder="B.Tech" {...register("highestQualification")} />
          )}
        </Field>
        <Field label="Occupation" required {...control("occupation")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   placeholder="Software Engineer" {...register("occupation")} />
          )}
        </Field>
        <Field label="Company or business" {...control("companyBusiness")}>
          {({ id }) => <Input id={id} {...register("companyBusiness")} />}
        </Field>
        <Field label="Annual income (₹)" {...control("annualIncomeInr")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   type="number" min={0} placeholder="1200000" {...register("annualIncomeInr")} />
          )}
        </Field>
      </Section>

      <Section title="Where you live">
        <div className="sm:col-span-2">
          <Field label="Address" {...control("line1")}>
            {({ id }) => <Input id={id} placeholder="House / street" autoComplete="address-line1" {...register("line1")} />}
          </Field>
        </div>
        <Field label="City" required {...control("city")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register("city")} />
          )}
        </Field>
        <Field label="State" required {...control("state")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register("state")} />
          )}
        </Field>
        <Field label="PIN code" required {...control("pincode")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   inputMode="numeric" maxLength={6} {...register("pincode")} />
          )}
        </Field>
      </Section>

      <Section title="Family">
        <Field label="Father's name" required {...control("fatherName")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register("fatherName")} />
          )}
        </Field>
        <Field label="Mother's name" required {...control("motherName")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register("motherName")} />
          )}
        </Field>
        <Field label="Native place" {...control("native")}>
          {({ id }) => <Input id={id} {...register("native")} />}
        </Field>
        <Field label="Siblings" {...control("siblings")}>
          {({ id }) => <Input id={id} placeholder="One younger sister" {...register("siblings")} />}
        </Field>
      </Section>

      <Section title="What you are looking for">
        <Field label="Preferred age from" {...control("ageMin")}>
          {({ id }) => <Input id={id} type="number" min={18} max={100} {...register("ageMin")} />}
        </Field>
        <Field label="Preferred age to" {...control("ageMax")}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid}
                   type="number" min={18} max={100} {...register("ageMax")} />
          )}
        </Field>
        <Field label="Preferred education" {...control("education")}>
          {({ id }) => <Input id={id} {...register("education")} />}
        </Field>
        <Field label="Preferred occupation" {...control("partnerOccupation")}>
          {({ id }) => <Input id={id} {...register("partnerOccupation")} />}
        </Field>
        <Field label="Preferred location" {...control("partnerLocation")}>
          {({ id }) => <Input id={id} {...register("partnerLocation")} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Anything else" {...control("otherExpectations")}>
            {({ id }) => <Textarea id={id} placeholder="Other expectations…" {...register("otherExpectations")} />}
          </Field>
        </div>
      </Section>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
