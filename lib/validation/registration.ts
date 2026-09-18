import { z } from "zod";
import {
  mobileSchema, emailSchema, passwordSchema, otpSchema,
  genderSchema, dobSchema, heightCmSchema, maritalStatusSchema, pincodeSchema,
} from "./common";

/** Step 1 — mobile entry. */
export const sendOtpSchema = z.object({ mobile: mobileSchema });

/** Step 2 — code entry. */
export const verifyOtpSchema = z.object({
  mobile: mobileSchema,
  code: otpSchema,
});

/** Step 3 — credentials. */
export const passwordStepSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

/**
 * Step 4 — the profile itself.
 *
 * Mandatory set is exactly PRD §5.2: name, gender, mobile, email, password,
 * photo, Aadhaar and its consent. Everything in PRD §5.3 is optional and may
 * be filled in later from the profile page.
 */
export const profileStepSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  gender: genderSchema,
  email: emailSchema,

  dob: dobSchema.optional(),
  placeOfBirth: z.string().trim().max(120).optional(),
  timeOfBirth: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  heightCm: heightCmSchema.optional(),
  maritalStatus: maritalStatusSchema.optional(),
  gotra: z.string().trim().max(80).optional(),
  subcaste: z.string().trim().max(80).optional(),

  highestQualification: z.string().trim().max(120).optional(),
  occupation: z.string().trim().max(120).optional(),
  companyBusiness: z.string().trim().max(120).optional(),
  annualIncomeInr: z.number().int().min(0).max(1_000_000_000).optional(),

  address: z.object({
    line1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    pincode: pincodeSchema.optional(),
  }).optional(),

  family: z.object({
    fatherName: z.string().trim().max(120).optional(),
    motherName: z.string().trim().max(120).optional(),
    native: z.string().trim().max(120).optional(),
    siblings: z.string().trim().max(400).optional(),
  }).optional(),

  partnerPreferences: z.object({
    ageMin: z.number().int().min(18).max(100).optional(),
    ageMax: z.number().int().min(18).max(100).optional(),
    heightMinCm: heightCmSchema.optional(),
    heightMaxCm: heightCmSchema.optional(),
    education: z.string().trim().max(160).optional(),
    occupation: z.string().trim().max(160).optional(),
    location: z.string().trim().max(160).optional(),
    otherExpectations: z.string().trim().max(1000).optional(),
  }).refine(
    (v) => v.ageMin == null || v.ageMax == null || v.ageMin <= v.ageMax,
    { message: "Minimum age cannot be greater than maximum age.", path: ["ageMax"] },
  ).optional(),
});

/** Step 5 — the uploaded objects, already in Storage. */
export const documentsStepSchema = z.object({
  photoPath: z.string().min(1, "A profile photo is required."),
  photoThumbPath: z.string().min(1),
  aadhaarPath: z.string().min(1, "An Aadhaar document is required."),
  aadhaarConsent: z.literal(true, {
    message: "You must accept the Aadhaar consent to continue.",
  }),
  educationalCertificatePath: z.string().optional(),
});

/**
 * POSTed to /api/register/account.
 *
 * Only the mandatory identity from PRD §5.2 — enough to create the account so
 * that the remaining steps, including the file uploads, happen as a real signed-in
 * user under the normal storage policies.
 */
export const createAccountSchema = z.object({
  ticket: z.string().min(10, "Your verification has expired. Please start again."),
  password: passwordSchema,
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  gender: genderSchema,
  email: emailSchema,
});

/** POSTed to /api/register/draft as the user works through the optional steps. */
export const saveDraftSchema = profileStepSchema
  .omit({ fullName: true, gender: true, email: true })
  .partial();

/** POSTed to /api/register/submit once the documents are uploaded. */
export const submitRegistrationSchema = documentsStepSchema;

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>;
export type ProfileStepInput = z.infer<typeof profileStepSchema>;
