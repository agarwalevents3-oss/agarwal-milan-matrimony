"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { mobileSchema, toE164 } from "@/lib/validation/common";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Login (PRD §7.1): mobile number + password. Email login is not offered,
 * because the mobile number IS the auth identity (lib/auth/identity.ts).
 *
 * Sign-in happens client-side against Supabase Auth, which sets the session
 * cookie our proxy and server guards then read.
 */

const schema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "Enter your password."),
});

type FormValues = { mobile: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mobile: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      phone: toE164(values.mobile),
      password: values.password,
    });

    if (error) {
      // Never distinguish "no such account" from "wrong password" — that would
      // turn the login form into a directory of who is registered.
      setFormError("That mobile number and password do not match.");
      return;
    }

    // A full refresh so the server re-reads the session and routes by status.
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field label="Mobile number" required error={errors.mobile?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id} aria-describedby={describedBy} invalid={invalid}
            type="tel" inputMode="numeric" autoComplete="tel-national"
            placeholder="98765 43210" maxLength={13}
            {...register("mobile")}
          />
        )}
      </Field>

      <Field label="Password" required error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id} aria-describedby={describedBy} invalid={invalid}
            type="password" autoComplete="current-password"
            {...register("password")}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Login"}
      </Button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create your profile
        </Link>
      </p>
    </form>
  );
}
