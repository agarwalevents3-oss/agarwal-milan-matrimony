/**
 * Official contact details, shown only once they are real.
 *
 * The contact number and email come from the admin-editable `contact` section
 * of site_content. Migration 0007 seeded them with obvious stand-ins
 * ("+91 00000 00000", "hello@example.com"), and those must never be presented
 * to a member as a number to call. Until the admin enters real details, every
 * surface shows a clearly marked placeholder instead, and nothing becomes a
 * tel: or mailto: link.
 *
 * Pure functions with no environment access, so the footer, the status page
 * and the policy pages all apply exactly the same rule.
 */

export const BRAND_NAME = "Agarwal Milan Matrimony";

export const CONTACT_NUMBER_PLACEHOLDER = "[OFFICIAL CONTACT NUMBER – TO BE CONFIRMED]";
export const CONTACT_EMAIL_PLACEHOLDER = "[OFFICIAL EMAIL – TO BE CONFIRMED]";

/** True for a value that is visibly a placeholder rather than real data. */
function isPlaceholderText(value: string): boolean {
  return /to be confirmed/i.test(value) || /\[.*\]/.test(value);
}

/**
 * The phone number if it is a real one, otherwise null.
 *
 * "Real" means at least ten digits whose subscriber part is not all zeros —
 * which rejects the seeded "+91 00000 00000" without guessing at formats.
 */
export function confirmedPhone(phone: string | null | undefined): string | null {
  const value = phone?.trim() ?? "";
  if (!value || isPlaceholderText(value)) return null;

  const digits = value.replace(/\D/g, "");
  const subscriber = digits.slice(-10);
  if (subscriber.length < 10 || /^0+$/.test(subscriber)) return null;

  return value;
}

/**
 * The email address if it is a real one, otherwise null.
 *
 * example.com / .org / .net are reserved for documentation (RFC 2606), so an
 * address there is by definition a stand-in.
 */
export function confirmedEmail(email: string | null | undefined): string | null {
  const value = email?.trim() ?? "";
  if (!value || isPlaceholderText(value)) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return null;
  if (/@example\.(com|org|net)$/i.test(value)) return null;
  return value;
}

/** tel: href for a confirmed number — spaces and dashes removed. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
