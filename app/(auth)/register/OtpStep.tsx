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

/**
 * Step 2 (PRD §5.4). The provider is mocked for now, but everything the user
 * experiences — expiry, resend cooldown, attempt limits — is real, so
 * switching on a live SMS provider changes nothing about this screen.
 */
export function OtpStep({
  mobile, devCode, onVerified, onBack,
}: {
  mobile: string;
  devCode?: string;
  onVerified: (ticket: string) => void;
  onBack: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<{ code: string }>({ resolver: zodResolver(schema), defaultValues: { code: "" } });

  // Prefill in mock mode so the flow is testable end to end without an SMS.
  useEffect(() => {
    if (devCode) setValue("code", devCode);
  }, [devCode, setValue]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(values: { code: string }) {
    setFormError(null);
    try {
      const { ticket } = await apiPost<{ ticket: string }>("/api/otp/verify", {
        mobile, code: values.code,
      });
      onVerified(ticket);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "That code is not correct.");
    }
  }

  async function resend() {
    setFormError(null);
    setNotice(null);
    try {
      const result = await apiPost<{ devCode?: string }>("/api/otp/send", { mobile });
      setCooldown(60);
      setNotice("A new code is on its way.");
      if (result.devCode) setValue("code", result.devCode);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not resend the code.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Enter your code</h1>
        <p className="mt-2 text-sm text-muted">
          Sent to <span className="font-medium text-ink">+91 {mobile}</span>.{" "}
          <button type="button" onClick={onBack} className="font-medium text-primary hover:underline">
            Change
          </button>
        </p>
      </div>

      {devCode && (
        <Alert tone="info" title="Development mode">
          No SMS provider is connected yet, so the code is shown here and filled in for you.
        </Alert>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field label="6-digit code" required error={errors.code?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id} aria-describedby={describedBy} invalid={invalid}
            type="text" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} autoFocus
            className="text-center text-2xl tracking-[0.5em]"
            {...register("code")}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Verifying…" : "Verify"}
      </Button>

      <button
        type="button" onClick={resend} disabled={cooldown > 0}
        className="text-center text-sm text-muted disabled:opacity-60"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
