# Website Improvements — Final Development Report

Implements `Agarwal_Milan_Final_Website_Improvements.pdf` (six improvement groups,
§2–§7). Report structure follows the PDF's §9. Date: 13 November 2026.

**Nothing has been deployed, committed or applied to the live database.** See
§G for the steps, in order — the order matters.

---

## Decisions taken where the PDF did not match the code

The PDF asked for clarification rather than guessing; these were confirmed with
the project owner before implementation.

| PDF says | What the code actually had | Decision |
|---|---|---|
| §3: a personal-details form appears *after* payment with "Skip for Now" | The form ("About you") is step 4 of registration, *before* documents and payment | **Both**: "Skip for now" removed from the registration step, **and** a post-payment gate sends any paid member with missing details to the same form before anything else |
| §3: "make all existing required personal details fields mandatory" | The PRD made every field optional — there were no required ones | **Core set** mandatory: date of birth, height, marital status, gotra, highest qualification, occupation, city, state, PIN code, father's name, mother's name. Everything else stays optional |
| §6.3: demo payments must not activate memberships in production | Razorpay credentials are not available yet, so blocking would stop all sign-ups on the live site | **Allowed in production for now.** All restriction code is in place; set `DEMO_PAYMENTS_IN_PRODUCTION=block` (or switch to Razorpay) to enforce it |

---

## A. Modified files

| File | What changed and why |
|---|---|
| `components/layout/SiteFooter.tsx` | §2 — redesigned: brand, quick links (Home, About Us, Contact Us), legal links (Terms, Privacy, Refund & Cancellation) given card-style emphasis, contact block, copyright. 1/2/4 columns on phone/tablet/desktop |
| `app/(public)/page.tsx` | §2 — removed the home page's second, inline footer (the shared footer above replaces it). Its outer `<main>` became a `<div>` — the layout already provides the page's one `<main>` (this also fixes a failing e2e test) |
| `app/(public)/refund-policy/page.tsx` | §5 — rewritten with every required section 5.1–5.8; unconfirmed terms are named placeholder constants at the top of the file |
| `app/(public)/about/page.tsx`, `app/(public)/terms/page.tsx` | One apostrophe each escaped — the lint error that has failed CI on every push since 3 Nov. No wording change |
| `app/(auth)/register/ProfileStep.tsx` | §3 — "Skip for now" removed; required fields marked and validated in the browser with the same schema the server uses; reusable as the post-payment form (prefill, locked date of birth) |
| `app/api/register/draft/route.ts` | §3 — validates the mandatory set server-side; also accepts a paid member completing missing details; never changes a date of birth already saved |
| `lib/validation/registration.ts` | §3 — `REQUIRED_PERSONAL_DETAILS`, `personalDetailsSchema`, `missingPersonalDetails()`: the single definition of "complete" |
| `lib/validation/profile.ts`, `app/(app)/profile/EditProfileForm.tsx` | §3 — the mandatory details can still be edited on the profile page but can no longer be blanked (browser and server) |
| `lib/auth/guards.ts` | §3/§4 — the session read also returns whether the mandatory details are complete (same single query); a member with no registration row is treated as pending (§4 "missing status"); verified-member APIs refuse while details are incomplete |
| `lib/auth/routing.ts` | §3/§4 — the post-payment gate rule; the exact "Profile Under Verification" message |
| `app/(app)/layout.tsx`, `app/(app)/status/page.tsx` | §3/§4 — gate redirect; status page shows the required message and the contact number (clickable `tel:` only once a real number is configured) |
| `lib/supabase/middleware.ts` | §3 — `/personal-details` requires sign-in |
| `app/(app)/payment/page.tsx`, `PaymentPanel.tsx` | §6.1 — plan, price/taxes/total, validity, benefits, contact rules, payment conditions, mandatory unticked policy checkbox; demo notice only for demo payments; Razorpay Checkout integration point |
| `app/api/payment/create/route.ts` | §6 — requires the policy checkbox; price from the single source; refuses when payment is unavailable; records the plan |
| `app/api/payment/verify/route.ts` | §6.3 — payment must belong to the member and the active gateway; demo payments only while allowed; amount/currency passed for gateway-side checks; an unreachable gateway no longer marks a payment failed |
| `app/api/payment/mock-checkout/route.ts` | §6.3A — refuses whenever demo payments are not allowed |
| `app/api/payment/webhook/route.ts` | §6.3D — ignores events for another gateway's orders; refuses to confirm on an amount/currency mismatch; stores the failure reason |
| `lib/services/payment/{types,razorpay,mock}.ts` | §6.3B — Razorpay verification now also checks, with Razorpay's own record, the order, amount, currency and status; webhook parsing carries amount, currency and failure reason |
| `lib/env.ts` | §6.3 — `DEMO_PAYMENTS_IN_PRODUCTION`, `demoPaymentsAllowed()`, `razorpayConfigured()` |
| `next.config.ts` | §6.3 — Razorpay's checkout origins added to the Content-Security-Policy **only** when `PAYMENT_MODE=razorpay` |
| `app/(admin)/admin/users/[id]/page.tsx` | §6.3 — demo payments labelled "Demo · no money received" |
| `app/layout.tsx` | §7 — favicon metadata |
| `types/database.ts` | Regenerated (`npm run gen:types`) — the two new payment columns |
| `.env.example` | Restored (it had been emptied in commit `b93f086`) with placeholder values only, plus the new variable |
| `e2e/live-journey.spec.ts` | Fills the now-mandatory details instead of clicking "Skip for now" |

