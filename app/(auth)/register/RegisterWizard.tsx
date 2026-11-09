"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator, type StepKey } from "./steps";
import { MobileStep } from "./MobileStep";
import { OtpStep } from "./OtpStep";
import { AccountStep } from "./AccountStep";
import { ProfileStep } from "./ProfileStep";
import { DocumentsStep } from "./DocumentsStep";

/**
 * Registration wizard (PRD §5.1).
 *
 * State is deliberately in memory only: the OTP ticket and password should not
 * be persisted anywhere. From the Account step onward the real state lives in
 * the database as a DRAFT registration, so a user who closes the tab can log
 * back in and pick up where they left off.
 */
export function RegisterWizard({ userId: initialUserId }: { userId: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("mobile");
  const [mobile, setMobile] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [ticket, setTicket] = useState("");
  const [userId, setUserId] = useState<string | null>(initialUserId);

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-9">
        <div className="mb-7">
          <StepIndicator current={step} />
        </div>

        {step === "mobile" && (
          <MobileStep
            onSent={(value, code) => {
              setMobile(value);
              setDevCode(code);
              setStep("otp");
            }}
          />
        )}

        {step === "otp" && (
          <OtpStep
            mobile={mobile}

            onBack={() => setStep("mobile")}
            onVerified={(value) => {
              setTicket(value);
              setStep("account");
            }}
          />
        )}

        {step === "account" && (
          <AccountStep
            ticket={ticket}
            onCreated={async () => {
              // The account now exists and we are signed in; pick up the id so
              // the upload step can write under this user's own storage prefix.
              const { createClient } = await import("@/lib/supabase/client");
              const { data } = await createClient().auth.getUser();
              setUserId(data.user?.id ?? null);
              setStep("profile");
            }}
          />
        )}

        {step === "profile" && <ProfileStep onSaved={() => setStep("documents")} />}

        {step === "documents" && userId && (
          <DocumentsStep
            userId={userId}
            onSubmitted={() => {
              router.replace("/payment");
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
