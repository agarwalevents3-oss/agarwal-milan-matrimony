"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "@/lib/api/client";
import { passwordSchema, emailSchema, genderSchema } from "@/lib/validation/common";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Step 3 — the mandatory identity from PRD §5.2, plus the password.
 *
 * This is where the account actually comes into existence. Everything after it
 * happens as a signed-in user, which is what lets the file uploads go straight
 * to Storage under the normal per-user policies.
 */
const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    gender: genderSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function AccountStep({
  ticket, onCreated,
}: {
  ticket: string;
  onCreated: (registrationId: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", gender: undefined, email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const result = await apiPost<{ registrationId: string }>("/api/register/account", {
        ticket,
        password: values.password,
        fullName: values.fullName,
        gender: values.gender,
        email: values.email,
      });
      onCreated(result.registrationId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create your account.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Your details</h1>
        <p className="mt-2 text-sm text-muted">
          Your name and gender cannot be changed later, so please check them carefully.
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field label="Full name" required error={errors.fullName?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid}
                 autoComplete="name" autoFocus {...register("fullName")} />
        )}
      </Field>

      <Field label="Gender" required error={errors.gender?.message}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} aria-describedby={describedBy} invalid={invalid}
                  defaultValue="" {...register("gender")}>
            <option value="" disabled>Select</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </Select>
        )}
      </Field>

      <Field label="Email" required error={errors.email?.message}
             hint="Used for important account notices. You will log in with your mobile number.">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid}
                 type="email" autoComplete="email" {...register("email")} />
        )}
      </Field>

      <Field label="Password" required error={errors.password?.message}
             hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number.">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid}
                 type="password" autoComplete="new-password" {...register("password")} />
        )}
      </Field>

      <Field label="Confirm password" required error={errors.confirmPassword?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid}
                 type="password" autoComplete="new-password" {...register("confirmPassword")} />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating your account…" : "Continue"}
      </Button>
    </form>
  );
}
