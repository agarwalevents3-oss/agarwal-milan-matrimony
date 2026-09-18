import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * SCOPE NOTE: these run against the app with placeholder Supabase credentials,
 * so they cover everything that does not need a live database — the public
 * site, access control, routing, validation and the API contract. The full
 * registration → payment → verification → match journey needs a real Supabase
 * project; see e2e/README.md for how to enable those.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The PRD calls for mobile-first; the phone viewport is not an afterthought.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
