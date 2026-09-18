import { test, expect } from "@playwright/test";

/**
 * The public website (PRD §4).
 *
 * Runs with placeholder Supabase credentials, so these also prove the site
 * degrades gracefully when the database cannot be reached — it renders the
 * fallback copy rather than an error page.
 */
test.describe("Public website", () => {
  test("home page renders its hero and calls to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /register/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i }).first()).toBeVisible();
    await expect(page).toHaveTitle(/matrimony/i);
  });

  test("contact page shows the FAQ accordion and it expands", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByRole("heading", { name: /contact us/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toBeVisible();

    // With no database the FAQ list is empty, which is itself handled.
    const questions = page.locator("details");
    const count = await questions.count();

    if (count > 0) {
      const first = questions.first();
      await expect(first).not.toHaveAttribute("open", "");
      await first.getByRole("group").or(first.locator("summary")).first().click();
      await expect(first).toHaveAttribute("open", "");
    } else {
      await expect(page.getByText(/no questions have been published/i)).toBeVisible();
    }
  });

  test("navigation works between the public pages", async ({ page, isMobile }) => {
    await page.goto("/");

    if (isMobile) {
      await page.getByRole("button", { name: /open menu/i }).click();
    }
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Contact" }).click();

    await expect(page).toHaveURL(/\/contact$/);
  });

  test("has a working skip link and one main landmark", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("renders without horizontal overflow on a phone", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Phone viewport only");

    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, "the page scrolls sideways on a phone").toBe(false);
  });
});
