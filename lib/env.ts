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
    mode: optional("PAYMENT_MODE", "mock") as "mock" | "razorpay",
    razorpay: {
      keyId: optional("RAZORPAY_KEY_ID"),
      keySecret: optional("RAZORPAY_KEY_SECRET"),
      webhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"),
    },
  },
  site: {
    url: optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  },
} as const;

export const isMockOtp = () => env.otp.mode === "mock";
export const isMockPayment = () => env.payment.mode === "mock";
