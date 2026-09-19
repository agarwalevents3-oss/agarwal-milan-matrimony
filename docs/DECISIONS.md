# Architecture decisions

Written for the engineers who will build on and operate this codebase.

Each entry records a decision that is not obvious from reading the code, and —
more importantly — what it costs and when it should be revisited.

---

## 1. `users` and `profiles` are split by privacy, not by normalisation

`public.users` holds mobile and email. `public.profiles` holds everything a
verified member is allowed to see.

The PRD's hardest privacy rule is that one member must never see another's phone
number (§8.2). If contact details lived on `profiles`, honouring that would need
column-level grants or a view that every query had to remember to use — one
forgotten `select *` and the number leaks.

With the split, the `profiles` read policy is a plain row-level rule and is safe
*by construction*: there is nothing sensitive on the table to leak. Aadhaar is
not a column anywhere; it exists only as a row in `documents` pointing at a
private bucket.

**Cost:** one extra join whenever a screen genuinely needs both.

---

## 2. A match requires accepted interest in *both* directions

PRD §10.4 reads: "B accepts A's interest → check whether A has an accepted
interest toward B → if NO: no match".

Taken literally that check is circular — the interest A sent is the one B just
accepted, so it would always be true and the "if NO" branch would be dead. The
only reading under which the branch means anything is that a match needs
interests in both directions, each accepted.

So: A sends to B, B accepts. Then B sends to A, A accepts. *Now* they match.

**This is the one place we interpreted an ambiguous spec rather than
implementing it verbatim.** If the intent was "accepting creates a match
immediately", the change is small and confined to `respond_to_interest()` in
migration 0003 — delete the reciprocal lookup and always create the match.

---

## 3. The profile photo bucket is public

A product decision, made deliberately: public objects are CDN-cacheable, cost
nothing to sign, and make the 20-card grid as fast as it can be.

The exposure is that a leaked URL keeps working. Three things contain it:

- paths are `{userId}/{nanoid(21)}.webp`, so a URL cannot be derived from a
  user id;
- suspending or deleting an account **hard-deletes the objects**
  (`/api/admin/suspend-user`, `/api/admin/delete-user`);
- replacing a photo writes a new random path and deletes the old one.

Aadhaar and certificates are in private buckets and are never affected by this.

**Revisit if** members start reporting that photos circulate outside the
platform. The switch is `public: false` in migration 0006 plus batch-signed URLs
in the search query — roughly a day's work.

---

## 4. Uploads go from the browser straight to Storage

Not through a Route Handler. Multi-megabyte scans would otherwise consume
serverless bandwidth and execution time on every registration.

This is safe because size and MIME limits are declared on the bucket and
enforced by Supabase server-side, and because `verifyUploadedObject()` reads the
object's **real** size and type back from the Storage API before any metadata
row is written. The browser's claims about what it uploaded are never trusted.

---

## 5. Registration creates the account early, in `DRAFT`

The account exists from the moment the password is set, before the profile is
complete.

This falls out of decision 4: storage policies pin writes to
`auth.uid()`-prefixed paths, so the uploader has to *be* someone. The
alternative — staging uploads in a temporary folder and moving them once the
user exists — costs a second copy of every file and a move that can fail
halfway.

It also matches PRD §14, which already defines `DRAFT` as "registration is being
created", and it makes signup resumable: an interrupted registration is just a
draft the user can log back into.

**Cost:** abandoned drafts hold a mobile number. `purge_abandoned_drafts()`
clears them after 14 days, and the nightly cron deletes the matching auth users.

---

## 6. Authorisation lives in the database

RLS policies, `SECURITY DEFINER` functions and triggers — not route guards.

The anon key ships to the browser by design, so the database is directly
reachable by anyone who opens devtools. Route guards would be decoration. What
actually protects the data is:

- RLS on all 18 tables (verified by `npm run verify:schema`);
- a trigger that rejects illegal registration transitions;
- a trigger that refuses to verify an unpaid registration;
- triggers that make Aadhaar immutable and lock core identity fields;
- unique constraints that make duplicate interests and duplicate matches
  structurally impossible.

