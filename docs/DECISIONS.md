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

## 13. The phone-identity fallback

We use Supabase's native phone identity: `auth.users.phone` is the credential
and `signInWithPassword({ phone, password })` needs no SMS provider, because our
own OTP service owns verification.

**This is unverified against a live Supabase project** — see `docs/STATUS.md`.
If a project refuses to enable the phone provider without SMS credentials,
`lib/auth/identity.ts` switches `STRATEGY` to `"synthetic-email"` and nothing
else changes: everything downstream keys off `auth.uid()`.
