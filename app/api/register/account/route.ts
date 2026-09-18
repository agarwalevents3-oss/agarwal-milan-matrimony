import { route } from "@/lib/api/handler";
import { createAccountSchema, type CreateAccountInput } from "@/lib/validation/registration";
import { consumeTicket } from "@/lib/services/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserAttributes, signInCredentials } from "@/lib/auth/identity";
import { conflict, AppError, fromPostgres } from "@/lib/utils/errors";
import type { z } from "zod";

export const runtime = "nodejs";

/**
 * Creates the account in DRAFT and signs the user in (PRD §14).
 *
 * Signing in here is the point: from now on the browser uploads photos and
 * documents directly to Supabase Storage under its own auth.uid(), so the
 * bucket policies apply with no temporary folders and no bytes passing through
 * a serverless function.
 *
 * If the database write fails, the auth user is deleted again — an orphaned
 * login would block that mobile number permanently.
 */
export const POST = route(
  {
    access: "public",
    schema: createAccountSchema as z.ZodType<CreateAccountInput>,
    rateLimit: { limit: 5, windowSeconds: 3600 },
  },
  async ({ body }) => {
    const phone = await consumeTicket(body.ticket);
    const db = createAdminClient();

    const { data: existing } = await db
      .from("users").select("id").eq("mobile", phone).maybeSingle();
    if (existing) {
      throw conflict("An account already exists for this mobile number. Please log in instead.");
    }

    const { data: created, error: authError } = await db.auth.admin.createUser(
      createUserAttributes(phone, body.password),
    );
    if (authError || !created?.user) {
      console.error("[register/account] auth user creation failed", authError);
      throw new AppError("Could not create your account. Please try again.", 500, "INTERNAL");
    }
    const userId = created.user.id;

    try {
      const { data, error } = await db.rpc("create_draft_registration", {
        p_user_id: userId,
        p_mobile: phone,
        p_email: body.email,
        p_full_name: body.fullName,
        p_gender: body.gender,
      });
      if (error) throw fromPostgres(error);

      // Establish the session cookie so the next steps are authenticated.
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(
        signInCredentials(phone, body.password),
      );
      if (signInError) {
        console.error("[register/account] sign-in after creation failed", signInError);
        throw new AppError("Your account was created. Please log in to continue.", 500, "INTERNAL");
      }

      const result = data as unknown as { registration_id: string };
      return { ok: true, registrationId: result.registration_id, status: "DRAFT" };
    } catch (error) {
      await db.auth.admin.deleteUser(userId).catch((e) =>
        console.error("[register/account] failed to roll back auth user", userId, e),
      );
      throw error;
    }
  },
);
