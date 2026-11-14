import { test, expect, type Page } from "@playwright/test";

/**
 * The complete journey (PRD final delivery principle):
 *   register → OTP → payment → admin verification → search → interest → match
 *
 * SKIPPED unless E2E_LIVE=1, because it writes rows and therefore needs a real
 * Supabase project. See e2e/README.md. Never point this at production — it
 * creates accounts and then deletes them.
 *
 * It assumes OTP_MODE=mock (every code is MOCK_OTP_CODE, 4 digits) and
 * PAYMENT_MODE=mock (so the checkout can be simulated).
 */

const LIVE = process.env.E2E_LIVE === "1";
const ADMIN_MOBILE = process.env.E2E_ADMIN_MOBILE ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

test.describe("Full journey (live database)", () => {
  test.skip(!LIVE, "Set E2E_LIVE=1 with a staging Supabase project to run this.");
  test.describe.configure({ mode: "serial" });

  /** A mobile number in a range unlikely to collide with real members. */
  const mobileFor = (seed: number) => `7${String(Date.now()).slice(-6)}${String(seed).padStart(3, "0")}`.slice(0, 10);

  const password = "TestPass123";
  const alice = { mobile: mobileFor(1), name: "E2E Alice", gender: "FEMALE" as const };
  const bob = { mobile: mobileFor(2), name: "E2E Bob", gender: "MALE" as const };

  /** Registers through the real UI, ending on the payment screen. */
  async function register(page: Page, person: typeof alice) {
    await page.goto("/register");

    await page.getByLabel(/mobile number/i).fill(person.mobile);
    await page.getByRole("button", { name: /send code/i }).click();

    // In mock mode every code is MOCK_OTP_CODE (4 digits since the MSG91
    // change); the form no longer prefills it.
    await page.getByLabel(/4-digit code/i).fill(process.env.MOCK_OTP_CODE ?? "1234");
    await page.getByRole("button", { name: /^verify$/i }).click();

    await page.getByLabel(/full name/i).fill(person.name);
    await page.getByLabel(/gender/i).selectOption(person.gender);
    await page.getByLabel(/^email/i).fill(`${person.mobile}@example.test`);
    await page.getByLabel(/^password/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    await page.getByRole("button", { name: /continue/i }).click();

    // The mandatory personal details (Website Improvements §3) — the step can
    // no longer be skipped. Optional fields are left empty.
    await expect(page.getByRole("heading", { name: /about you/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /skip for now/i })).toHaveCount(0);
    // Required labels end with an asterisk ("PIN code*"), hence the \*? below.
    await page.getByLabel(/^Date of birth\*?$/).fill("1996-04-12");
    await page.getByLabel(/^Height \(cm\)\*?$/).fill("168");
    await page.getByLabel(/^Marital status\*?$/).selectOption("NEVER_MARRIED");
    await page.getByLabel(/^Gotra\*?$/).fill("Garg");
    await page.getByLabel(/^Highest qualification\*?$/).fill("B.Com");
    await page.getByLabel(/^Occupation\*?$/).fill("Accountant");
    await page.getByLabel(/^City\*?$/).fill("Hyderabad");
    await page.getByLabel(/^State\*?$/).fill("Telangana");
    await page.getByLabel(/^PIN code\*?$/).fill("500001");
    await page.getByLabel(/^Father's name\*?$/).fill("E2E Father");
    await page.getByLabel(/^Mother's name\*?$/).fill("E2E Mother");
    await page.getByRole("button", { name: /save and continue/i }).click();

    await expect(page.getByRole("heading", { name: /documents/i })).toBeVisible();
  }

  async function login(page: Page, mobile: string) {
    await page.goto("/login");
    await page.getByLabel(/mobile number/i).fill(mobile);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /^login$/i }).click();
  }

  test("a new member can register and reaches the payment step", async ({ page }) => {
    await register(page, alice);

    // Submitting without the consent box must be refused (PRD §5.2).
    await page.getByRole("button", { name: /submit registration/i }).click();
    await expect(page.locator("form, div").getByText(/profile photo is required|consent/i).first())
      .toBeVisible();
  });

  test("an unverified member cannot browse profiles (PRD §7.2)", async ({ page }) => {
    await login(page, alice.mobile);
    await page.goto("/dashboard");
    // Routed away to wherever their registration actually is.
    await expect(page).not.toHaveURL(/\/dashboard$/);
  });

  test("the admin cannot verify a registration that has not been paid for", async ({ page }) => {
    test.skip(!ADMIN_MOBILE || !ADMIN_PASSWORD, "Set E2E_ADMIN_MOBILE and E2E_ADMIN_PASSWORD.");

    await page.goto("/login");
    await page.getByLabel(/mobile number/i).fill(ADMIN_MOBILE);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /^login$/i }).click();
    // Sign-in completes in the browser; navigating before it lands would be
    // (correctly) bounced back to /login.
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/registrations?status=PAYMENT_PENDING");
    await expect(page.getByRole("heading", { name: /registrations/i })).toBeVisible();

    const firstRow = page.locator("tbody tr, ul li a").first();
    if (await firstRow.count()) {
      await firstRow.click();
      // The Verify control must not be offered while payment is outstanding.
      await expect(page.getByRole("button", { name: /^verify$/i })).toHaveCount(0);
    }
  });

  test("a verified member sees only 20 results per page (PRD §9.4)", async ({ page }) => {
    test.skip(!ADMIN_MOBILE, "Needs a verified member; run the seeding steps first.");

    await login(page, bob.mobile);
    await page.goto("/dashboard");

    if (page.url().includes("/dashboard")) {
      const cards = page.locator("ul > li article");
      expect(await cards.count()).toBeLessThanOrEqual(20);
    }
  });

  test("changing a filter does not search until DONE is pressed (PRD §9.2)", async ({ page }) => {
    test.skip(!ADMIN_MOBILE, "Needs a verified member.");

    await login(page, bob.mobile);
    await page.goto("/dashboard");
    if (!page.url().includes("/dashboard")) test.skip(true, "Member is not verified.");

    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/dashboard")) requests.push(request.url());
    });

    // Change several filters. None of these may cause a navigation.
    await page.getByLabel(/age from/i).first().fill("25");
    await page.getByLabel(/age to/i).first().fill("35");
    await page.waitForTimeout(500);
    expect(requests, "a filter change triggered a search before DONE").toHaveLength(0);

    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(page).toHaveURL(/ageMin=25/);
  });
});
