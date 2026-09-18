import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isMockOtp } from "@/lib/env";
import { getOtpDriver } from "./drivers";
import { badRequest, tooManyRequests, AppError } from "@/lib/utils/errors";

/**
 * OTP lifecycle. Provider-independent by design (PRD §20.1).
 *
 * Codes are stored as an HMAC keyed by a server secret, never in plaintext, so
 * a leaked database backup does not hand over live codes. The real protection
 * for a six-digit code is not the hash though — it is the 10-minute expiry, the
 * 5-attempt cap and the send rate limit, all enforced below.
 */

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const TICKET_TTL = "30m";

function hashCode(phone: string, code: string): string {
  // The phone is bound into the HMAC so a code issued for one number can never
  // be replayed against another.
  return createHmac("sha256", env.secrets.otpHash).update(`${phone}:${code}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function generateCode(): string {
  // In mock mode the code is fixed so the whole flow is testable end to end.
  return isMockOtp() ? env.otp.mockCode : String(randomInt(100_000, 1_000_000));
}

export interface SendOtpResult {
  /** Present only in mock mode, so the dev UI can show it. Never in production. */
  devCode?: string;
  expiresInSeconds: number;
}

export async function sendOtp(phoneE164: string, requestIp: string): Promise<SendOtpResult> {
  const db = createAdminClient();

  // Two independent limits: one stops hammering a single number, the other
  // stops one host enumerating many numbers.
  for (const [key, limit, window] of [
    [`otp:send:phone:${phoneE164}`, 5, 3600],
    [`otp:send:ip:${requestIp}`, 20, 3600],
  ] as const) {
    const { data: allowed } = await db.rpc("check_rate_limit", {
      p_key: key, p_limit: limit, p_window_seconds: window,
    });
    if (allowed === false) throw tooManyRequests();
  }

  // Resend cooldown (PRD §5.4).
  const { data: recent } = await db
    .from("phone_verifications")
    .select("created_at")
    .eq("phone", phoneE164)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw tooManyRequests(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)} seconds before requesting another code.`,
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

  // Supersede any outstanding code for this number so only the newest works.
  await db
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phoneE164)
    .is("consumed_at", null);

  const { error } = await db.from("phone_verifications").insert({
    phone: phoneE164,
    otp_hash: hashCode(phoneE164, code),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new AppError("Could not start verification. Please try again.", 500, "INTERNAL");

  await getOtpDriver().send(phoneE164, code);

  return {
    devCode: isMockOtp() ? code : undefined,
    expiresInSeconds: CODE_TTL_SECONDS,
  };
}

/**
 * Verifies a code and, on success, issues a short-lived signed ticket proving
 * this phone number was verified. /api/register accepts nothing else — which is
 * what stops someone registering a number they do not control.
 */
export async function verifyOtp(phoneE164: string, code: string): Promise<{ ticket: string }> {
  const db = createAdminClient();

  const { data: allowed } = await db.rpc("check_rate_limit", {
    p_key: `otp:verify:${phoneE164}`, p_limit: 10, p_window_seconds: 900,
  });
  if (allowed === false) throw tooManyRequests();

  const { data: record } = await db
    .from("phone_verifications")
    .select("id, otp_hash, expires_at, attempts, consumed_at")
    .eq("phone", phoneE164)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) throw badRequest("Request a verification code first.");
  if (new Date(record.expires_at) < new Date()) {
    throw badRequest("That code has expired. Please request a new one.");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw tooManyRequests("Too many incorrect attempts. Please request a new code.");
  }

  if (!constantTimeEquals(record.otp_hash, hashCode(phoneE164, code))) {
    await db
      .from("phone_verifications")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);
    throw badRequest("That code is not correct.");
  }

  await db
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", record.id);

  return { ticket: await issueTicket(phoneE164) };
}

const ticketKey = () => new TextEncoder().encode(env.secrets.registrationTicket);

export async function issueTicket(phoneE164: string): Promise<string> {
  return new SignJWT({ phone: phoneE164, purpose: "registration" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(ticketKey());
}

/** Returns the verified phone number, or throws if the ticket is bad or expired. */
export async function consumeTicket(ticket: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(ticket, ticketKey());
    if (payload.purpose !== "registration" || typeof payload.phone !== "string") {
      throw new Error("wrong purpose");
    }
    return payload.phone;
  } catch {
    throw badRequest("Your verification has expired. Please start again.");
  }
}
