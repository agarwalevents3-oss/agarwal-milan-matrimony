# Matrimonial Platform

Implementation of `docs/Matrimonial_Website_PRD.docx` — a verified matrimonial
service built on Next.js, Supabase and Vercel.

**Start here:** [`docs/STATUS.md`](docs/STATUS.md) for what is built and what is
not. [`docs/DECISIONS.md`](docs/DECISIONS.md) for why the architecture looks the
way it does.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Database | Supabase Postgres, Row Level Security on every table |
| Auth | Supabase Auth, native phone identity, our own OTP service |
| Storage | Supabase Storage, four buckets |
| Server logic | Next.js Route Handlers (Node runtime) |
| Hosting | Vercel |
| Tests | Vitest + PGlite (in-process Postgres), Playwright (E2E) |

---

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in the Supabase values
npm run check                     # typecheck, lint, schema, tests
npm run dev
```

`npm run check` works with no Supabase project at all — the schema and all
database tests run against an in-process Postgres. `npm run check:all` adds the
production build, the secret scan and the end-to-end suite.

### Connecting a Supabase project

1. Create a project (region `ap-south-1` for Indian users).
2. Copy the URL, anon key and service-role key into `.env.local`.
3. Generate the three server secrets:
   ```bash
   openssl rand -base64 48   # REGISTRATION_TICKET_SECRET
   openssl rand -base64 48   # OTP_HASH_SECRET
   openssl rand -base64 32   # CRON_SECRET
   ```
4. Auth identity: by default `AUTH_IDENTITY_STRATEGY=synthetic-email`, which
   needs no dashboard configuration. Supabase's native Phone provider requires
   a configured SMS provider (Twilio, etc.) before it can even be enabled —
   confirmed against a live project — so it is not the default. See decision 13
   in `docs/DECISIONS.md` if you want to switch once a provider is set up.
5. Apply the migrations. If you can run `supabase login` interactively:
   ```bash
   npx supabase link --project-ref <ref>
   npm run db:push
   ```
   Otherwise, apply them directly with the database connection string from
   Supabase → Settings → Database (no CLI login needed):
   ```bash
   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     npm run db:push:direct
   ```
   Either way, applied versions are tracked in
   `supabase_migrations.schema_migrations`, so re-running is safe and the two
   methods stay compatible with each other.
6. Create the administrator:
   ```bash
   # set ADMIN_SEED_PHONE and ADMIN_SEED_PASSWORD in .env.local first
   npm run seed:admin
   ```
   Then rotate `ADMIN_SEED_PASSWORD`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run check` | Typecheck + lint + schema + tests — run this before pushing |
| `npm test` | Unit and database tests (88) |
| `npm run test:e2e` | End-to-end tests (81) |
| `npm run check:all` | Everything, including build and E2E |
| `npm run test:db` | Security and business-rule tests only |
| `npm run verify:schema` | Applies every migration to a throwaway Postgres |
| `npm run verify:no-secrets` | Fails if a secret reached the client bundle |
| `npm run gen:types` | Regenerates `types/database.ts` from the migrations |
| `npm run db:push` | Applies migrations via the Supabase CLI (needs `supabase login`) |
| `npm run db:push:direct` | Applies migrations directly via `SUPABASE_DB_URL`, no CLI login needed |
| `npm run seed:admin` | Creates the single administrator |

**After changing any migration, run `npm run gen:types`.** The types are
introspected from the schema, so they cannot drift — but only if you regenerate.

---

## How this codebase is organised

```
app/
  (public)/     Home, Contact — static + ISR, CMS-driven, ~free to serve
  (auth)/       Login, the registration wizard
  (app)/        Signed-in area: payment, status, dashboard
  api/          Route Handlers — the serverless functions
lib/
  supabase/     client (browser) · server (cookies) · anon (cacheable) · admin (service role)
  services/     otp · payment · storage · upload · content
  validation/   Zod schemas shared by client and server
  auth/         guards · identity adapter · status routing
supabase/
  migrations/   The schema. Applied by CI, never by hand in the dashboard.
tests/
  db/           RLS and business rules against a real Postgres
  unit/         Pure logic
```

---

## The security model in one paragraph

The anon key ships to the browser by design; the database is directly reachable
by anyone who opens devtools. What protects the data is **Row Level Security on
all 18 tables**, plus triggers that enforce the registration state machine, keep
Aadhaar immutable, and refuse to verify an unpaid registration. Route guards
exist for user experience, not security. The service-role key is read in exactly
one file (`lib/supabase/admin.ts`); a lint rule and a build-time bundle scan keep
it that way. `tests/db/` proves the policies behave — **it is the suite to keep
green above all others.**

---

## Deploying

Vercel picks up `main` automatically once the repo is connected. Set the
environment variables from `.env.example` in the Vercel project — **nothing
secret may carry a `NEXT_PUBLIC_` prefix**; the build fails if one does.

`vercel.json` schedules the nightly retention sweep, which purges expired OTP
records, stale rate-limit buckets, old read notifications and abandoned drafts.

CI applies migrations to production on push to `main`. It needs
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` as
repository secrets.
