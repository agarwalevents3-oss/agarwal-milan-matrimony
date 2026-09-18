import { describe, expect, it } from "vitest";
import { calculateAge, ageRangeToDobRange, formatHeight, formatIncome } from "@/lib/utils/age";

/**
 * Age is never stored — it is derived, and age FILTERS are rewritten into dob
 * ranges so the search can use an index. These boundaries are where that
 * rewrite is easy to get subtly wrong, so they are pinned here.
 */
describe("calculateAge", () => {
  const asOf = new Date("2026-09-18T00:00:00Z");

  it("counts completed years", () => {
    expect(calculateAge("1996-09-18", asOf)).toBe(30);
    expect(calculateAge("1996-09-17", asOf)).toBe(30);
  });

  it("does not count a birthday that has not happened yet this year", () => {
    expect(calculateAge("1996-09-19", asOf)).toBe(29);
    expect(calculateAge("1996-12-31", asOf)).toBe(29);
  });

  it("handles a 29 February birthday", () => {
    expect(calculateAge("2000-02-29", new Date("2026-02-28T00:00:00Z"))).toBe(25);
    expect(calculateAge("2000-02-29", new Date("2026-03-01T00:00:00Z"))).toBe(26);
  });
});

describe("ageRangeToDobRange", () => {
  const asOf = new Date("2026-09-18T00:00:00Z");

  it("selects exactly the requested ages at both boundaries", () => {
    const { from, to } = ageRangeToDobRange(25, 35, asOf);

    // Someone turning 25 today is the youngest included.
    expect(to).toBe("2001-09-18");
    expect(calculateAge(to!, asOf)).toBe(25);

    // Someone one day short of turning 36 is the oldest included.
    expect(from).toBe("1990-09-19");
    expect(calculateAge(from!, asOf)).toBe(35);

    // And one day either side falls out of range.
    const dayYounger = "2001-09-19";
    const dayOlder = "1990-09-18";
    expect(calculateAge(dayYounger, asOf)).toBe(24);
    expect(calculateAge(dayOlder, asOf)).toBe(36);
  });

  it("supports an open-ended range", () => {
    expect(ageRangeToDobRange(30, undefined, asOf)).toEqual({ to: "1996-09-18" });
    expect(ageRangeToDobRange(undefined, 30, asOf)).toEqual({ from: "1995-09-19" });
    expect(ageRangeToDobRange(undefined, undefined, asOf)).toEqual({});
  });
});

describe("display formatting", () => {
  it("shows height in feet and inches alongside cm", () => {
    expect(formatHeight(165)).toBe("5' 5\" (165 cm)");
    expect(formatHeight(null)).toBe("—");
  });

  it("uses Indian numbering for income", () => {
    expect(formatIncome(1_200_000)).toBe("₹12 Lakh");
    expect(formatIncome(25_000_000)).toBe("₹2.5 Cr");
    expect(formatIncome(50_000)).toBe("₹50,000");
    expect(formatIncome(null)).toBe("—");
    // Trailing zeros are insignificant; genuine decimals are not.
    expect(formatIncome(10_000_000)).toBe("₹1 Cr");
    expect(formatIncome(20_500_000)).toBe("₹2.05 Cr");
    expect(formatIncome(1_750_000)).toBe("₹17.5 Lakh");
  });
});
