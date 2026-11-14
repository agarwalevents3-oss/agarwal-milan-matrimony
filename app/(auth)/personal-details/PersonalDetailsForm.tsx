"use client";

import { useRouter } from "next/navigation";
import { ProfileStep, type ProfileFormValues } from "../register/ProfileStep";

/**
 * The registration "About you" step, reused as the post-payment form. Saving
 * moves the member on to wherever they belong next: the verification screen,
 * or the dashboard if they were already verified.
 */
export function PersonalDetailsForm({
  initial, dobLocked,
}: {
  initial: ProfileFormValues;
  dobLocked: boolean;
}) {
  const router = useRouter();

  return (
    <ProfileStep
      initial={initial}
      dobLocked={dobLocked}
      title="Complete your personal details"
      intro="Your payment is confirmed. Please complete the details below to continue — fields marked * are required. You will not be charged again."
      submitLabel="Save and continue"
      onSaved={() => {
        // /status forwards a verified member to the dashboard.
        router.replace("/status");
        router.refresh();
      }}
    />
  );
}
