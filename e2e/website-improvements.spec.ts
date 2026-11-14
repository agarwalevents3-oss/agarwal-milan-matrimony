import { test, expect } from "@playwright/test";

/**
 * Website Improvements — the parts a visitor can see without an account:
 * footer (§2), Refund & Cancellation Policy (§5), favicon (§7), plus the
 * access rule on the new post-payment details page (§3).
 *
 * Like the rest of this suite, it runs with placeholder Supabase credentials,
 * so the footer shows the "to be confirmed" contact placeholders — which is
 * exactly what an unconfigured site must show.
 */
test.describe("Footer", () => {
  const legalAndInfo: [string, RegExp, RegExp][] = [
    ["About Us", /\/about$/, /about/i],
    ["Terms & Conditions", /\/terms$/, /terms & conditions/i],
    ["Privacy Policy", /\/privacy-policy$/, /privacy policy/i],
    ["Refund & Cancellation Policy", /\/refund-policy$/, /refund & cancellation policy/i],
  ];

  for (const [name, url, heading] of legalAndInfo) {
    test(`"${name}" is visible and opens the right page`, async ({ page }) => {
      await page.goto("/");
      const footer = page.getByRole("contentinfo");
      const link = footer.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

  test("has the quick links, contact placeholders and copyright line", async ({ page }) => {
    await page.goto("/contact");
    const footer = page.getByRole("contentinfo");

    for (const name of ["Home", "About Us", "Contact Us"]) {
      await expect(footer.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(footer).toContainText("[OFFICIAL CONTACT NUMBER – TO BE CONFIRMED]");
    await expect(footer).toContainText("[OFFICIAL EMAIL – TO BE CONFIRMED]");
    await expect(footer).toContainText(`Copyright © ${new Date().getFullYear()} Agarwal Milan Matrimony.`);
    // No placeholder may be turned into a dialable link.
    await expect(footer.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test("is the only footer on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toHaveCount(1);
  });

  test("fits a phone screen without sideways scrolling", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Phone viewport only");
    await page.goto("/refund-policy");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("Refund & Cancellation Policy", () => {
  test("contains every required section and the unconfirmed-term placeholders", async ({ page }) => {
    await page.goto("/refund-policy");
    for (const heading of [
      "Membership Payment Policy", "Refund Eligibility", "Duplicate Payments", "Failed Transactions",
      "Membership Cancellation", "Refund Processing Timeline", "Payment Gateway Charges", "Contact Information",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(heading) })).toBeVisible();
    }
    await expect(page.getByText("[REFUND PROCESSING TIMELINE – TO BE CONFIRMED]").first()).toBeVisible();
    await expect(page.getByText("[PAYMENT GATEWAY CHARGE POLICY – TO BE CONFIRMED]")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
  });
});

test.describe("Favicon", () => {
  test("the logo favicons are declared and served", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="icon"][href="/favicon-32x32.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href="/favicon-16x16.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]')).toHaveCount(1);

    for (const path of ["/favicon.ico", "/favicon-16x16.png", "/favicon-32x32.png", "/apple-touch-icon.png"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toMatch(/^image\//);
    }
  });
});

test.describe("Mandatory personal details", () => {
  test("/personal-details is not reachable without signing in", async ({ page }) => {
    await page.goto("/personal-details");
    await expect(page).toHaveURL(/\/login\?next=%2Fpersonal-details/);
  });
});
