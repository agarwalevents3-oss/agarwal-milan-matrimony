import { route } from "@/lib/api/handler";
import { sendOtpSchema } from "@/lib/validation/registration";
import { toE164 } from "@/lib/validation/common";
import { sendOtp } from "@/lib/services/otp";
import { z } from "zod";

export const runtime = "nodejs";

/** Step 1 of registration (PRD §5.1). Rate limits live inside the service. */
export const POST = route(
  { access: "public", schema: sendOtpSchema as z.ZodType<{ mobile: string }> },
  async ({ body, ip }) => {
    const result = await sendOtp(toE164(body.mobile), ip);
    return { ok: true, ...result };
  },
);
