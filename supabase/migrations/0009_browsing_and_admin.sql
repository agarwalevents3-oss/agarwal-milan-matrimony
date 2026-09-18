-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Profile browsing and admin reporting
--
-- Adds the last pieces the user-facing and admin screens need:
--   · partner preferences visible on another verified member's profile
--   · Realtime on notifications, for the unread badge
--   · a single-query dashboard summary for the admin
-- ═══════════════════════════════════════════════════════════════════════════

-- ── "What they are looking for" on a profile detail page (PRD §8.2) ─────────
--
-- Partner preferences are written by a member specifically to be read by
-- prospective matches, so a verified member may see another verified member's.
--
-- family_details deliberately gets NO such policy: it contains parents' and
-- siblings' names — third parties who never agreed to anything — so it stays
-- visible to its owner and the admin only.
create policy prefs_select_verified on public.partner_preferences
  for select to authenticated
  using (
    public.is_verified_user()
    and exists (
      select 1 from public.profiles p
      where p.user_id = public.partner_preferences.user_id and p.is_verified
    )
  );

-- ── Realtime for the notification badge (PRD §11.3) ─────────────────────────
--
-- Guarded because the publication only exists on a hosted Supabase project;
-- the local test harness has no such publication and must not fail here.
-- Realtime respects RLS, so a client only ever receives its own rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when duplicate_object then null;
end $$;

-- ── Admin dashboard (PRD §12.1) ─────────────────────────────────────────────
--
-- One round trip instead of seven. Counting in the database also means the
-- numbers are consistent with each other, which seven separate queries under
-- concurrent writes would not be.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total_users',          (select count(*) from public.registrations
                              where status not in ('DRAFT', 'DELETED')),
    'pending_verification', (select count(*) from public.registrations
                              where status = 'PENDING_VERIFICATION'),
    'verified',             (select count(*) from public.registrations
                              where status = 'VERIFIED'),
    'pending_payments',     (select count(*) from public.registrations
                              where status in ('PAYMENT_PENDING', 'PAYMENT_FAILED')),
    'suspended',            (select count(*) from public.registrations
                              where status = 'SUSPENDED'),
    'rejected',             (select count(*) from public.registrations
                              where status = 'REJECTED'),
    'drafts',               (select count(*) from public.registrations
                              where status = 'DRAFT'),
    'interests',            (select count(*) from public.interests),
    'interests_pending',    (select count(*) from public.interests where status = 'PENDING'),
    'matches',              (select count(*) from public.matches where status = 'ACTIVE'),
    'revenue',              (select coalesce(sum(amount), 0) from public.payments
                              where status = 'SUCCESS')
  );
end;
$$;

-- Recent activity feed for the dashboard (PRD §12.1).
create or replace function public.admin_recent_activity(p_limit integer default 12)
returns table (
  kind            text,
  happened_at     timestamptz,
  registration_id text,
  full_name       text,
  detail          text
)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  with events as (
    select 'REGISTRATION'::text as kind, r.created_at as happened_at,
           r.registration_id, p.full_name,
           ('Registered · ' || r.status::text) as detail
      from public.registrations r
      join public.profiles p on p.user_id = r.user_id
     where r.status <> 'DRAFT'

    union all

    select 'VERIFICATION', r.verified_at, r.registration_id, p.full_name, 'Verified'
      from public.registrations r
      join public.profiles p on p.user_id = r.user_id
     where r.verified_at is not null

    union all

    select 'INTEREST', i.created_at, r.registration_id, p.full_name,
           ('Sent an interest · ' || i.status::text)
      from public.interests i
      join public.profiles p on p.user_id = i.sender_user_id
      join public.registrations r on r.user_id = i.sender_user_id

    union all

    select 'MATCH', m.created_at, r.registration_id, p.full_name, 'Matched'
      from public.matches m
      join public.profiles p on p.user_id = m.user_a_id
      join public.registrations r on r.user_id = m.user_a_id
  )
  select e.kind, e.happened_at, e.registration_id, e.full_name, e.detail
    from events e
   where e.happened_at is not null
   order by e.happened_at desc
   limit p_limit;
end;
$$;

-- ── Admin registration queue (PRD §12.2) ────────────────────────────────────
--
-- A joined, searchable, paginated list. Doing this as one function keeps the
-- admin screen to a single round trip and keeps the search predicate — which
-- spans four tables — in one reviewable place.
create or replace function public.admin_registration_list(
  p_search text    default null,
  p_status text    default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  user_id         uuid,
  registration_id text,
  full_name       text,
  gender          public.gender,
  mobile          text,
  email           text,
  status          public.registration_status,
  payment_status  public.payment_status,
  created_at      timestamptz,
  photo_thumb_path text,
  total_count     bigint
)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select r.user_id, r.registration_id, p.full_name, p.gender, u.mobile, u.email,
           r.status, r.payment_status, r.created_at, p.photo_thumb_path
      from public.registrations r
      join public.users u    on u.id = r.user_id
      join public.profiles p on p.user_id = r.user_id
     where (p_status is null or r.status = p_status::public.registration_status)
       and (
         p_search is null or p_search = ''
         or r.registration_id ilike '%' || p_search || '%'
         or p.full_name        ilike '%' || p_search || '%'
         or u.mobile           ilike '%' || p_search || '%'
         or u.email            ilike '%' || p_search || '%'
       )
  )
  select f.*, (select count(*) from filtered) as total_count
    from filtered f
   order by f.created_at desc
   limit p_limit offset p_offset;
end;
$$;
