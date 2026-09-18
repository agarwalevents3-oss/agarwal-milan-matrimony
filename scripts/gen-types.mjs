/**
 * Generates types/database.ts by introspecting the real schema.
 *
 * `supabase gen types` needs Docker or a linked project; this needs neither, so
 * the types stay in step with the migrations from the first commit. Re-run with
 * `npm run gen:types` after changing any migration.
 */
import { writeFile } from "node:fs/promises";
import { createTestDb } from "./pg-harness.mjs";

const db = await createTestDb();

/** format_type() spellings, which differ from pg_type.typname. */
const RAW_TO_TS = {
  "uuid": "string", "text": "string", "boolean": "boolean", "jsonb": "Json", "json": "Json",
  "integer": "number", "bigint": "number", "smallint": "number", "numeric": "number",
  "double precision": "number", "real": "number",
  "timestamp with time zone": "string", "timestamp without time zone": "string",
  "date": "string", "time without time zone": "string", "inet": "string",
  "void": "undefined", "record": "Json",
};

const PG_TO_TS = {
  uuid: "string", text: "string", varchar: "string", inet: "string",
  int2: "number", int4: "number", int8: "number", numeric: "number", float8: "number",
  bool: "boolean",
  timestamptz: "string", timestamp: "string", date: "string", time: "string",
  jsonb: "Json", json: "Json",
  tsvector: "unknown",
};