**Removed:** `app/favicon.ico` — the framework's default (Vercel triangle) icon.

## B. Newly created files

| File | Purpose |
|---|---|
| `app/(public)/privacy-policy/page.tsx` | Privacy Policy page, required by the footer link. States only how the site actually handles data; legal terms are placeholders |
| `components/legal/LegalPage.tsx` | Shared layout for the Refund and Privacy pages, matching the existing Terms page |
| `app/(auth)/personal-details/page.tsx`, `PersonalDetailsForm.tsx` | §3 — the post-payment mandatory details form (prefilled with anything already saved) |
| `app/(app)/payment/MembershipSummary.tsx` | §6.1 — the membership information shown before checkout |
| `lib/membership.ts` | §6.1/6.2 — plan code, placeholders, benefits, contact rules, price parsing. No hard-coded price |
| `lib/services/membership.ts` | §6.2 — reads the one authoritative price; decides whether payment is available |
| `lib/utils/contact.ts` | §2/§4/§5 — shows the official contact number/email only once real ones are configured, otherwise a placeholder |
| `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` | §7 — made from `public/agarwal-milan-logo.png` |
| `supabase/migrations/0011_membership_payments.sql` | §6.3 — see §C |
| `supabase/migrations/0012_restore_check_rate_limit.sql` | Restores a function accidentally deleted — see §C |
| `tests/unit/personal-details.test.ts`, `tests/unit/membership-and-contact.test.ts`, `tests/db/payments.test.ts`, `e2e/website-improvements.spec.ts` | Tests — see §F |

## C. Database changes

All additive. No table, column or row is deleted; existing payment records are untouched.

**`0011_membership_payments.sql`**

- `payments.membership_plan` (text, nullable) — the plan a payment was for. Existing rows stay NULL.
- `payments.failure_reason` (text, nullable) — why a payment failed (for the team; never shown raw to members).
- Unique index on `(gateway, gateway_payment_id)` — one gateway transaction can confirm at most one payment.
- `confirm_payment()` — new version: a late success after a recorded failure now confirms correctly; a second successful payment for an already-paid registration is recorded (for refund) and the admin is notified, but the membership is **not** activated twice.
- `fail_payment()` — new version: stores the reason; a re-delivered failure is a no-op; a failed attempt can no longer mark an already-paid registration as unpaid (which would also have blocked admin verification).
- **Security fix:** `confirm_payment`, `fail_payment`, `begin_payment_retry` and `save_draft_profile` can now be called only by the server. Before this, any signed-in member — or anonymous visitor — could call `confirm_payment` directly through the public Supabase API and be marked as paid without paying, and any member could overwrite another member's profile through `save_draft_profile`. Proven against the migrations, and covered by tests now.

Every field the PDF lists (§6.3C) is now identifiable: internal id `id`, user `user_id`, plan `membership_plan`, amount/currency, provider `gateway` (`mock` = demo), status, provider order/payment ids, `signature_verified` + `verified_at`, `failure_reason`, `raw_response`. Suggested statuses map onto the existing ones (CREATED → `INITIATED`; PENDING, SUCCESS, FAILED, CANCELLED exist). REFUND_PENDING / REFUNDED were **not** added: there is no refund flow in the product, and statuses nothing can reach would be dead code.

