-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Core tables
--
-- PRIVACY-DRIVEN SPLIT, the single most important decision in this schema:
--
--   public.users    holds what must NEVER reach another user — mobile, email.
--   public.profiles holds ONLY data a verified user is permitted to see.
--
-- Because no secret lives on `profiles`, its read policy can be a simple
-- row-level rule that is safe by construction. Aadhaar is not a column
-- anywhere; it exists only as a row in `documents` pointing at a private
-- bucket, so it cannot leak through a profile query even if a policy is later
-- loosened by mistake.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── users ───────────────────────────────────────────────────────────────────
create table public.users (
  id              uuid primary key references auth.users (id) on delete cascade,
  mobile          text        not null unique,
  email           text        not null,
  role            public.user_role      not null default 'user',
  account_status  public.account_status not null default 'ACTIVE',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint users_mobile_e164 check (mobile ~ '^\+91[6-9][0-9]{9}$'),
  constraint users_email_shape check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.users is
  'Private identity. Mobile and email live here precisely so that no profile '
  'query can ever expose them (PRD §8.2).';

-- ── profiles ────────────────────────────────────────────────────────────────
-- `is_verified`, `city` and `state` are denormalised from registrations and
-- addresses by trigger (see 0005). They exist so that profile search is a
-- single-table, single-index query with no joins and no subqueries in its RLS
-- predicate — which is what keeps the highest-traffic read fast and free.
create table public.profiles (
  user_id               uuid primary key references public.users (id) on delete cascade,

  -- Core identity: mandatory at registration, locked afterwards (PRD §5.2).
  full_name             text    not null,
  gender                public.gender not null,

  -- Optional matrimonial data (PRD §5.3).
  dob                   date,
  place_of_birth        text,
  time_of_birth         time,
  height_cm             integer,
  marital_status        public.marital_status,
  gotra                 text,
  subcaste              text,
  highest_qualification text,
  occupation            text,
  company_business      text,
  annual_income_inr     bigint,

  -- Storage paths, written only by /api/profile/photo.
  photo_path            text,
  photo_thumb_path      text,

  -- Denormalised for search. Maintained by trigger; never client-writable.
  is_verified           boolean not null default false,
  city                  text,
  state                 text,

  search_text           tsvector generated always as (
                          to_tsvector('simple', coalesce(full_name, ''))
                        ) stored,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint profiles_height_sane check (height_cm is null or height_cm between 120 and 250),
  constraint profiles_dob_sane    check (dob is null or dob between '1940-01-01' and current_date - interval '18 years'),
  constraint profiles_income_sane check (annual_income_inr is null or annual_income_inr >= 0)
);

-- ── partner_preferences ─────────────────────────────────────────────────────
create table public.partner_preferences (
  user_id            uuid primary key references public.users (id) on delete cascade,
  age_min            integer,
  age_max            integer,
  height_min_cm      integer,
  height_max_cm      integer,
  education          text,
  occupation         text,
  location           text,
  other_expectations text,
  updated_at         timestamptz not null default now(),

  constraint prefs_age_order    check (age_min is null or age_max is null or age_min <= age_max),
  constraint prefs_height_order check (height_min_cm is null or height_max_cm is null or height_min_cm <= height_max_cm)
);

-- ── family_details ──────────────────────────────────────────────────────────
create table public.family_details (
  user_id     uuid primary key references public.users (id) on delete cascade,
  father_name text,
  mother_name text,
  native      text,
  siblings    text,
  updated_at  timestamptz not null default now()
);

-- ── addresses ───────────────────────────────────────────────────────────────
create table public.addresses (
  user_id    uuid primary key references public.users (id) on delete cascade,
  line1      text,
  city       text,
  state      text,
  pincode    text,
  updated_at timestamptz not null default now(),

  constraint addresses_pincode_shape check (pincode is null or pincode ~ '^[1-9][0-9]{5}$')
);

-- ── documents ───────────────────────────────────────────────────────────────
-- Metadata only; the bytes live in Supabase Storage. Aadhaar rows are written
-- once and locked forever (PRD §18.1) — enforced by trigger in 0005, not by
-- convention.
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  document_type     public.document_type not null,
  storage_path      text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  is_locked         boolean not null default false,

  -- Consent is captured as evidence, not as a boolean: we store the exact
  -- wording the user was shown, when, and from where (PRD §5.2, DPDP Act).
  consent_given     boolean not null default false,
  consent_text      text,
  consent_timestamp timestamptz,
  consent_ip        inet,

  uploaded_at       timestamptz not null default now(),

  constraint documents_aadhaar_needs_consent
    check (document_type <> 'AADHAAR' or (consent_given and consent_text is not null)),
  constraint documents_size_sane check (size_bytes > 0 and size_bytes <= 10485760)
);

