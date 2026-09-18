/** Applies every migration to a throwaway Postgres and reports what was built. */
import { createTestDb } from "./pg-harness.mjs";

console.log("Applying migrations to an in-process Postgres…\n");

const db = await createTestDb({ quiet: false });

const counts = await db.query(`
  select
    (select count(*) from pg_tables  where schemaname = 'public')                        as tables,
    (select count(*) from pg_views   where schemaname = 'public')                        as views,
    (select count(*) from pg_policies where schemaname in ('public', 'storage'))         as policies,
    (select count(*) from pg_indexes where schemaname = 'public')                        as indexes,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public')                                                       as functions,
    (select count(*) from pg_trigger where not tgisinternal)                             as triggers,
    (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public' and t.typtype = 'e')                                   as enums,
    (select count(*) from storage.buckets)                                               as buckets
`);

console.log("\nSchema built:");
for (const [key, value] of Object.entries(counts.rows[0])) {
  console.log(`  ${String(key).padEnd(10)} ${value}`);
}

// Every table must have RLS on. A single false here is a security hole.
const unprotected = await db.query(`
  select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`);

if (unprotected.rows.length) {
  console.error("\n✗ Tables WITHOUT row level security:");
  for (const r of unprotected.rows) console.error(`    ${r.relname}`);
  process.exit(1);
}

console.log("\n✓ Row level security is enabled on every public table.");
await db.close();
