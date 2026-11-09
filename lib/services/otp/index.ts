import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isMockOtp } from "@/lib/env";
import { getOtpDriver } from "./drivers";
import { badRequest, tooManyRequests, AppError } from "@/lib/utils/errors";

/**
 * OTP lifecycle. Provider-independent by design.
 *
 * Codes are stored as HMAC hashes, never in plaintext.
 * Security protections:
 * - 10-minute OTP expiry
 * - 5 incorrect verification attempts
 * - 60-second resend cooldown
 * - Phone and IP-based send rate limits
 * - Verification rate limits
 */

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const TICKET_TTL = "30m";

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", env.secrets.otpHash)
    .update(`${phone}:${code}`)
    .digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

function generateCode(): string {
  // Mock mode uses the configured test code.
  // Production generates a cryptographically secure 4-digit OTP.
  return isMockOtp()
    ? env.otp.mockCode
    : String(randomInt(1000, 10000));
}

export interface SendOtpResult {
  devCode?: string;
  expiresInSeconds: number;
}

export async function sendOtp(
  phoneE164: string,
  requestIp: string
): Promise<SendOtpResult> {
  const db = createAdminClient();

  // Phone and IP-based rate limits.
  for (const [key, limit, window] of [
    [`otp:send:phone:${phoneE164}`, 5, 3600],
    [`otp:send:ip:${requestIp}`, 20, 3600],
  ] as const) {
    const { data: allowed, error } = await db.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: window,
    });

    if (error) {
      throw new AppError(
        "Could not start verification. Please try again.",
        500,
        "INTERNAL"
      );
    }

    if (allowed === false) throw tooManyRequests();
  }

  // Enforce resend cooldown.
  const { data: recent, error: recentError } = await db
    .from("phone_verifications")
    .select("created_at")
    .eq("phone", phoneE164)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentError) {
    throw new AppError(
      "Could not start verification. Please try again.",
      500,
      "INTERNAL"
    );
  }

  if (recent) {
    const elapsed =
      (Date.now() - new Date(recent.created_at).getTime()) / 1000;

    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw tooManyRequests(
        `Please wait ${Math.ceil(
          RESEND_COOLDOWN_SECONDS - elapsed
        )} seconds before requesting another code.`
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

  // Mark previous outstanding OTPs as consumed.
  const { error: updateError } = await db
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phoneE164)
    .is("consumed_at", null);

  if (updateError) {
    throw new AppError(
      "Could not start verification. Please try again.",
      500,
      "INTERNAL"
    );
  }

  // Store only the HMAC hash.
  const { error: insertError } = await db
    .from("phone_verifications")
    .insert({
      phone: phoneE164,
      otp_hash: hashCode(phoneE164, code),
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    throw new AppError(
      "Could not start verification. Please try again.",
      500,
      "INTERNAL"
    );
  }

  // Send the OTP through the selected provider.
  try {
    await getOtpDriver().send(phoneE164, code);
  } catch (error) {
    // Invalidate the OTP if SMS delivery fails.
    await db
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", phoneE164)
      .is("consumed_at", null);

    throw error;
  }

  return {
    devCode: isMockOtp() ? code : undefined,
    expiresInSeconds: CODE_TTL_SECONDS,
  };
}

/**
 * Verify the OTP and issue a signed registration ticket.
 */
export async function verifyOtp(
  phoneE164: string,
  code: string
): Promise<{ ticket: string }> {
  const db = createAdminClient();

  const { data: allowed, error: rateLimitError } = await db.rpc(
    "check_rate_limit",
    {
      p_key: `otp:verify:${phoneE164}`,
      p_limit: 10,
      p_window_seconds: 900,
    }
  );

  if (rateLimitError) {
    throw new AppError(
      "Could not verify the code. Please try again.",
      500,
      "INTERNAL"
    );
  }

  if (allowed === false) throw tooManyRequests();

  const { data: record, error: fetchError } = await db
    .from("phone_verifications")
    .select("id, otp_hash, expires_at, attempts, consumed_at")
    .eq("phone", phoneE164)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(
      "Could not verify the code. Please try again.",
      500,
      "INTERNAL"
    );
  }

  if (!record) {
    throw badRequest("Request a verification code first.");
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw badRequest("That code has expired. Please request a new one.");
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw tooManyRequests(
      "Too many incorrect attempts. Please request a new code."
    );
  }

  if (!constantTimeEquals(record.otp_hash, hashCode(phoneE164, code))) {
    const { error: attemptError } = await db
      .from("phone_verifications")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);

    if (attemptError) {
      throw new AppError(
        "Could not verify the code. Please try again.",
        500,
        "INTERNAL"
      );
    }

    throw badRequest("That code is not correct.");
  }

  // Consume OTP so it cannot be reused.
  const { data: consumed, error: consumeError } = await db
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", record.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    throw badRequest(
      "This verification code has already been used. Please request a new one."
    );
  }

  return { ticket: await issueTicket(phoneE164) };
}

const ticketKey = () =>
  new TextEncoder().encode(env.secrets.registrationTicket);

export async function issueTicket(phoneE164: string): Promise<string> {
  return new SignJWT({
    phone: phoneE164,
    purpose: "registration",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(ticketKey());
}

/**
 * Returns the verified phone number, or throws if the ticket is invalid
 * or expired.
 */
export async function consumeTicket(ticket: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(ticket, ticketKey());

    if (
      payload.purpose !== "registration" ||
      typeof payload.phone !== "string"
    ) {
      throw new Error("Wrong ticket purpose");
    }

    return payload.phone;
  } catch {
    throw badRequest(
      "Your verification has expired. Please start again."
    );
  }
}
