/**
 * The membership plan — one authoritative description (Website Improvements §6.1, §6.2).
 *
 * The PRICE is not here: it lives in exactly one place, the
 * `registration_fee` row of admin_settings, which the admin edits from
 * /admin/settings. lib/services/membership.ts reads it for both the payment
 * page and /api/payment/create, so the amount shown is always the amount
 * charged. Everything else a member is told before paying is defined below.
 *
 * Business terms that have not been confirmed are clearly marked
 * placeholders, never invented values. Replace a placeholder string here once
 * the client confirms it, and every page that shows it updates.
 *
 * Pure module — no database, no environment — so it is safe anywhere and
 * unit-testable.
 */

/** Internal identifier recorded on every payment (payments.membership_plan). */
export const MEMBERSHIP_PLAN_CODE = "standard";

export const MEMBERSHIP_PLACEHOLDERS = {
  planName: "[MEMBERSHIP PLAN NAME – TO BE CONFIRMED]",
  price: "[MEMBERSHIP PRICE – TO BE CONFIRMED]",
  taxes: "[APPLICABLE TAXES & CHARGES – TO BE CONFIRMED]",
  validity: "[MEMBERSHIP VALIDITY – TO BE CONFIRMED]",
  expiry: "[MEMBERSHIP EXPIRY RULES – TO BE CONFIRMED]",
} as const;

export interface MembershipPrice {
  /** In rupees, as stored in admin_settings. */
  amount: number;
  currency: string;
}

export interface MembershipPlan {
  code: string;
  name: string;
  /** null when the fee has not been configured — payment is then refused. */
  price: MembershipPrice | null;
}

/**
 * Reads the admin_settings `registration_fee` value. Anything malformed or
 * non-positive is treated as "not configured" rather than guessed at — there
 * is deliberately no hard-coded fallback price.
 */
export function parseFeeSetting(value: unknown): MembershipPrice | null {
  if (!value || typeof value !== "object") return null;
  const { amount, currency } = value as { amount?: unknown; currency?: unknown };
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (typeof numeric !== "number" || !Number.isFinite(numeric) || numeric <= 0) return null;
  return {
    amount: Math.round(numeric * 100) / 100,
    currency: typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "INR",
  };
}

export function buildMembershipPlan(feeSetting: unknown): MembershipPlan {
  return {
    code: MEMBERSHIP_PLAN_CODE,
    name: MEMBERSHIP_PLACEHOLDERS.planName,
    price: parseFeeSetting(feeSetting),
  };
}

/** Amount in the smallest currency unit (paise), as gateways expect. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function formatPrice(price: MembershipPrice): string {
  const formatted = price.amount.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return price.currency === "INR" ? `₹${formatted}` : `${price.currency} ${formatted}`;
}

/** When membership starts — this is how the system actually behaves. */
export const MEMBERSHIP_START_RULE =
  "Your membership benefits begin once our team has verified your profile after a successful payment.";

/** What a membership gives today — only features that are actually built. */
export const MEMBERSHIP_BENEFITS = [
  "Your profile is reviewed by our verification team before it is shown to other members.",
  "Browse and search verified member profiles, with filters such as age, height, marital status, gotra, education, occupation, income and location.",
  "View verified members' profile details and partner preferences.",
  "Send interests to profiles you like, and accept or decline the interests you receive.",
  "See your matches, with in-app notifications for interests, matches and your account status.",
] as const;

/** Who can see whose contact details — enforced by the database, not by plan. */
export const CONTACT_VISIBILITY_RULES = [
  "Members can never see another member's mobile number or email address. This applies to every member, whatever their membership.",
  "Profile pages show our official contact number instead, so our team can help connect members.",
  "Aadhaar and other documents you upload are seen only by our verification team — never by other members.",
  "Family details (such as parents' names) are visible only to you and our team.",
] as const;
