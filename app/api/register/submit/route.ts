import { route } from "@/lib/api/handler";
import { submitRegistrationSchema, type SubmitRegistrationInput } from "@/lib/validation/registration";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUploadedObject, BUCKETS } from "@/lib/services/storage";
import { badRequest, fromPostgres } from "@/lib/utils/errors";
import type { z } from "zod";

export const runtime = "nodejs";

/** The exact wording shown beside the consent checkbox — stored as evidence. */
export const AADHAAR_CONSENT_TEXT =
  "I confirm this Aadhaar document belongs to me and I consent to it being stored " +
  "securely and used solely to verify my identity for this matrimonial service. " +
  "I understand it will never be shown to other members.";

/**
 * Finalises the registration and moves it to PAYMENT_PENDING (PRD §5.1, §6.1).
 *
 * Every uploaded object's size and MIME type is read back from the Storage API
 * before anything is recorded — the browser's claims about what it uploaded are
 * never trusted (PRD §17, §22).
 */
export const POST = route(
  {
    access: "user",
    schema: submitRegistrationSchema as z.ZodType<SubmitRegistrationInput>,
    rateLimit: { limit: 10, windowSeconds: 3600 },
  },
  async ({ body, user, ip }) => {
    if (user!.registrationStatus !== "DRAFT") {
      throw badRequest("Your registration has already been submitted.");
    }

    const userId = user!.id;
    const [photo, aadhaar, certificate] = await Promise.all([
      verifyUploadedObject(BUCKETS.photos, body.photoPath, userId),
      verifyUploadedObject(BUCKETS.aadhaar, body.aadhaarPath, userId),
      body.educationalCertificatePath
        ? verifyUploadedObject(BUCKETS.certificates, body.educationalCertificatePath, userId)
        : Promise.resolve(null),
    ]);

    const db = createAdminClient();
    const { data, error } = await db.rpc("submit_registration", {
      p_user_id: userId,
      p_documents: {
        photoPath: photo.path, photoThumbPath: body.photoThumbPath,
        photoMime: photo.mimeType, photoSize: photo.sizeBytes,
        aadhaarPath: aadhaar.path, aadhaarMime: aadhaar.mimeType,
        aadhaarSize: aadhaar.sizeBytes, aadhaarConsent: body.aadhaarConsent,
        educationalCertificatePath: certificate?.path ?? null,
        certificateMime: certificate?.mimeType ?? null,
        certificateSize: certificate?.sizeBytes ?? null,
        consentText: AADHAAR_CONSENT_TEXT,
      } as never,
      p_consent_ip: ip,
    });
    if (error) throw fromPostgres(error);

    const result = data as unknown as { registration_id: string; status: string };
    return { ok: true, registrationId: result.registration_id, status: result.status };
  },
);
