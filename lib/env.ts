import "server-only";

/**
 * Server-side environment access.
 *
 * Every secret in the application is read through this module and nowhere else,
 * so a single grep proves which values exist and that none of them carry a
 * NEXT_PUBLIC_ prefix. Importing "server-only" makes it a build error for any
 * Client Component to pull this file into the browser bundle.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    /** Bypasses RLS. Only ever read inside lib/supabase/admin.ts. */
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  secrets: {
    registrationTicket: required("REGISTRATION_TICKET_SECRET"),
    otpHash: required("OTP_HASH_SECRET"),
    cron: required("CRON_SECRET"),
  },
  otp: {
    mode: optional("OTP_MODE", "mock") as "mock" | "msg91" | "twilio",
    mockCode: optional("MOCK_OTP_CODE", "123456"),
    msg91: {
      authKey: optional("MSG91_AUTH_KEY"),
      senderId: optional("MSG91_SENDER_ID"),
      templateId: optional("MSG91_TEMPLATE_ID"),
    },
  },
  payment: {
    /** "mock" is the demo gateway: no money moves. "razorpay" is live. */
    mode: optional("PAYMENT_MODE", "mock") as "mock" | "razorpay",
    /**
     * Whether the demo gateway may be used on the PRODUCTION deployment
     * (Website Improvements §6.3). "allow" keeps it working there until
     * Razorpay is switched on — the deliberate interim choice; "block" stops
     * fake payments from ever activating a membership in production. Has no
     * effect elsewhere (local, preview, CI), where the demo always works,
     * and none once PAYMENT_MODE=razorpay, which disables the demo entirely.
     */
    demoInProduction: optional("DEMO_PAYMENTS_IN_PRODUCTION", "allow") as "allow" | "block",
    razorpay: {
      keyId: optional("RAZORPAY_KEY_ID"),
      keySecret: optional("RAZORPAY_KEY_SECRET"),
      webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"),
    },
  },
  site: {
    url: optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  },
  deployment: {
    /** Set by Vercel: "production" only on the production deployment. */
    isProduction: optional("VERCEL_ENV") === "production",
  },
  auth: {
    /**
     * "phone"           — auth.users.phone is the login credential (needs the
     *                      Supabase Phone provider enabled, which itself
     *                      requires a configured SMS provider — Supabase will
     *                      not save the toggle without one, even though our
     *                      own OTP service is what actually verifies numbers).
     * "synthetic-email" — a non-deliverable {mobile}@phone.internal address is
     *                      used as the Supabase Auth identity instead. No
     *                      dashboard configuration needed. This is what lets
     *                      us defer setting up a real SMS provider.
     *
     * NEXT_PUBLIC_-prefixed and read directly (not just through this file)
     * by lib/auth/identity-client.ts, because the browser's login form needs
     * to agree with the server on how an account's identity was shaped —
     * this value is a config fact, not a credential, so shipping it to the
     * client is fine. scripts/seed-admin.mjs reads the same var directly too,
     * since it runs outside the Next.js runtime and cannot import either
     * module. One env var is the actual seam; see docs/DECISIONS.md §13.
     */
    identityStrategy: optional("NEXT_PUBLIC_AUTH_IDENTITY_STRATEGY", "phone") as "phone" | "synthetic-email",
  },
} as const;

export const isMockOtp = () => env.otp.mode === "mock";
export const isMockPayment = () => env.payment.mode === "mock";

/**
 * May a demo (fake) payment be taken and confirmed right now? Every demo code
 * path — the simulated checkout, its verification, the payment page — asks
 * this one function, so the rule cannot be applied in one place and missed
 * in another.
 */
export const demoPaymentsAllowed = () =>
  env.payment.mode === "mock" &&
  !(env.deployment.isProduction && env.payment.demoInProduction === "block");

/** Razorpay is selected AND its credentials are present. */
export const razorpayConfigured = () =>
  env.payment.mode === "razorpay" &&
  Boolean(env.payment.razorpay.keyId && env.payment.razorpay.keySecret);
