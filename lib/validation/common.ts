import { z } from "zod";

/**
 * Validators shared by the browser and the server.
 *
 * PRD §22 requires both: the client copy is for a good experience, the server
 * copy is the one that actually protects the data. Sharing the schema is what
 * guarantees they cannot drift apart.
 */

/** Indian mobile: 10 digits starting 6–9, normalised to E.164. */

/** Indian mobile: 10 digits starting 6–9, normalised to E.164. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => {
    const cleaned = v.replace(/[\s-]/g, "");

    if (cleaned.startsWith("+91")) {
      return cleaned.slice(3);
    }

    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      return cleaned.slice(2);
    }

    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      return cleaned.slice(1);
    }

    return cleaned;
  })
  .pipe(
    z.string().regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number.",
    ),
  );


/** The E.164 form we store and hand to Supabase Auth. */
export const toE164 = (tenDigits: string) => `+91${tenDigits}`;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code.");

/**
 * Password strength (PRD §5.5). Length does the heavy lifting; the character
 * classes stop the most obvious weak choices without pushing people toward
 * "Password1!" patterns they will write down.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.");

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Enter the 4-digit code.");

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

export const maritalStatusSchema = z.enum([
  "NEVER_MARRIED", "DIVORCED", "WIDOWED", "SEPARATED",
]);

/** 18 is a hard floor: the schema itself rejects anything younger. */
export const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return false;
    const eighteen = new Date();
    eighteen.setUTCFullYear(eighteen.getUTCFullYear() - 18);
    return d <= eighteen && d >= new Date("1940-01-01T00:00:00Z");
  }, "You must be at least 18 years old to register.");

export const heightCmSchema = z
  .number()
  .int()
  .min(120, "Enter a height between 120 and 250 cm.")
  .max(250, "Enter a height between 120 and 250 cm.");
