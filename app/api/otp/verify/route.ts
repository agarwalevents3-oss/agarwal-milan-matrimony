import { route } from "@/lib/api/handler";
import { verifyOtpSchema } from "@/lib/validation/registration";
import { toE164 } from "@/lib/validation/common";
import { verifyOtp } from "@/lib/services/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { conflict } from "@/lib/utils/errors";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Step 2. On success the caller receives a signed ticket proving this number
 * was verified; /api/register accepts nothing else.
 */
export const POST = route(
  { access: "public", schema: verifyOtpSchema as z.ZodType<{ mobile: string; code: string }> },
  async ({ body }) => {
    const phone = toE164(body.mobile);

    // Fail here rather than after the user has filled in the whole form.
    const db = createAdminClient();
    const { data: existing } = await db
      .from("users").select("id").eq("mobile", phone).maybeSingle();
    if (existing) {
      throw conflict("An account already exists for this mobile number. Please log in instead.");
    }

    const { ticket } = await verifyOtp(phone, body.code);
    return { ok: true, ticket };
  },
);
