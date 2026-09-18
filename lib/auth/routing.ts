import type { Enums } from "@/types/database";

/**
 * Where a user belongs, given their registration status (PRD §7.2).
 *
 * One table, used by every authenticated page, so "a pending user cannot browse
 * profiles" is expressed once instead of being re-derived (and eventually
 * mis-derived) in each route.
 */
export type RegistrationStatus = Enums["registration_status"];

export function landingPathFor(status: RegistrationStatus): string {
  switch (status) {
    case "DRAFT":            return "/register";
    case "SUBMITTED":
    case "PAYMENT_PENDING":
    case "PAYMENT_FAILED":   return "/payment";
    case "VERIFIED":         return "/dashboard";
    // PAYMENT_SUCCESS, PENDING_VERIFICATION, REJECTED, SUSPENDED, DELETED
    default:                 return "/status";
  }
}

/** Only a verified user may browse, search, send interests or view matches. */
export function canBrowse(status: RegistrationStatus): boolean {
  return status === "VERIFIED";
}

export const STATUS_COPY: Record<RegistrationStatus, { title: string; body: string; tone: "info" | "success" | "warning" | "danger" }> = {
  DRAFT: {
    title: "Your registration is not finished",
    body: "Complete the remaining steps to submit your profile.",
    tone: "info",
  },
  SUBMITTED: {
    title: "Registration submitted",
    body: "Complete the payment to send your profile for verification.",
    tone: "info",
  },
  PAYMENT_PENDING: {
    title: "Payment pending",
    body: "Your profile goes to our verification team once the payment is complete.",
    tone: "warning",
  },
  PAYMENT_FAILED: {
    title: "Payment failed",
    body: "Your last payment did not go through. You can try again at any time.",
    tone: "danger",
  },
  PAYMENT_SUCCESS: {
    title: "Payment received",
    body: "Thank you. We are moving your profile into the verification queue.",
    tone: "success",
  },
  PENDING_VERIFICATION: {
    title: "Awaiting verification",
    body: "Our team is reviewing your profile and documents. Most reviews finish within 24 hours, and you will be notified here as soon as it is done.",
    tone: "info",
  },
  VERIFIED: {
    title: "Your profile is verified",
    body: "You have full access to the matrimonial service.",
    tone: "success",
  },
  REJECTED: {
    title: "Your registration was not approved",
    body: "Please get in touch with our team, who can explain what is needed.",
    tone: "danger",
  },
  SUSPENDED: {
    title: "Your account is suspended",
    body: "Access to profiles is paused. Please contact our team for help.",
    tone: "danger",
  },
  DELETED: {
    title: "This account is closed",
    body: "Please contact our team if you believe this is a mistake.",
    tone: "danger",
  },
};
