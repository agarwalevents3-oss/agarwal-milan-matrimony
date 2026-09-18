-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Extensions and enumerated types
--
-- Every status in the product is a Postgres enum rather than free text, so an
-- invalid state cannot be written even by a caller holding the service-role
-- key. Extend later with: ALTER TYPE <name> ADD VALUE '<new>';
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ── Identity ────────────────────────────────────────────────────────────────
create type public.user_role as enum ('user', 'admin');

create type public.account_status as enum ('ACTIVE', 'SUSPENDED', 'DELETED');

create type public.gender as enum ('MALE', 'FEMALE', 'OTHER');

create type public.marital_status as enum (
  'NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'
);

-- ── Registration lifecycle (PRD §14) ────────────────────────────────────────
create type public.registration_status as enum (
  'DRAFT',
  'SUBMITTED',
  'PAYMENT_PENDING',
  'PAYMENT_FAILED',
  'PAYMENT_SUCCESS',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
  'DELETED'
);

-- ── Payments (PRD §6.3) ─────────────────────────────────────────────────────
create type public.payment_status as enum (
  'PENDING', 'INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED'
);

-- ── Interest & match (PRD §10) ──────────────────────────────────────────────
create type public.interest_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');

create type public.match_status as enum ('ACTIVE', 'INACTIVE');

-- ── Documents (PRD §17) ─────────────────────────────────────────────────────
create type public.document_type as enum (
  'PROFILE_PHOTO', 'AADHAAR', 'EDUCATIONAL_CERTIFICATE'
);

-- ── Notifications (PRD §11.1) ───────────────────────────────────────────────
create type public.notification_type as enum (
  'REGISTRATION_SUBMITTED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PROFILE_VERIFIED',
  'PROFILE_REJECTED',
  'INTEREST_RECEIVED',
  'INTEREST_ACCEPTED',
  'INTEREST_REJECTED',
  'MATCH_CREATED',
  'ADMIN_NOTIFICATION'
);
