/**
 * Applies supabase/migrations/*.sql directly against a Postgres connection
 * string, tracking applied versions in the same supabase_migrations.schema_migrations
 * table the Supabase CLI uses — so this stays compatible with `supabase db push`
 * once the CLI is authenticated (it will see these versions as already applied
 * and skip them, rather than failing on existing objects).
 *
 * Exists because linking the Supabase CLI needs an interactive `supabase login`
 * (a personal access token), which isn't available in a non-interactive
 * environment. This needs only the database connection string, which the
 * project owner already has from the Supabase dashboard.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" \
 *     node scripts/push-migrations.mjs
 *
 * Safe to re-run: already-applied migrations are skipped.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL to the Postgres connection string from Supabase → Settings → Database.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase's pooler/direct endpoints present a cert that isn't always in
  // the local trust store; this script only ever runs against a connection
  // string the operator supplied directly, not user input.
  ssl: { rejectUnauthorized: false },
});

function versionAndName(filename) {
  const match = filename.match(/^(\d+)_(.+)\.sql$/);
  if (!match) throw new Error(`Migration filename doesn't match NNNN_name.sql: ${filename}`);
  return { version: match[1], name: match[2] };
}

await client.connect();

try {
  await client.query(`create schema if not exists supabase_migrations`);
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations (
      version text not null primary key,
      statements text[],
      name text
    )
  `);

  const { rows: applied } = await client.query(
    `select version from supabase_migrations.schema_migrations`,
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  let ranCount = 0;
  for (const file of files) {
    const { version, name } = versionAndName(file);
    if (appliedVersions.has(version)) {
      console.log(`  = ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)`,
        [version, name, [sql]],
      );
      await client.query("commit");
      console.log(`  ✓ ${file}`);
      ranCount += 1;
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${file} failed: ${error.message}`);
    }
  }

  console.log(ranCount ? `\n${ranCount} migration(s) applied.` : "\nAlready up to date.");
} finally {
  await client.end();
}