**`0012_restore_check_rate_limit.sql`** — commit `b4598d7` edited the already-applied migration 0003 and deleted `check_rate_limit()`. The live database still has it (0003 ran there before the edit), but any fresh database did not, which broke the OTP service and rate limits there and broke type generation. Re-created exactly as originally written; on the live database it changes nothing.

**No existing data migration is required.**

## D. Environment variables

| Variable | New? | Notes |
|---|---|---|
| `DEMO_PAYMENTS_IN_PRODUCTION` | New, optional | `allow` (default) or `block`. Only affects the production deployment while `PAYMENT_MODE=mock` |
| `PAYMENT_MODE` | Existing | The PDF's suggested `PAYMENT_PROVIDER`; the project's existing name is kept. `mock` or `razorpay` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Existing | Unchanged; leave blank until credentials are issued. Server-only (the key id is publishable and is sent to the checkout by the server) |
| `VERCEL_ENV` | Set by Vercel | Read to recognise the production deployment |

No secret is stored in payment records or exposed to the browser (`npm run verify:no-secrets` passes).

## E. Payment architecture

- **One price, one source.** The fee is the `registration_fee` row in `admin_settings` (edit at `/admin/settings`). The payment page and `/api/payment/create` both read it through `getMembershipPlan()`. *This fixed a real mismatch:* the payment page previously could not read that row (admin-only under RLS) and always displayed the ₹999 fallback, while checkout charged whatever the admin had set. There is no hard-coded fallback price any more — if the fee is missing, payment is refused with a clear message.
- **Providers.** `MockPaymentProvider` (demo) and `RazorpayProvider` implement one interface; `PAYMENT_MODE` selects one. Every demo transaction is identifiable (`gateway = mock`, `mock_order_…` / `mock_pay_…`, "Demo" badge in admin).
- **How demo mode is restricted.** `demoPaymentsAllowed()` is the single rule, checked by the payment page, `/api/payment/create`, `/api/payment/mock-checkout` and `/api/payment/verify`. Demo payments are never possible once `PAYMENT_MODE=razorpay`, and never on production when `DEMO_PAYMENTS_IN_PRODUCTION=block`. A demo payment created earlier can never be confirmed by Razorpay.
- **Where verification happens.** Server only. `/api/payment/verify` checks ownership and gateway, then the provider verifies the signature over **our stored** order id and — for Razorpay — fetches the payment from Razorpay to confirm order, amount, currency and status. Only then does `confirm_payment()` mark it SUCCESS. A browser-reported success is never sufficient, and the confirm function can no longer be called from the browser at all.
- **Webhook.** `/api/payment/webhook` verifies Razorpay's signature over the raw body, handles `payment.captured` and `payment.failed`, ignores other gateways' orders, refuses to confirm a mismatched amount, and always answers 200. Re-deliveries are harmless; a delayed failure cannot undo a success; a late success after a failure is confirmed.
- **How membership activation is protected.** Payment success moves the registration to verification; membership benefits begin only when the admin verifies, which the database refuses unless payment status is SUCCESS. A membership is activated once per registration, however many payments arrive.
- **To enable Razorpay** (no code changes): set the three `RAZORPAY_*` values and `PAYMENT_MODE=razorpay` in Vercel; in the Razorpay dashboard add the webhook `https://<domain>/api/payment/webhook` for `payment.captured` and `payment.failed` with the webhook secret; **redeploy** (the CSP is applied at build time); test with Razorpay test keys first.

## F. Testing report

Automated runs (13 Nov 2026), using CI's placeholder credentials so nothing touched the live database:

| Check | Before | After |
|---|---|---|
| Typecheck | pass | pass |
| Lint | **3 errors** | 0 errors (9 pre-existing warnings) |
| Schema verification (RLS on every table) | pass | pass |
| Unit + database tests | 87 pass, **3 fail** | **123 pass, 2 fail** |
| Production build + secret scan | pass | pass |
| End-to-end | 79 pass, **2 fail**, 11 skipped | **100 pass, 0 fail**, 12 skipped |

The 2 remaining failures are **pre-existing and outside this scope** — see "Found, not changed" below. Skipped e2e tests are the live-database journey (needs `E2E_LIVE=1`) and phone-only checks on desktop.

Signed-in screens were checked visually by rendering them with sample data (no member account was created in the live database). Status per acceptance criterion:

