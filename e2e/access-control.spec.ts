import { test, expect } from "@playwright/test";

/**
 * Access control (PRD §7.2, §15.2).
 *
 * The redirects checked here are a convenience. The real protection is RLS and
 * the server-side guards, which `npm run test:db` proves — but a broken
 * redirect would still be a bad bug, so it is pinned.
 */
test.describe("Access control", () => {
  const memberRoutes = [
    "/dashboard", "/profile", "/interests", "/matches", "/notifications", "/status", "/payment",
  ];

  for (const route of memberRoutes) {
    test(`${route} sends an unauthenticated visitor to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}`));
    });
  }

  test("the admin area is not reachable without signing in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a profile detail page is not reachable without signing in", async ({ page }) => {
    await page.goto("/profiles/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated pages are excluded from search engines", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
