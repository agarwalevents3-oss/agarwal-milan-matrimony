import type { PGlite } from "@electric-sql/pglite";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  affectedRows?: number;
}

export function createTestDb(opts?: { quiet?: boolean }): Promise<PGlite>;
export function loadMigrations(): Promise<{ file: string; sql: string }[]>;
export function asUser<T = Record<string, unknown>>(
  db: PGlite, userId: string, sql: string, params?: unknown[]
): Promise<QueryResult<T>>;
export function asAdmin<T = Record<string, unknown>>(
  db: PGlite, userId: string, sql: string, params?: unknown[]
): Promise<QueryResult<T>>;
export function asAnon<T = Record<string, unknown>>(
  db: PGlite, sql: string, params?: unknown[]
): Promise<QueryResult<T>>;