None of these can be bypassed by a bug in a Route Handler. `tests/db/` is where
that is proven, and it is the suite to keep green above all others.

---

## 7. `is_admin()` reads the JWT; `is_verified_user()` reads the table

Deliberately inconsistent.

`is_admin()` reads `app_metadata.role` from the token because reading the
`users` table would recurse through that table's own policy, which calls
`is_admin()`.

`is_verified_user()` reads the database, so that **suspension takes effect on
the very next request** rather than whenever the user's token happens to
refresh. That costs one index lookup against a denormalised boolean; correct
revocation is worth more.

The admin role is checked twice regardless — RLS reads the claim, the server
guards re-read the table — so a tampered token alone achieves nothing.

---

## 8. `is_verified`, `city` and `state` are denormalised onto `profiles`

Maintained by triggers from `registrations` and `addresses`.

Search is the highest-traffic query in the product. Denormalising lets it be a
single-table lookup against a partial index (`where is_verified`), with no join
and no subquery in the RLS predicate. A partial index also needs an `IMMUTABLE`
predicate, which a subquery cannot provide.

**Cost:** correctness now depends on two triggers. Both are covered in
`tests/db/`.

---

## 9. Age is derived, never stored

`profiles.dob` is indexed; age filters are rewritten into dob ranges before the
query is built (`lib/utils/age.ts`).

A stored age column is wrong within a year of being written and cannot be
indexed usefully for range queries. The boundary arithmetic is fiddly, so it is
pinned by tests in `tests/unit/age.test.ts`.

`dob` is also locked once set, which stops a member editing their way into
someone else's age filter.

---

## 10. Aadhaar is masked and its number is never stored

The PRD mandates collecting Aadhaar. UIDAI guidance discourages storing full
copies, and the DPDP Act adds consent and retention duties.

So: the UI asks for a **masked** scan, the Aadhaar *number* is never a column,
consent is stored as evidence (the exact text shown, timestamp and IP), the
bucket is admin-only, the document is immutable once written, and deleting an
account destroys the file.

**The consent wording in `app/api/register/submit/route.ts` is placeholder text
and needs sign-off from counsel before launch.**

---

## 11. Rate limiting is a Postgres table

Not Redis. A fixed-window counter in `check_rate_limit()` costs one upsert,
needs no extra service and no extra bill. At this scale that is the right trade.

**Revisit above roughly 50 requests/second sustained**, where the write load
starts to matter.

---

## 12. The mock gateway signs for real

`MockPaymentProvider` computes a genuine HMAC over `orderId|paymentId`, and the
mock checkout goes through the same `/api/payment/verify` route as a live
gateway would.

The point is that the signature check, the failure branch and the state machine
are all genuinely exercised today. Turning on Razorpay changes the provider
class and two env vars — not the flow, and not any table.

---

## 13. Auth identity: synthetic email, not native phone (confirmed live, 2026-09-19)

The plan's stated preference was Supabase's native phone identity —
`auth.users.phone` as the credential, `signInWithPassword({ phone, password })`
needing no SMS provider because our own OTP service owns verification.

**Tested directly against the live project and it does not hold.** Creating a
user with a phone identity via `admin.createUser` works fine. But actually
signing in — `signInWithPassword({ phone, password })` — is rejected with
`phone_provider_disabled`, because Supabase's Phone provider is a project-level
toggle that is off by default. Attempting to enable it in the dashboard (see
screenshot in session, 2026-09-19) shows why: Supabase will not save the toggle
without a configured SMS provider (Twilio, MessageBird, ...) and real
credentials for it — even though that SMS provider is never actually used,
since our OTP service verifies the number before Supabase is ever involved.

Rather than requiring a Twilio account to be set up just to satisfy a toggle
neither of us wants to depend on, we switched to the synthetic-email identity:
`{mobile}@phone.internal` — a non-deliverable address — is used as the
Supabase Auth identity instead. Verified end-to-end against the live project:
create via `admin.createUser({ email, email_confirm: true })`, sign in via
`signInWithPassword({ email, password })`, both succeed.

