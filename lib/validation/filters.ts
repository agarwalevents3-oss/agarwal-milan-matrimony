import { z } from "zod";
import { genderSchema, maritalStatusSchema } from "./common";

/**
 * Search filters (PRD §9.1).
 *
 * Parsed identically on the client (before the DONE button fires) and on the
 * server, so a hand-crafted URL cannot smuggle an unexpected filter into the
 * query builder.
 */
export const filterSchema = z.object({
  gender: genderSchema.optional(),
  ageMin: z.coerce.number().int().min(18).max(100).optional(),
  ageMax: z.coerce.number().int().min(18).max(100).optional(),
  heightMinCm: z.coerce.number().int().min(120).max(250).optional(),
  heightMaxCm: z.coerce.number().int().min(120).max(250).optional(),
  maritalStatus: maritalStatusSchema.optional(),
  gotra: z.string().trim().max(80).optional(),
  subcaste: z.string().trim().max(80).optional(),
  highestQualification: z.string().trim().max(120).optional(),
  occupation: z.string().trim().max(120).optional(),
  companyBusiness: z.string().trim().max(120).optional(),
  incomeMin: z.coerce.number().int().min(0).optional(),
  incomeMax: z.coerce.number().int().min(0).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type Filters = z.infer<typeof filterSchema>;

/** PRD §9.4: exactly 20 results per page, paginated in the database. */
export const RESULTS_PER_PAGE = 20;

/**
 * Filters travel in the URL as one compact param so that a search is
 * shareable and the back button works — and, more importantly, so DONE
 * produces exactly one navigation and one query (PRD §9.2).
 */
export function encodeFilters(filters: Partial<Filters>): string {
  const entries = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export function decodeFilters(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  const raw = params instanceof URLSearchParams
    ? Object.fromEntries(params.entries())
    : Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
      );
  const parsed = filterSchema.safeParse(raw);
  return parsed.success ? parsed.data : filterSchema.parse({});
}
