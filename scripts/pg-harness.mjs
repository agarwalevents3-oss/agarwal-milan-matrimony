/**
 * In-process Postgres harness for verifying the schema without Docker.
 *
 * PGlite is a real Postgres compiled to WASM, so migrations are parsed and
 * executed by the actual planner — typos, bad constraints, broken policies and
 * faulty trigger logic all surface here. What it is NOT is Supabase: the auth
 * and storage schemas are stubbed below to match Supabase's real definitions
 * closely enough to exercise our code.
 *
 * Use it for fast local verification. `npm run test:rls` against a real
 * Supabase branch remains the authority before release.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

/** Mirrors the parts of a Supabase project our migrations depend on. */
const SUPABASE_STUB = `
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

-- Supabase ships these roles; our GRANT/REVOKE statements target them.
do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- auth.users: only the columns we reference.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique,
  email         text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Supabase resolves the current user from the request's JWT claims, which PostgREST
-- puts in the request.jwt.claims GUC. Same mechanism here, so tests can
-- impersonate a user with: set local request.jwt.claims = '{"sub": "...", ...}'
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- storage: enough of the real shape for bucket rows and object policies.
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Real Supabase implementation: path segments excluding the filename.
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant all on storage.buckets to anon, authenticated, service_role;
`;

export async function loadMigrations() {
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      sql: await readFile(path.join(MIGRATIONS, file), "utf8"),
    })),
  );
}

/**
 * Boots Postgres, installs the Supabase stubs, then applies every migration in
 * order. Throws with the offending filename if one fails.
 */
export async function createTestDb({ quiet = true } = {}) {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto } });

  await db.exec(SUPABASE_STUB);

  for (const { file, sql } of await loadMigrations()) {
    try {
      await db.exec(sql);
      if (!quiet) console.log(`  ✓ ${file}`);
    } catch (error) {
      error.message = `Migration ${file} failed:\n${error.message}`;
      throw error;
    }
  }

  return db;
}

/**
 * Runs `fn` as a specific end user, exactly as PostgREST would: the
 * `authenticated` Postgres role (so RLS applies) with the uid in the JWT claims.
 */
export async function asUser(db, userId, sql, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await db.exec("set local role authenticated");
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

/** Same, but with an admin JWT claim (app_metadata.role = 'admin'). */
export async function asAdmin(db, userId, sql, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({
        sub: userId,
        role: "authenticated",
        app_metadata: { role: "admin" },
      }),
    ]);
    await db.exec("set local role authenticated");
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

/** Anonymous visitor: the `anon` role with no claims at all. */
export async function asAnon(db, sql, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, ["{}"]);
    await db.exec("set local role anon");
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}
