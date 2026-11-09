
import "server-only";
import { env } from "@/lib/env";

export interface OtpDriver {
  readonly name: string;
  send(phoneE164: string, code: string): Promise<void>;
}

class MockDriver implements OtpDriver {
  readonly name = "mock";

  async send(phoneE164: string, code: string) {
    console.info(`[otp:mock] code for ${phoneE164} is ${code}`);
  }
}

class Msg91Driver implements OtpDriver {
  readonly name = "msg91";

  async send(phoneE164: string, code: string) {
    const { authKey, templateId } = env.otp.msg91;

    if (!authKey || !templateId) {
      throw new Error("MSG91 credentials or template ID are missing.");
    }

    const params = new URLSearchParams({
      template_id: templateId,
      mobile: phoneE164.replace("+", ""),
      otp: code,
      otp_length: "4",
      otp_expiry: "10",
      realTimeResponse: "1",
    });

    const response = await fetch(
      `https://control.msg91.com/api/v5/otp?${params.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({}),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || result?.type !== "success") {
      console.error("[otp:msg91] send failed", response.status, result);
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