-- One Aadhaar and one profile photo per user; certificates are unconstrained.
create unique index documents_one_aadhaar_per_user
  on public.documents (user_id) where document_type = 'AADHAAR';

-- ── registrations ───────────────────────────────────────────────────────────
-- REG000001 is generated by the database. The client never proposes an ID, so
-- it cannot be forged or duplicated (PRD §6.2).
create sequence public.registration_id_seq start 1;

create table public.registrations (
  id              uuid primary key default gen_random_uuid(),
  registration_id text not null unique
                    default ('REG' || lpad(nextval('public.registration_id_seq')::text, 6, '0')),
  user_id         uuid not null unique references public.users (id) on delete cascade,
  status          public.registration_status not null default 'DRAFT',
  payment_status  public.payment_status      not null default 'PENDING',
  rejected_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  verified_at     timestamptz,
  rejected_at     timestamptz,
  suspended_at    timestamptz
);

-- ── payments ────────────────────────────────────────────────────────────────
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  registration_id    uuid not null references public.registrations (id) on delete cascade,
  amount             numeric(10, 2) not null,
  currency           text not null default 'INR',
  status             public.payment_status not null default 'PENDING',
  gateway            text not null default 'mock',
  gateway_order_id   text,
  gateway_payment_id text,
  signature_verified boolean not null default false,
  raw_response       jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  verified_at        timestamptz,

  constraint payments_amount_positive check (amount > 0)
);

-- Gateway order IDs must be unique so a webhook can never be replayed against
-- two different payment rows.
create unique index payments_gateway_order_id_key
  on public.payments (gateway_order_id) where gateway_order_id is not null;

-- ── interests ───────────────────────────────────────────────────────────────
-- The unique constraint is what makes "one interest per direction" structural
-- rather than a race-prone application check (PRD §10.1).
create table public.interests (
  id               uuid primary key default gen_random_uuid(),
  sender_user_id   uuid not null references public.users (id) on delete cascade,
  receiver_user_id uuid not null references public.users (id) on delete cascade,
  status           public.interest_status not null default 'PENDING',
  created_at       timestamptz not null default now(),
  responded_at     timestamptz,

  constraint interests_no_self check (sender_user_id <> receiver_user_id),
  constraint interests_one_per_direction unique (sender_user_id, receiver_user_id)
);

-- ── matches ─────────────────────────────────────────────────────────────────
-- Canonical ordering (a < b) plus a unique constraint means a pair can have at
-- most one match row — the PRD's "exactly one match" acceptance criterion is a
-- database guarantee, so concurrent mutual accepts cannot double-write.
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a_id  uuid not null references public.users (id) on delete cascade,
  user_b_id  uuid not null references public.users (id) on delete cascade,
  status     public.match_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),

  constraint matches_canonical_order check (user_a_id < user_b_id),
  constraint matches_unique_pair unique (user_a_id, user_b_id)
);

-- ── notifications ───────────────────────────────────────────────────────────
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_user_id   uuid not null references public.users (id) on delete cascade,
  type                public.notification_type not null,
  title               text not null,
  message             text not null,
  related_user_id     uuid references public.users (id) on delete set null,
  related_interest_id uuid references public.interests (id) on delete set null,
  related_match_id    uuid references public.matches (id) on delete set null,
  is_read             boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ── Content management (PRD §13) ────────────────────────────────────────────
create table public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

create table public.site_images (
  id           uuid primary key default gen_random_uuid(),
  slot         text not null,
  storage_path text not null,
  alt_text     text not null default '',
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Operational tables (never client-readable) ──────────────────────────────

-- Mock-and-real OTP lifecycle. The code is stored as an HMAC, never plaintext.
create table public.phone_verifications (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  otp_hash   text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index phone_verifications_lookup
  on public.phone_verifications (phone, created_at desc);

-- Rate limiting in Postgres rather than a paid Redis tier.
create table public.rate_limits (
  bucket_key   text primary key,
  window_start timestamptz not null,
  count        integer not null default 0
);

create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users (id) on delete set null,
  action         text not null,
  target_type    text,
  target_id      text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index audit_log_recent on public.audit_log (created_at desc);
