import { describe, expect, it } from "vitest";
import { mobileSchema, passwordSchema, pincodeSchema, dobSchema, toE164 } from "@/lib/validation/common";
import { decodeFilters, encodeFilters } from "@/lib/validation/filters";

/**
 * These schemas run on the client AND on the server. A gap here is a gap in the
 * server-side validation the PRD requires (§22), not just a UX annoyance.
 */
describe("mobileSchema", () => {
  it("accepts Indian mobile numbers in the formats people actually type", () => {
    for (const input of ["9876543210", "+919876543210", "919876543210", "09876543210", "98765 43210", "98765-43210"]) {
      expect(mobileSchema.parse(input), input).toBe("9876543210");
    }
  });

  it("rejects numbers that are not valid Indian mobiles", () => {
    for (const input of ["1234567890", "5876543210", "98765432", "98765432101", "abcdefghij", ""]) {
      expect(mobileSchema.safeParse(input).success, input).toBe(false);
    }
  });

  it("normalises to E.164 for storage and for Supabase Auth", () => {
    expect(toE164(mobileSchema.parse("98765 43210"))).toBe("+919876543210");
  });
});

describe("passwordSchema", () => {
  it("accepts a reasonable password", () => {
    expect(passwordSchema.safeParse("Sunrise2026").success).toBe(true);
  });

  it("rejects weak ones, with a message explaining why", () => {
    const cases: [string, RegExp][] = [
      ["short1A", /at least 8/i],
      ["alllowercase1", /uppercase/i],
      ["ALLUPPERCASE1", /lowercase/i],
      ["NoDigitsHere", /number/i],
    ];
    for (const [password, expected] of cases) {
      const result = passwordSchema.safeParse(password);
      expect(result.success, password).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toMatch(expected);
    }
  });
});

describe("pincodeSchema", () => {
  it("accepts a valid PIN and rejects one starting with zero", () => {
    expect(pincodeSchema.safeParse("560001").success).toBe(true);
    expect(pincodeSchema.safeParse("060001").success).toBe(false);
    expect(pincodeSchema.safeParse("56001").success).toBe(false);
  });
});

describe("dobSchema", () => {
  it("enforces the 18-year floor", () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 17);
    expect(dobSchema.safeParse(tooYoung.toISOString().slice(0, 10)).success).toBe(false);

    const oldEnough = new Date();
    oldEnough.setFullYear(oldEnough.getFullYear() - 25);
    expect(dobSchema.safeParse(oldEnough.toISOString().slice(0, 10)).success).toBe(true);
  });
});

describe("filters", () => {
  it("round-trips through the URL", () => {
    const filters = { gender: "FEMALE" as const, ageMin: 25, ageMax: 32, city: "Pune", page: 2 };
    const decoded = decodeFilters(new URLSearchParams(encodeFilters(filters)));
    expect(decoded).toMatchObject(filters);
  });

  it("drops empty values rather than sending them as blank filters", () => {
    expect(encodeFilters({ gender: undefined, city: "", subcaste: "Testcaste" }))
      .toBe("subcaste=Testcaste");
  });

  it("falls back to defaults instead of throwing on a hand-crafted URL", () => {
    const decoded = decodeFilters(new URLSearchParams("gender=ROBOT&ageMin=-5&page=abc"));
    expect(decoded.page).toBe(1);
    expect(decoded.gender).toBeUndefined();
  });
});
