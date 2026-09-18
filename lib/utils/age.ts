/**
 * Age is derived from date of birth, never stored (PRD §8.1).
 *
 * A stored age column is wrong within a year of being written, and it cannot be
 * indexed usefully. So age filters are rewritten into a dob RANGE before the
 * query is built, which lets the search hit the index on profiles.dob.
 */

/** Completed years as of today. */
export function calculateAge(dob: string | Date, asOf: Date = new Date()): number {
  const birth = typeof dob === "string" ? new Date(dob + "T00:00:00Z") : dob;
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Converts an inclusive age range into the inclusive dob range that selects it.
 *
 *   age >= min  ⟺  born on or before  today − min years
 *   age <= max  ⟺  born on or after   today − (max+1) years + 1 day
 *
 * Returns `from`/`to` as ISO dates ready to drop into a BETWEEN.
 */
export function ageRangeToDobRange(
  minAge?: number | null,
  maxAge?: number | null,
  asOf: Date = new Date(),
): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {};

  if (typeof maxAge === "number") {
    const from = new Date(Date.UTC(asOf.getUTCFullYear() - (maxAge + 1), asOf.getUTCMonth(), asOf.getUTCDate()));
    from.setUTCDate(from.getUTCDate() + 1);
    range.from = toIsoDate(from);
  }

  if (typeof minAge === "number") {
    const to = new Date(Date.UTC(asOf.getUTCFullYear() - minAge, asOf.getUTCMonth(), asOf.getUTCDate()));
    range.to = toIsoDate(to);
  }

  return range;
}

/** Height stored in cm; displayed the way Indian matrimonial profiles read it. */
export function formatHeight(cm?: number | null): string {
  if (!cm) return "—";
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}' ${totalInches % 12}" (${cm} cm)`;
}

/** Strips insignificant trailing zeros: 2.50 → "2.5", 12.00 → "12", 2.05 stays. */
function trim(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatIncome(inr?: number | null): string {
  if (inr === null || inr === undefined) return "—";
  if (inr >= 10_000_000) return `₹${trim(inr / 10_000_000)} Cr`;
  if (inr >= 100_000) return `₹${trim(inr / 100_000)} Lakh`;
  return `₹${inr.toLocaleString("en-IN")}`;
}
