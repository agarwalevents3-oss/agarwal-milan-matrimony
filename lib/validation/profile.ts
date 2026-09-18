import { z } from "zod";
import { profileStepSchema } from "./registration";

/**
 * What a user may change about themselves after registering (PRD §8.3).
 *
 * Name, gender, date of birth and Aadhaar are absent on purpose — they are
 * locked. The database enforces this too (guard_profile_update in migration
 * 0003), so this schema is the friendly first line, not the only one.
 */
export const profileUpdateSchema = profileStepSchema
  .omit({ fullName: true, gender: true, email: true, dob: true })
  .partial();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
