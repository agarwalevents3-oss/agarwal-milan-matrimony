
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "@/lib/api/client";
import { otpSchema } from "@/lib/validation/common";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const schema = z.object({ code: otpSchema });

export function OtpStep({
  mobile,
  onVerified,
  onBack,
}: {
  mobile: string;
  onVerified: (ticket: string) => void;
  onBack: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<{ code: string }>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(values: { code: string }) {
    setFormError(null);
    setNotice(null);

    try {
      const { ticket } = await apiPost<{ ticket: string }>(
        "/api/otp/verify",
        {
          mobile,
          code: values.code,
        }
      );

      onVerified(ticket);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "That code is not correct."
      );
    }
  }

  async function resend() {
    setFormError(null);
    setNotice(null);

    try {
      await apiPost("/api/otp/send", { mobile });

      setValue("code", "");
      setCooldown(60);
      setNotice("A new verification code has been sent to your mobile.");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not resend the code."
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl">
          Enter your verification code
        </h1>

        <p className="mt-2 text-sm text-muted">
          Sent to{" "}
          <span className="font-medium text-ink">
            +91 {mobile}
          </span>
          .{" "}
          <button
            type="button"
            onClick={onBack}
            className="font-medium text-primary hover:underline"
          >
            Change
          </button>
        </p>

        <p className="mt-2 text-xs text-muted">
          Your 4-digit code is valid for 10 minutes.
        </p>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field
        label="4-digit code"
        required
        error={errors.code?.message}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            autoFocus
            className="text-center text-2xl tracking-[0.5em]"
            {...register("code", {
              onChange: (event) => {
                const digits = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4);

                setValue("code", digits, {
                  shouldValidate: true,
                });
              },
            })}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Verifying…" : "Verify"}
      </Button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="text-center text-sm text-muted disabled:opacity-60"
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : "Resend code"}
      </button>
    </form>
  );
}
