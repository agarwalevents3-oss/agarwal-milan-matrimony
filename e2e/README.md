# End-to-end tests

## What runs today

`npm run test:e2e` covers everything that does not require a live database:

- the public website renders and is navigable on desktop and phone
- access control: unauthenticated visitors cannot reach member or admin areas
- form validation on login and registration
- the API contract — validation errors, auth errors, and their status codes
- accessibility basics: landmarks, labels, skip link, focus order

These run against placeholder Supabase credentials, which is why the content
falls back to built-in defaults. That is deliberate: it also proves the site
degrades gracefully when the database is unreachable.

## What needs a real project

The full journey — register → OTP → payment → admin verification → search →
interest → match — needs a Supabase project, because it writes rows.

To enable it:

1. Point a **staging** Supabase project at a throwaway database.
2. Put its credentials in `.env.test.local`.
3. Run `npm run db:push` against it, then `npm run seed:admin`.
4. Set `E2E_LIVE=1` and run `npm run test:e2e`.

Tests that need a live project are guarded with `test.skip(!process.env.E2E_LIVE)`,
so they are skipped rather than failing when it is absent.

**Never point these at production.** They create and delete accounts.
