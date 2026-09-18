-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — Indexes
--
-- Sized for the filter set in PRD §9.1. The governing constraint is that a
-- verified user's search must never scan unverified rows, so the hot indexes
-- are PARTIAL on is_verified — a boolean denormalised onto profiles precisely
-- so this predicate is IMMUTABLE and therefore indexable.
-- ═══════════════════════════════════════════════════════════════════════════

-- The search workhorse. Gender and age are the near-universal filters, so they
-- lead; dob is indexed rather than a computed age because age ranges are
-- rewritten into dob ranges at query time (see lib/utils/age.ts).
create index profiles_search_primary
  on public.profiles (gender, dob, height_cm)
  where is_verified;

-- Community filters, which in this product are often applied together.
create index profiles_search_community
  on public.profiles (marital_status, subcaste, gotra)
  where is_verified;

-- Career filters.
create index profiles_search_career
  on public.profiles (highest_qualification, occupation, annual_income_inr)
  where is_verified;

-- Location, denormalised from addresses so search stays single-table.
create index profiles_search_location
  on public.profiles (state, city)
  where is_verified;

-- Stable ordering for pagination. Without this, ORDER BY created_at on a
-- filtered set forces a sort of the whole match set on every page.
create index profiles_browse_order
  on public.profiles (created_at desc, user_id)
  where is_verified;

-- Admin search by name (PRD §12.2).
create index profiles_name_search on public.profiles using gin (search_text);
create index profiles_name_trgm
  on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- Admin registration queue.
create index registrations_status_recent
  on public.registrations (status, created_at desc);
create index registrations_reg_id on public.registrations (registration_id);

-- Admin lookup by mobile/email (PRD §12.2).
create index users_email_lookup on public.users (lower(email));

-- Interest inbox and "have I already sent one?" checks.
create index interests_receiver_status
  on public.interests (receiver_user_id, status, created_at desc);
create index interests_sender
  on public.interests (sender_user_id, created_at desc);

-- Match lookups from either side.
create index matches_user_a on public.matches (user_a_id);
create index matches_user_b on public.matches (user_b_id);

-- The unread badge reads this on every page load, so it is partial: the index
-- stays small no matter how many read notifications accumulate.
create index notifications_unread
  on public.notifications (recipient_user_id, created_at desc)
  where not is_read;
create index notifications_recent
  on public.notifications (recipient_user_id, created_at desc);

-- Payment reconciliation.
create index payments_user on public.payments (user_id, created_at desc);
create index payments_status on public.payments (status, created_at desc);

-- Documents by owner and type (admin detail view).
create index documents_user_type on public.documents (user_id, document_type);

-- Public content ordering.
create index faqs_ordered on public.faqs (sort_order) where is_active;
create index site_images_slot on public.site_images (slot, sort_order) where is_active;
