/**
 * Error handling for Route Handlers.
 *
 * PRD §22: users get a clear message, and internal database or stack detail
 * never crosses the wire. Everything unrecognised becomes a generic message
 * plus a server-side log, so a Postgres error string can't leak schema details
 * to an attacker probing the API.
 */
import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code: string = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest   = (m: string) => new AppError(m, 400, "BAD_REQUEST");
export const unauthorized = (m = "Please log in to continue.") => new AppError(m, 401, "UNAUTHORIZED");
export const forbidden    = (m = "You do not have access to this.") => new AppError(m, 403, "FORBIDDEN");
export const notFound     = (m = "Not found.") => new AppError(m, 404, "NOT_FOUND");
export const conflict     = (m: string) => new AppError(m, 409, "CONFLICT");
export const tooManyRequests = (m = "Too many attempts. Please wait a moment and try again.") =>
  new AppError(m, 429, "RATE_LIMITED");

/**
 * Postgres error codes our functions raise deliberately, mapped to the message
 * and status a user should see. Anything not listed here is treated as a bug.
 */
const PG_CODE_STATUS: Record<string, number> = {
  "42501": 403, // insufficient privilege — our guards raise this
  "23505": 409, // unique violation — duplicate interest
  "23514": 400, // check violation — illegal transition, self-interest
  "22023": 400, // invalid parameter — already answered
  "P0002": 404, // no data found
};

interface PostgrestLike { code?: string; message?: string }

export function fromPostgres(error: PostgrestLike): AppError {
  const status = error.code ? PG_CODE_STATUS[error.code] : undefined;
  if (status && error.message) {
    // Our own RAISE messages are written for users, so they are safe to pass on.
    return new AppError(error.message.replace(/^ERROR:\s*/, ""), status, error.code!);
  }
  return new AppError("Something went wrong. Please try again.", 500, "INTERNAL");
}

/** Wraps a handler so no unexpected error can escape as a raw message. */
export function handleError(error: unknown, context: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  const pg = error as PostgrestLike;
  if (pg?.code && PG_CODE_STATUS[pg.code]) {
    const mapped = fromPostgres(pg);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  // Unknown: log everything server-side, tell the user nothing specific.
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "INTERNAL" },
    { status: 500 },
  );
}
