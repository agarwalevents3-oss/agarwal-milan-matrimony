import { z } from "zod";
import { profileStepSchema, personalDetailsSchema } from "./registration";

const required = personalDetailsSchema.shape;

/**
 * What a user may change about themselves after registering (PRD §8.3).
 *
 * Name, gender, date of birth and Aadhaar are absent on purpose — they are
 * locked. The database enforces this too (guard_profile_update in migration
 * 0003), so this schema is the friendly first line, not the only one.
 *
 * The mandatory personal details (Website Improvements §3) may be changed but
 * never blanked: when sent they must hold a value, and the address and family
 * sections — which are saved whole — must carry their required fields.
 */
export const profileUpdateSchema = profileStepSchema
  .omit({ fullName: true, gender: true, email: true, dob: true })
  .partial()
  .extend({
    heightCm: required.heightCm.optional(),
    maritalStatus: required.maritalStatus.optional(),
    gotra: required.gotra.optional(),
    highestQualification: required.highestQualification.optional(),
    occupation: required.occupation.optional(),
    address: required.address.optional(),
    family: required.family.optional(),
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
