"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { apiPost } from "@/lib/api/client";
import { mobileSchema } from "@/lib/validation/common";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const schema = z.object({ mobile: mobileSchema });

/** Step 1 (PRD §5.1): registration begins with a mobile number. */
export function MobileStep({
  onSent,
}: {
  onSent: (mobile: string, devCode?: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<{ mobile: string }>({ resolver: zodResolver(schema), defaultValues: { mobile: "" } });

  async function onSubmit(values: { mobile: string }) {
    setFormError(null);
    try {
      const result = await apiPost<{ devCode?: string }>("/api/otp/send", { mobile: values.mobile });
      onSent(values.mobile, result.devCode);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not send the code.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Create your profile</h1>
        <p className="mt-2 text-sm text-muted">
          We will send a 6-digit code to confirm your number.
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field label="Mobile number" required error={errors.mobile?.message}
             hint="Indian mobile numbers only. This becomes your login.">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id} aria-describedby={describedBy} invalid={invalid}
            type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus
            placeholder="98765 43210" maxLength={13}
            {...register("mobile")}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Sending code…" : "Send code"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">Login</Link>
      </p>
    </form>
  );
}
