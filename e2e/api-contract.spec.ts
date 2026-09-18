import { test, expect } from "@playwright/test";

/**
 * The API contract.
 *
 * Every Route Handler must answer `{ error, code }` with a sensible status, and
 * must never leak an internal database message (PRD §22). These hit the real
 * endpoints, so they also confirm auth is enforced server-side rather than only
 * by the proxy.
 */
test.describe("API contract", () => {
  test("validation errors come back as a clear, user-safe message", async ({ request }) => {
    const response = await request.post("/api/otp/send", {
      data: { mobile: "1234567890" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("BAD_REQUEST");
    expect(body.error).toMatch(/valid 10-digit indian mobile/i);
  });

  test("a malformed body is rejected rather than crashing", async ({ request }) => {
    const response = await request.post("/api/otp/send", {
      headers: { "Content-Type": "application/json" },
      data: "not json at all",
    });
    expect([400, 500]).toContain(response.status());
    const body = await response.json();
    expect(body.error).toBeTruthy();
    // No stack traces, no Postgres detail.
    expect(body.error).not.toMatch(/at Object|pg_|relation "|syntax error/i);
  });

  const guardedRoutes: [string, Record<string, unknown>][] = [
    ["/api/register/draft", {}],
    ["/api/register/submit", {}],
    ["/api/payment/create", {}],
    ["/api/profile/update", {}],
    ["/api/interest/send", { receiverUserId: "00000000-0000-0000-0000-000000000000" }],
    ["/api/interest/respond", { interestId: "00000000-0000-0000-0000-000000000000", action: "ACCEPT" }],
    ["/api/notifications/read", { all: true }],
  ];

  for (const [route, payload] of guardedRoutes) {
    test(`${route} refuses an unauthenticated caller`, async ({ request }) => {
      const response = await request.post(route, { data: payload });
      expect(response.status(), `${route} should require authentication`).toBe(401);
      expect((await response.json()).code).toBe("UNAUTHORIZED");
    });
  }

  const adminRoutes = [
    "/api/admin/verify-user", "/api/admin/reject-user",
    "/api/admin/suspend-user", "/api/admin/delete-user",
    "/api/admin/document-url", "/api/admin/content",
    "/api/admin/faqs", "/api/admin/settings",
  ];

  for (const route of adminRoutes) {
    test(`${route} refuses a caller who is not an admin`, async ({ request }) => {
      const response = await request.post(route, {
        data: { userId: "00000000-0000-0000-0000-000000000000" },
      });
      expect([401, 403]).toContain(response.status());
    });
  }

  test("the cron sweep refuses a caller without the shared secret", async ({ request }) => {
    const response = await request.get("/api/cron/cleanup");
    expect(response.status()).toBe(401);
  });

  test("the cron sweep refuses a wrong secret", async ({ request }) => {
    const response = await request.get("/api/cron/cleanup", {
      headers: { authorization: "Bearer definitely-not-the-secret" },
    });
    expect(response.status()).toBe(401);
  });

  test("security headers are set on public pages", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBeTruthy();
  });
});