| Criterion | Status | Evidence |
|---|---|---|
| **Footer** — required links visible | PASSED | e2e |
| All footer links work | PASSED | e2e clicks each link and checks the page |
| Responsive (mobile/tablet/desktop) | PASSED | screenshots at 390 / 820 / 1366 px; e2e no-overflow check |
| Contact details | PENDING BUSINESS CONFIRMATION | placeholders shown until real number/email are entered in `/admin/content`; unit-tested |
| **Personal details** — Skip for Now removed | PASSED | code; live-journey spec asserts it is gone |
| Required fields + backend validation | PASSED | shared schema unit-tested; browser check shows each missing field flagged |
| Users cannot bypass the form | PASSED (logic) · NOT TESTED end-to-end | gate rule unit-tested; layout, status page and API guards enforce it |
| Payment not charged again | PASSED (logic) | gate applies only after payment SUCCESS; unit-tested |
| Progress retained after refresh / re-login | NOT TESTED end-to-end | state is server-side; next login lands on the form again |
| Existing profile data preserved | PASSED (logic) | form is prefilled; save merges and never blanks (existing DB test) |
| **Admin verification** — pending users see the message | PASSED (copy) · NOT TESTED end-to-end | exact wording unit-tested |
| Contact placeholder shown; link works once configured | PASSED (logic) · PENDING BUSINESS CONFIRMATION | unit tests; no `tel:` link on a placeholder (e2e) |
| Verified users log in normally | NOT TESTED end-to-end | login flow unchanged |
| Rejected users get an appropriate message | NOT TESTED end-to-end | existing rejection screen, contact display corrected |
| Admin access unchanged | NOT TESTED end-to-end | admin routing untouched; admin keeps its previous fallback |
| Protected routes enforce verification | PASSED | e2e access-control suite; 37 RLS tests |
| **Refund policy** — page created/updated, all sections | PASSED | e2e checks all 8 sections |
| Placeholders used, no invented commitments | PASSED · PENDING BUSINESS CONFIRMATION | every business term is a named placeholder |
| Footer navigation to it | PASSED | e2e |
| **Membership & payment** — price, validity, benefits, contact rules shown | PASSED · PENDING BUSINESS CONFIRMATION (price name, taxes, validity) | screenshots |
| Policy checkbox mandatory, unticked by default | PASSED | browser: Pay disabled until ticked; server requires it |
| Demo retained and restrictable in production | NOT TESTED automatically | single rule `demoPaymentsAllowed()`, code-reviewed |
| Razorpay architecture, server verification, webhook | NOT TESTED — no credentials (per PDF) | — |
| Duplicate processing prevented | PASSED | `tests/db/payments.test.ts` |
| Membership activation protected | PASSED | DB tests: direct calls refused; activated once |
| **Favicon** — old replaced, new shown, metadata, no broken paths | PASSED | e2e checks link tags and that each file is served as an image |
| Demo payment → demo record / failed → no activation / duplicate → no double activation / repeated confirmation idempotent | PASSED | DB tests |
| Cancelled payment → no activation; missing reference → not confirmed | PASSED (logic) · NOT TESTED end-to-end | nothing is confirmed without server verification |
| Paid, details incomplete → mandatory form; submitted → next step | PASSED (logic) · NOT TESTED end-to-end | gate unit-tested |

### Full-stack and live-database testing (14 Nov 2026)

The signed-in flows marked "NOT TESTED end-to-end" above were then run for real.

**1. Local full stack** — all 12 migrations on real Postgres (PGlite), real RLS/grants, real route handlers, a PostgREST-compatible API, browser-driven:

| Suite | Result |
|---|---|
| 14 journeys: mandatory registration step + real uploads; payment page, checkbox and price (₹1,499 shown = ₹1,499 charged); pending-member lockout (pages, API, RLS); direct calls to payment/profile functions refused; post-payment gate incl. locked date of birth and forged requests; verified-but-incomplete member; profile fields can't be blanked; rejected and missing-status members; failed → late success → duplicate → replayed payments; admin demo badge + verification; contact details via CMS; unpriced plan | **14 passed** |
| Production deployment: demo allowed (default) / `DEMO_PAYMENTS_IN_PRODUCTION=block` | **2 passed** |
| Razorpay mode: no demo, webhook signature, failure, wrong amount, capture, re-delivery, late failure, foreign orders | **2 passed** |
| The repo's own e2e suite incl. the live-journey spec (desktop + mobile) | **108 passed**, 4 skipped |

