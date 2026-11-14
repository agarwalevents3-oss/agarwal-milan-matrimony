import { describe, expect, it } from "vitest";
import {
  buildMembershipPlan, parseFeeSetting, formatPrice, toMinorUnits, MEMBERSHIP_PLACEHOLDERS,
} from "@/lib/membership";
import { confirmedEmail, confirmedPhone, telHref } from "@/lib/utils/contact";

/**
 * Membership pricing (Website Improvements §6.2) and official contact details
 * (§2, §4, §5). Both decide what a member is told, so neither may guess.
 */
describe("membership price — one authoritative source, no invented fallback", () => {
  it("reads the admin_settings registration_fee value", () => {
    expect(parseFeeSetting({ amount: 999, currency: "INR" })).toEqual({ amount: 999, currency: "INR" });
    expect(parseFeeSetting({ amount: "1499.5", currency: "inr" })).toEqual({ amount: 1499.5, currency: "INR" });
  });

  it("treats a missing or malformed fee as not configured", () => {
    for (const value of [null, undefined, {}, { amount: 0 }, { amount: -5 }, { amount: "abc" }, "999"]) {
      expect(parseFeeSetting(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("builds the plan with a placeholder name and no price when unconfigured", () => {
    const plan = buildMembershipPlan(undefined);
    expect(plan.price).toBeNull();
    expect(plan.name).toBe(MEMBERSHIP_PLACEHOLDERS.planName);
    expect(MEMBERSHIP_PLACEHOLDERS.price).toBe("[MEMBERSHIP PRICE – TO BE CONFIRMED]");
    expect(MEMBERSHIP_PLACEHOLDERS.validity).toBe("[MEMBERSHIP VALIDITY – TO BE CONFIRMED]");
  });

  it("converts to paise exactly, so the gateway charges what is displayed", () => {
    expect(toMinorUnits(999)).toBe(99900);
    expect(toMinorUnits(1499.5)).toBe(149950);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });

  it("formats rupees for display", () => {
    expect(formatPrice({ amount: 999, currency: "INR" })).toBe("₹999");
    expect(formatPrice({ amount: 12500, currency: "INR" })).toBe("₹12,500");
  });
});

describe("official contact details — only real ones are shown", () => {
  it("rejects the seeded stand-ins and placeholders", () => {
    for (const phone of ["+91 00000 00000", "", "   ", "[TO BE CONFIRMED]", "12345", null, undefined]) {
      expect(confirmedPhone(phone), String(phone)).toBeNull();
    }
    for (const email of ["hello@example.com", "x@example.org", "", "not-an-email", "[TO BE CONFIRMED]", null]) {
      expect(confirmedEmail(email), String(email)).toBeNull();
    }
  });

  it("accepts real details once the admin enters them", () => {
    expect(confirmedPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(confirmedPhone("040-2345 6789")).toBe("040-2345 6789");
    expect(confirmedEmail("support@agarwalmilan.in")).toBe("support@agarwalmilan.in");
  });

  it("builds a dialable tel: link", () => {
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telHref("040-2345 6789")).toBe("tel:04023456789");
  });
});
