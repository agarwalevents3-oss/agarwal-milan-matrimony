import "server-only";
import { env } from "@/lib/env";

/**
 * The provider seam (PRD §20.1).
 *
 * A driver does exactly one thing: get six digits to a phone. Everything that
 * actually matters — expiry, resend cooldown, attempt caps, hashing — lives in
 * the service above it, so switching providers cannot change the security
 * properties of the flow. Activating a real provider is a new file plus an env
 * var; no page, route or table changes.
 */
export interface OtpDriver {
  readonly name: string;
  send(phoneE164: string, code: string): Promise<void>;
}

/** Development driver. Logs the code; the API echoes it only when OTP_MODE=mock. */
class MockDriver implements OtpDriver {
  readonly name = "mock";
  async send(phoneE164: string, code: string) {
    console.info(`[otp:mock] code for ${phoneE164} is ${code}`);
  }
}

/**
 * MSG91 — the intended production provider for Indian numbers.
 * Fully written, inert until the credentials are supplied.
 */
class Msg91Driver implements OtpDriver {
  readonly name = "msg91";
  async send(phoneE164: string, code: string) {
    const { authKey, templateId, senderId } = env.otp.msg91;
    if (!authKey || !templateId) {
      throw new Error("MSG91 is selected but MSG91_AUTH_KEY / MSG91_TEMPLATE_ID are not set.");
    }

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        sender: senderId || undefined,
        mobile: phoneE164.replace("+", ""),
        otp: code,
      }),
    });

    if (!response.ok) {
      // Log the provider's reason; never surface it to the caller (PRD §28).
      console.error("[otp:msg91] send failed", response.status, await response.text());
      throw new Error("Could not send the verification code.");
    }
  }
}

export function getOtpDriver(): OtpDriver {
  switch (env.otp.mode) {
    case "msg91":
      return new Msg91Driver();
    case "mock":
    default:
      return new MockDriver();
  }
}