const enums = await db.query(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   group by t.typname order by t.typname
`);
const enumNames = new Set(enums.rows.map((e) => e.name));

const relations = await db.query(`
  select c.relname as name, c.relkind as kind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v')
   order by c.relkind, c.relname
`);

const columns = await db.query(`
  select c.relname as table_name,
         a.attname  as column_name,
         format_type(a.atttypid, null) as full_type,
         t.typname  as type_name,
         a.attnotnull as not_null,
         (pg_get_expr(d.adbin, d.adrelid) is not null) as has_default,
         a.attidentity <> '' or a.attgenerated <> '' as generated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
   order by c.relname, a.attnum
`);

function tsType(col) {
  if (enumNames.has(col.type_name)) return `Enums["${col.type_name}"]`;
  return PG_TO_TS[col.type_name] ?? "unknown";
}

// Foreign keys, so PostgREST embedded selects (`select("*, users(...)")`) are
// type-checked rather than stubbed with an empty Relationships array.
const fkeys = await db.query(`
  select con.conname                       as name,
         src.relname                       as table_name,
         tgt.relname                       as referenced_relation,
         array(select attname from pg_attribute
                where attrelid = con.conrelid and attnum = any(con.conkey)) as columns,
         array(select attname from pg_attribute
                where attrelid = con.confrelid and attnum = any(con.confkey)) as referenced_columns,
         exists (
           select 1 from pg_index i
            where i.indrelid = con.conrelid and i.indisunique
              and i.indkey::int2[] @> con.conkey and con.conkey @> i.indkey::int2[]
         )                                 as is_one_to_one
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
   where con.contype = 'f' and n.nspname = 'public'
   order by src.relname, con.conname
`);

const relsByTable = new Map();
for (const fk of fkeys.rows) {
  if (!relsByTable.has(fk.table_name)) relsByTable.set(fk.table_name, []);
  relsByTable.get(fk.table_name).push(fk);
}

function relationshipsBlock(tableName, indent) {
  const rels = relsByTable.get(tableName) ?? [];
  if (!rels.length) return [`${indent}Relationships: [];`];
  const out = [`${indent}Relationships: [`];
  for (const r of rels) {
    out.push(
      `${indent}  {`,
      `${indent}    foreignKeyName: "${r.name}";`,
      `${indent}    columns: [${r.columns.map((c) => `"${c}"`).join(", ")}];`,
      `${indent}    isOneToOne: ${r.is_one_to_one};`,
      `${indent}    referencedRelation: "${r.referenced_relation}";`,
      `${indent}    referencedColumns: [${r.referenced_columns.map((c) => `"${c}"`).join(", ")}];`,
      `${indent}  },`,
    );
  }
  out.push(`${indent}];`);
  return out;
}

const byTable = new Map();
for (const c of columns.rows) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
  byTable.get(c.table_name).push(c);
}

const lines = [
  "// AUTO-GENERATED by `npm run gen:types` — do not edit by hand.",
  "// Introspected from supabase/migrations/, so these types cannot drift from the schema.",
  "",
  "export type Json =",
  "  | string | number | boolean | null",
  "  | { [key: string]: Json | undefined }",
  "  | Json[];",
  "",
  "export interface Database {",
  "  public: {",
  "    Tables: {",
];

for (const rel of relations.rows.filter((r) => r.kind === "r")) {
  const cols = byTable.get(rel.name) ?? [];
  lines.push(`      ${rel.name}: {`);
  lines.push("        Row: {");
  for (const c of cols) lines.push(`          ${c.column_name}: ${tsType(c)}${c.not_null ? "" : " | null"};`);
  lines.push("        };");
  lines.push("        Insert: {");
  for (const c of cols) {
    if (c.generated) continue;
    const optional = !c.not_null || c.has_default;
    lines.push(`          ${c.column_name}${optional ? "?" : ""}: ${tsType(c)}${c.not_null ? "" : " | null"};`);
  }
  lines.push("        };");
  lines.push("        Update: {");
  for (const c of cols) {
    if (c.generated) continue;
    lines.push(`          ${c.column_name}?: ${tsType(c)}${c.not_null ? "" : " | null"};`);
  }
  lines.push("        };");
  lines.push(...relationshipsBlock(rel.name, "        "));
  lines.push("      };");
}

lines.push("    };", "    Views: {");
for (const rel of relations.rows.filter((r) => r.kind === "v")) {
  const cols = byTable.get(rel.name) ?? [];
  lines.push(`      ${rel.name}: {`, "        Row: {");
  for (const c of cols) lines.push(`          ${c.column_name}: ${tsType(c)}${c.not_null ? "" : " | null"};`);
  lines.push("        };");
  lines.push("        Relationships: [];");
  lines.push("      };");
}
// Callable RPCs. Trigger functions are excluded: they return `trigger` and are
// never invoked over PostgREST.
// proargnames covers IN *and* OUT parameters, so a `RETURNS TABLE (...)`
// function would otherwise report its result columns as arguments. proargmodes
// distinguishes them: i = in, b = inout, v = variadic; o/t are outputs.
// When proargmodes is NULL every parameter is IN.
const functions = await db.query(`
  select p.proname as name,
         coalesce(
           case
             when p.proargmodes is null then p.proargnames
             else array(
               select name from unnest(p.proargnames, p.proargmodes) as u(name, mode)
                where u.mode in ('i', 'b', 'v')
             )
           end,
           array[]::text[]
         ) as arg_names,
         array(select format_type(t, null) from unnest(p.proargtypes) as t) as arg_types,
         p.pronargdefaults as n_defaults,
         format_type(p.prorettype, null) as return_type
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and format_type(p.prorettype, null) <> 'trigger'
   order by p.proname
`);

lines.push("    };", "    Functions: {");
for (const fn of functions.rows) {
  // Trailing arguments with DEFAULTs are optional over PostgREST, exactly as
  // they are in SQL — otherwise every caller is forced to pass a placeholder.
  const firstDefaulted = fn.arg_names.length - (fn.n_defaults ?? 0);
  const args = fn.arg_names
    .map((name, i) => {
      const pgType = (fn.arg_types[i] ?? "").replace(/^public\./, "").replace(/\[\]$/, "");
      const base = enumNames.has(pgType) ? `Enums["${pgType}"]` : (PG_TO_TS[pgType] ?? RAW_TO_TS[pgType] ?? "unknown");
      const optional = i >= firstDefaulted;
      return `${name}${optional ? "?" : ""}: ${base}${optional ? " | null" : ""}`;
    })
    .join("; ");
  const ret = fn.return_type.replace(/^public\./, "");
  const isArray = ret.endsWith("[]");
  const retBase = ret.replace(/\[\]$/, "");
  const retInner = RAW_TO_TS[retBase] ?? PG_TO_TS[retBase]
    ?? (byTable.has(retBase) ? `Tables<"${retBase}">` : "Json");
  const retTs = isArray ? `${retInner}[]` : retInner;
  lines.push(`      ${fn.name}: { Args: ${args ? `{ ${args} }` : "Record<string, never>"}; Returns: ${retTs} };`);
}

lines.push("    };", "    CompositeTypes: Record<string, never>;", "    Enums: {");
for (const e of enums.rows) {
  lines.push(`      ${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")};`);
}
lines.push("    };", "  };", "}", "");
lines.push("export type Enums = Database[\"public\"][\"Enums\"];");
lines.push("export type Tables<T extends keyof Database[\"public\"][\"Tables\"]> =");
lines.push("  Database[\"public\"][\"Tables\"][T][\"Row\"];");
lines.push("export type Views<T extends keyof Database[\"public\"][\"Views\"]> =");
lines.push("  Database[\"public\"][\"Views\"][T][\"Row\"];");
lines.push("");

await writeFile("types/database.ts", lines.join("\n"));
await db.close();
console.log(`types/database.ts written — ${relations.rows.length} relations, ${enums.rows.length} enums`);
