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

/** Where the mandatory personal-details form lives (Website Improvements §3). */
export const PERSONAL_DETAILS_PATH = "/personal-details";

/**
 * A member who has paid but not yet given the mandatory personal details must
 * complete them before going any further: before the verification screen,
 * and before the dashboard for a member verified before the details became
 * mandatory. Payment is never asked for again — this only applies once the
 * payment has already succeeded.
 *
 * Rejected, suspended and deleted accounts are deliberately excluded: they see
 * their account status, not a form.
 */
export function needsPersonalDetails(user: {
  registrationStatus: RegistrationStatus;
  paymentStatus: Enums["payment_status"];
  personalDetailsComplete: boolean;
}): boolean {
  return (
    !user.personalDetailsComplete &&
    user.paymentStatus === "SUCCESS" &&
    ["PAYMENT_SUCCESS", "PENDING_VERIFICATION", "VERIFIED"].includes(user.registrationStatus)
  );
}

/** The message an unverified member sees after logging in (Website Improvements §4). */
export const PROFILE_UNDER_VERIFICATION = {
  title: "Profile Under Verification",
  body:
    "Your profile is currently under verification by our admin team. " +
    "You will be able to access your account once your profile has been verified.",
  help: "For further information or assistance, please contact us.",
} as const;

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
  // Both "paid, not yet verified" states show the same message, word for word
  // as specified in Website Improvements §4.
  PAYMENT_SUCCESS: {
    title: PROFILE_UNDER_VERIFICATION.title,
    body: PROFILE_UNDER_VERIFICATION.body,
    tone: "info",
  },
  PENDING_VERIFICATION: {
    title: PROFILE_UNDER_VERIFICATION.title,
    body: PROFILE_UNDER_VERIFICATION.body,
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