This is controlled by `AUTH_IDENTITY_STRATEGY` (`lib/env.ts`), not a hardcoded
constant, because **two** places need to agree on it: `lib/auth/identity.ts`
(the Next.js runtime) and `scripts/seed-admin.mjs` (a plain Node script that
cannot import that file — no bundler, and the file is wrapped in
`"server-only"`). One environment variable is the actual seam; everything
downstream still keys off `auth.uid()`, never off how the identity was spelled.

**What this gives up:** the plan's future path of a real SMS provider wired in
through a Supabase Send-SMS Auth Hook, which needs the Phone provider enabled.
That path is closed while `AUTH_IDENTITY_STRATEGY=synthetic-email`. It is not a
significant loss — `lib/services/otp` already owns sending and verifying codes
at the application layer regardless of which identity strategy is active, so a
real SMS provider (MSG91, Twilio, ...) plugs in there exactly as originally
designed. Only the *login credential's shape* changed, not the OTP flow.

**To switch back**, if a Twilio (or similar) account is set up later: enable
the Phone provider in the Supabase dashboard, set
`AUTH_IDENTITY_STRATEGY=phone`, and existing synthetic-email accounts would
need a migration (Supabase has no built-in way to change a user's primary
identity type after creation) — plan for that rather than assuming it is free.

---

## 14. Profile search runs on the server, not in the browser

The original plan put the search query in the browser to avoid a serverless
invocation. Building it showed that reasoning was wrong.

The authenticated layout already resolves the session on the server, so the page
is being rendered there regardless. Adding the search to that same render costs
one more round trip inside an invocation we are already paying for — while the
client-side version would have paid for the render *and then* made the browser
wait through a second waterfall (HTML → JS → query) before showing anything.
Server-side is both cheaper and faster.

What did not change is the rule the PRD cares about: filters stay in local React
state until DONE, and DONE produces exactly one navigation and one query.
Putting the filters in the URL is what makes that work — and it makes a search
shareable and the back button correct as a bonus.

---

## 15. Partner preferences are shared; family details are not

A verified member can see another verified member's partner preferences
(migration 0009). Those are written specifically to be read by prospective
matches, so sharing them is the whole point.

`family_details` deliberately has no such policy. It contains parents' and
siblings' names — third parties who never signed up for anything and cannot
consent on their own behalf. They stay visible to their owner and the admin
only.

The PRD does not settle this either way; §8.2 says only "permitted profile
information". This is where we drew the line and why.

---

## 16. Profile photos bypass Next.js image optimisation

`components/ui/ProfilePhoto` renders a plain `<img>`, not `next/image`.

The two renditions are already resized and WebP-encoded in the browser before
upload (240px thumb, 900px full). Running them through Vercel's optimiser would
add a per-image transformation cost — metered on every plan — for files that are
already exactly the size they will be displayed at. They are served straight
from Supabase's CDN with a one-year cache header instead.

This is the other half of the storage decision in §3: compress once at upload,
serve the same bytes forever.

---

## 17. The admin reads through its own session, not the service role

`lib/services/admin.ts` queries with the admin's cookie session. The admin RLS
policies already grant full visibility, so reaching for the service role would
add nothing except a key that bypasses every policy.

The practical benefit: if the admin role is ever revoked, those queries stop
returning data on the very next request. With the service role they would keep
working until someone noticed.

The heavier reports (`admin_dashboard_stats`, `admin_recent_activity`,
`admin_registration_list`) are `SECURITY DEFINER` because they aggregate across
every member — so each one re-checks `is_admin()` internally before returning a
single row. That is tested in `tests/db/rls.test.ts`.

---

## 18. Every admin document view is audit-logged

`/api/admin/document-url` hands back a five-minute signed URL for one document,
looked up by id — the browser never receives a storage path.

Each request writes to `audit_log` with the document type and whose it was.
Looking at somebody's Aadhaar is exactly the kind of action that should leave a
trace, and a five-minute expiry means a link pasted into a chat stops working
almost immediately.
