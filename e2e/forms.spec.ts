import { test, expect } from "@playwright/test";

/**
 * Client-side validation (PRD §22).
 *
 * The server validates everything again — these tests only check that a member
 * is told what is wrong before they submit, and that errors are announced to
 * assistive technology rather than only shown visually.
 *
 * Errors are located INSIDE the form on purpose: Next renders its own
 * route-announcer with role="alert", so an unscoped query matches two elements.
 */
test.describe("Login form", () => {
  test.beforeEach(async ({ page }) => page.goto("/login"));

  test("rejects a mobile number that is not a valid Indian mobile", async ({ page }) => {
    await page.getByLabel(/mobile number/i).fill("1234567890");
    await page.getByLabel(/password/i).fill("Something1");
    await page.getByRole("button", { name: /^login$/i }).click();

    await expect(page.locator("form").getByRole("alert")).toContainText(/valid 10-digit indian mobile/i);
  });

  test("requires a password", async ({ page }) => {
    await page.getByLabel(/mobile number/i).fill("9876543210");
    await page.getByRole("button", { name: /^login$/i }).click();

    await expect(page.locator("form").getByRole("alert")).toContainText(/enter your password/i);
  });

  test("links to registration", async ({ page }) => {
    await page.getByRole("link", { name: /create your profile/i }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe("Registration", () => {
  test("starts with a mobile number and validates it", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: /create your profile/i })).toBeVisible();

    const mobile = page.getByLabel(/mobile number/i);
    await mobile.fill("55555");
    await page.getByRole("button", { name: /send code/i }).click();

    await expect(page.locator("form").getByRole("alert")).toContainText(/valid 10-digit indian mobile/i);
  });

  test("shows the progress indicator", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("navigation", { name: /registration progress/i })).toBeVisible();
  });

  test("associates every field with a label", async ({ page }) => {
    await page.goto("/register");

    // An unlabelled input is invisible to a screen reader, so this is a real
    // accessibility regression guard rather than a style check.
    const unlabelled = await page.locator("input:not([type=hidden])").evaluateAll((inputs) =>
      inputs.filter((input) => {
        const el = input as HTMLInputElement;
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
        return !el.id || !document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      }).length,
    );
    expect(unlabelled).toBe(0);
  });
});