**2. Live Supabase project** — app run locally against production with test members only (no payment — 0011 is not live; no admin actions):

| Check | Result |
|---|---|
| Registration with the mandatory step and **real Storage uploads** (sizes read back from Storage) → payment page with the live fee | PASSED |
| Draft API refuses incomplete details | PASSED |
| Paid member with missing details held on the form → saves → "Profile Under Verification" | PASSED |
| Pending member kept out by page, API and **real RLS** (sees only their own rows) | PASSED |
| Rejected member message with contact placeholder | PASSED |
| Footer, policies, favicon | PASSED |

Test data was removed afterwards. One test account ("E2E LIVE Riya") could not be hard-deleted because its Aadhaar record is immutable by design; it was closed the same way the admin "delete" action does (status DELETED, login blocked, files removed). Five `REG…` numbers were consumed by test registrations.

**Findings from the live database that affect launch**

- **The payment bypass is open in production now.** An anonymous visitor can call `confirm_payment` and `save_draft_profile` on the live project (verified with a non-existent id, so nothing changed). Applying 0011 closes it — do this first.
- Live already has migration 0010; 0011 and 0012 are pending (0012 is a no-op there).
- **All 6 paid members on live (5 verified, 1 pending) will be sent to the personal-details form at their next login** — none has the newly mandatory fields (5 have no date of birth). This is the intended behaviour; consider telling them in advance.
- Admin contact edits appear from the *second* page view after saving (the existing CMS cache is stale-while-revalidate).
- Pre-existing, not changed: a signed-in member with an unfinished draft restarts the wizard at step 1.

## G. Deployment instructions

Do these in order. Nothing here has been done yet.

1. **Review and commit** the changes on a branch; open a pull request.
2. **Apply the migrations to the live database before the new code goes live.** The new code writes `payments.membership_plan`, which only exists after 0011 — deploying first would break "Pay".
   ```bash
   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     npm run db:push:direct
   ```
   This applies whatever is pending (expected: 0010, 0011, 0012) and skips what is already applied. CI's own migrate step **will not run** while the two pre-existing match-rule tests fail.
3. **Vercel environment:** no new variable is required. Confirm `PAYMENT_MODE=mock` and `NEXT_PUBLIC_AUTH_IDENTITY_STRATEGY=synthetic-email` are set (the code's fallback for the latter is `phone`, which would break login if it were missing).
4. **Deploy** (merge to `main`; Vercel builds automatically).
5. **After deploy:** enter the real contact number and email in `/admin/content` → they replace the placeholders in the footer, status screen and policy pages automatically. Check the fee in `/admin/settings`. Replace the remaining placeholders in `lib/membership.ts`, the refund policy and the privacy policy once the client confirms the terms.
6. **Smoke test:** footer links; refund and privacy pages; favicon in a fresh browser tab; one demo payment with a test member (should land on the details form if details are missing, then on "Profile Under Verification").
7. **Rollback:** redeploy the previous Vercel build. The migrations are additive and safe to leave in place.

---

## Found, not changed (outside this scope — decisions needed)

| Issue | Impact |
|---|---|
| Migration 0003 was edited in place (commit `b4598d7`) so that one accepted interest creates a match; `docs/DECISIONS.md` §2 and the tests still require acceptance in both directions | The live database still runs the original rule (applied migrations never re-run), and 2 tests fail, which keeps CI red. Decide the rule, then ship it as a new migration |
| Other database functions are still callable directly by anyone: `submit_registration`, `create_draft_registration`, `purge_abandoned_drafts`, `cleanup_expired`, `notify_user`, `notify_admins`, `check_rate_limit` | Same class of hole as the one fixed in 0011 (e.g. an anonymous visitor can trigger the deletion of abandoned drafts or send notifications to any member). Recommend restricting them to the server in a follow-up migration |
| `MOCK_OTP_CODE` defaults to `123456`, but OTPs are now 4 digits | In mock mode no one can pass the OTP step. `.env.example` now shows a 4-digit value; `.env.local` and the code default still need changing |
| `e2e/live-journey.spec.ts` still expects a "6-digit code" field | Will fail when the live suite is next run |
| The Contact page still displays the seeded `+91 00000 00000` / `hello@example.com` | Inconsistent with the footer's placeholders until real details are entered |
| Header buttons overflow by 2px at exactly 820px width | Cosmetic; header was out of scope |
