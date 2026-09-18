-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — Row Level Security
--
-- The anon key ships to the browser by design. That is only safe because these
-- policies are correct, so they are treated as security-critical code and get
-- their own pgTAP suite (supabase/tests/).
--
-- Default posture: RLS on, no policies, nothing readable. Access is then
-- granted back one narrow policy at a time.
--
-- Note the (select auth.uid()) wrapping throughout — the subselect lets
-- Postgres evaluate the uid ONCE per statement as an InitPlan instead of once
-- per row, which is the difference between a fast and a slow profile search.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.users               enable row level security;
alter table public.profiles            enable row level security;
alter table public.partner_preferences enable row level security;
alter table public.family_details      enable row level security;
alter table public.addresses           enable row level security;
alter table public.documents           enable row level security;
alter table public.registrations       enable row level security;
alter table public.payments            enable row level security;
alter table public.interests           enable row level security;
alter table public.matches             enable row level security;
alter table public.notifications       enable row level security;
alter table public.site_content        enable row level security;
alter table public.site_images         enable row level security;
alter table public.faqs                enable row level security;
alter table public.admin_settings      enable row level security;
alter table public.phone_verifications enable row level security;
alter table public.rate_limits         enable row level security;
alter table public.audit_log           enable row level security;

-- ── users: mobile and email. Own row or admin, nothing else. ────────────────
create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- No INSERT/UPDATE/DELETE policies: identity changes go through Route Handlers
-- holding the service role, which bypasses RLS.

-- ── profiles: the browsable surface ─────────────────────────────────────────
-- A verified user may read other VERIFIED profiles. Safe because this table
-- holds no contact details and no documents by construction.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or (is_verified and public.is_verified_user())
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Which COLUMNS may move is enforced by guard_profile_update() in 0003.
-- Admin deliberately gets no UPDATE policy: admins cannot edit user profile
-- data (PRD §8.4, §12.2).

-- ── Owned detail tables ─────────────────────────────────────────────────────
create policy prefs_select on public.partner_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy prefs_write on public.partner_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy family_select on public.family_details
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy family_write on public.family_details
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy addresses_select on public.addresses
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy addresses_write on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── documents: Aadhaar and certificates ─────────────────────────────────────
-- Read your own metadata, or everything as admin. No write policies at all:
-- every document row is created by a Route Handler that has verified the
-- object's real size and MIME type from the Storage API rather than trusting
-- what the client claimed (PRD §17).
create policy documents_select on public.documents
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── registrations & payments: read-only to their owner ──────────────────────
create policy registrations_select on public.registrations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy payments_select on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── interests & matches ─────────────────────────────────────────────────────
-- Writes happen exclusively through send_interest() / respond_to_interest(),
-- which are SECURITY DEFINER and therefore bypass RLS after doing their own
-- eligibility checks. Hence read-only policies here.
create policy interests_select on public.interests
  for select to authenticated
  using (
    sender_user_id = (select auth.uid())
    or receiver_user_id = (select auth.uid())
    or public.is_admin()
  );

create policy matches_select on public.matches
  for select to authenticated
  using (
    user_a_id = (select auth.uid())
    or user_b_id = (select auth.uid())
    or public.is_admin()
  );

-- ── notifications ───────────────────────────────────────────────────────────
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

-- Column-level grant: a user may flip is_read and nothing else. This is what
-- stops someone rewriting a notification's title or re-pointing its links.
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ── Public website content: readable by anyone, writable by admin ───────────
create policy site_content_public_read on public.site_content
  for select to anon, authenticated using (true);
create policy site_content_admin_write on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy site_images_public_read on public.site_images
  for select to anon, authenticated using (is_active or public.is_admin());
create policy site_images_admin_write on public.site_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy faqs_public_read on public.faqs
  for select to anon, authenticated using (is_active or public.is_admin());
create policy faqs_admin_write on public.faqs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── admin_settings ──────────────────────────────────────────────────────────
-- Admin-only, with ONE deliberate exception: verified users must be able to
-- read the admin contact number, because that is the number shown on profile
-- detail pages in place of the owner's real one (PRD §8.2).
create policy admin_settings_contact_number on public.admin_settings
  for select to authenticated
  using (key = 'admin_contact_number' and public.is_verified_user());

create policy admin_settings_admin_all on public.admin_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Operational tables: unreachable from any client ─────────────────────────
-- RLS is on with zero policies, and the grants are revoked as a second lock.
-- The service role bypasses both.
revoke all on public.phone_verifications from anon, authenticated;
revoke all on public.rate_limits         from anon, authenticated;
revoke all on public.audit_log           from anon, authenticated;

-- ── verified_profiles: the search surface ───────────────────────────────────
-- security_invoker means the caller's own RLS applies, so this view cannot be
-- used to escape the profiles policy. It exists to pin the column list: a
-- query against it structurally cannot select a document, a payment, an email
-- or a phone number.
-- Note on the column list: place_of_birth is included because it is ordinary
-- matrimonial context. time_of_birth is NOT — combined with dob and place it
-- forms a complete natal record, and it adds nothing to browsing. A member who
-- wants to exchange horoscope details can do so after matching.
create view public.verified_profiles
with (security_invoker = true) as
select
  user_id, full_name, gender, dob, place_of_birth, height_cm, marital_status,
  gotra, subcaste, highest_qualification, occupation, company_business,
  annual_income_inr, photo_path, photo_thumb_path, city, state, created_at
from public.profiles
where is_verified;

grant select on public.verified_profiles to authenticated;
