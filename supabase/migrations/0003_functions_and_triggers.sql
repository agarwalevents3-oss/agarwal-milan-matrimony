-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — Functions and triggers
--
-- Business rules that must hold no matter which client writes them live here,
-- not in a Route Handler. A bug in application code cannot corrupt the
-- registration lifecycle, unlock Aadhaar, or create a duplicate match.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Authorisation helpers ───────────────────────────────────────────────────

-- Reads the role from the JWT rather than the users table. That is deliberate:
-- a table read here would recurse through the users RLS policy, which itself
-- calls is_admin().
create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Reads the DATABASE, not the JWT, so that a suspension takes effect on the
-- next request instead of at the user's next token refresh. Costs one index
-- lookup against a denormalised boolean; correct revocation is worth it.
-- SECURITY DEFINER bypasses RLS internally, which is what prevents recursion
-- with the profiles policy that calls it.
create or replace function public.is_verified_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.is_verified
  );
$$;

-- True when the caller is the service role (our Route Handlers) rather than an
-- end user. Used by guard triggers to allow privileged writes.
create or replace function public.is_service_role()
returns boolean
language sql stable
set search_path = ''
as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- ── updated_at ──────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_touch         before update on public.users               for each row execute function public.touch_updated_at();
create trigger profiles_touch      before update on public.profiles            for each row execute function public.touch_updated_at();
create trigger prefs_touch         before update on public.partner_preferences for each row execute function public.touch_updated_at();
create trigger family_touch        before update on public.family_details      for each row execute function public.touch_updated_at();
create trigger addresses_touch     before update on public.addresses           for each row execute function public.touch_updated_at();
create trigger registrations_touch before update on public.registrations       for each row execute function public.touch_updated_at();
create trigger payments_touch      before update on public.payments            for each row execute function public.touch_updated_at();
create trigger faqs_touch          before update on public.faqs                for each row execute function public.touch_updated_at();

-- ── Registration status machine (PRD §14, §22) ──────────────────────────────

create or replace function public.enforce_registration_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- text[] rather than the enum array: a CASE cannot unify typed literals
  -- with a typed empty array, so the comparison casts instead.
  allowed text[];
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'DRAFT'                then array['SUBMITTED', 'DELETED']
    when 'SUBMITTED'            then array['PAYMENT_PENDING', 'DELETED']
    when 'PAYMENT_PENDING'      then array['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'DELETED']
    when 'PAYMENT_FAILED'       then array['PAYMENT_PENDING', 'DELETED']       -- retry
    when 'PAYMENT_SUCCESS'      then array['PENDING_VERIFICATION', 'DELETED']
    when 'PENDING_VERIFICATION' then array['VERIFIED', 'REJECTED', 'DELETED']
    when 'VERIFIED'             then array['SUSPENDED', 'DELETED']
    when 'REJECTED'             then array['DELETED']
    when 'SUSPENDED'            then array['VERIFIED', 'DELETED']              -- un-suspend
    when 'DELETED'              then array[]::text[]                          -- terminal
  end;

  if not (new.status::text = any (allowed)) then
    raise exception 'Illegal registration transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  -- Stamp the lifecycle timestamps so callers cannot forget to.
  if new.status = 'VERIFIED'  then new.verified_at  := now(); end if;
  if new.status = 'REJECTED'  then new.rejected_at  := now(); end if;
  if new.status = 'SUSPENDED' then new.suspended_at := now(); end if;

  return new;
end;
$$;

create trigger registrations_enforce_transition
  before update of status on public.registrations
  for each row execute function public.enforce_registration_transition();

-- Admin may only verify a registration whose payment actually succeeded
-- (PRD §6.5). Enforced here so no API route can bypass it.
create or replace function public.enforce_payment_before_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'VERIFIED' and old.status <> 'SUSPENDED'
     and new.payment_status <> 'SUCCESS' then
    raise exception 'Cannot verify a registration whose payment is not SUCCESS'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger registrations_require_payment
  before update on public.registrations
  for each row execute function public.enforce_payment_before_verification();

-- ── Denormalisation keeping search single-table ─────────────────────────────

create or replace function public.sync_profile_verification()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles
     set is_verified = (new.status = 'VERIFIED')
   where user_id = new.user_id
     and is_verified is distinct from (new.status = 'VERIFIED');
  return new;
end;
$$;

create trigger registrations_sync_profile
  after insert or update of status on public.registrations
  for each row execute function public.sync_profile_verification();

create or replace function public.sync_profile_location()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles
     set city = new.city, state = new.state
   where user_id = new.user_id;
  return new;
end;
$$;

create trigger addresses_sync_profile
  after insert or update of city, state on public.addresses
  for each row execute function public.sync_profile_location();

-- ── Column-level write protection on profiles (PRD §8.3) ────────────────────
-- RLS controls which ROWS a user may update; this controls which COLUMNS.
-- Core identity is set once at registration and locked; photo paths and the
-- denormalised fields are writable only by our Route Handlers.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  if new.user_id     is distinct from old.user_id     then raise exception 'user_id is immutable'          using errcode = '42501'; end if;
  if new.is_verified is distinct from old.is_verified then raise exception 'is_verified is not user-writable' using errcode = '42501'; end if;
  if new.photo_path  is distinct from old.photo_path  then raise exception 'use /api/profile/photo'        using errcode = '42501'; end if;
  if new.photo_thumb_path is distinct from old.photo_thumb_path then raise exception 'use /api/profile/photo' using errcode = '42501'; end if;
  if new.city  is distinct from old.city  then raise exception 'city is derived from your address'  using errcode = '42501'; end if;
  if new.state is distinct from old.state then raise exception 'state is derived from your address' using errcode = '42501'; end if;

  -- Set-once fields: editable while empty, immutable once answered. Locking
  -- dob in particular stops a user from shifting their age to slip into
  -- someone else's search filters.
  if old.full_name is not null and new.full_name is distinct from old.full_name then
    raise exception 'full_name cannot be changed after registration' using errcode = '42501';
  end if;
  if new.gender is distinct from old.gender then
    raise exception 'gender cannot be changed after registration' using errcode = '42501';
  end if;
  if old.dob is not null and new.dob is distinct from old.dob then
    raise exception 'date of birth cannot be changed once set' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ── Aadhaar is write-once, forever (PRD §18.1) ──────────────────────────────
-- No exception for the service role: this is the rule the product promises its
-- users, so not even our own API may quietly rewrite it.
create or replace function public.guard_document_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.document_type = 'AADHAAR' then
      raise exception 'Aadhaar documents cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.document_type = 'AADHAAR' then
    raise exception 'Aadhaar documents are locked after registration' using errcode = '42501';
  end if;
  if old.is_locked then
    raise exception 'Document is locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger documents_guard_immutability
  before update or delete on public.documents
  for each row execute function public.guard_document_immutability();

-- ── Notification helper ─────────────────────────────────────────────────────

create or replace function public.notify_user(
  p_recipient    uuid,
  p_type         public.notification_type,
  p_title        text,
  p_message      text,
  p_related_user uuid default null,
  p_interest     uuid default null,
  p_match        uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.notifications (
    recipient_user_id, type, title, message,
    related_user_id, related_interest_id, related_match_id
  )
  values (p_recipient, p_type, p_title, p_message, p_related_user, p_interest, p_match)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.notify_admins(
  p_type    public.notification_type,
  p_title   text,
  p_message text,
  p_related_user uuid default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_user_id, type, title, message, related_user_id)
  select u.id, p_type, p_title, p_message, p_related_user
    from public.users u
   where u.role = 'admin' and u.account_status = 'ACTIVE';
end;
$$;

-- ── Interest & match (PRD §10) ──────────────────────────────────────────────

-- Sending an interest is a single transaction so that the eligibility checks
-- and the insert cannot drift apart under concurrency. The unique constraint
-- is the real duplicate guard; the friendly error here is for the UI.
create or replace function public.send_interest(p_receiver uuid)
returns public.interests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_interest public.interests;
  v_sender_name text;
begin
  if v_sender is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_sender = p_receiver then
    raise exception 'You cannot send an interest to yourself' using errcode = '23514';
  end if;
  if not public.is_verified_user() then
    raise exception 'Only verified users can send interests' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_receiver and is_verified) then
    raise exception 'That profile is not available' using errcode = 'P0002';
  end if;

  begin
    insert into public.interests (sender_user_id, receiver_user_id)
    values (v_sender, p_receiver)
    returning * into v_interest;
  exception when unique_violation then
    raise exception 'You have already sent an interest to this profile' using errcode = '23505';
  end;

  select full_name into v_sender_name from public.profiles where user_id = v_sender;

  perform public.notify_user(
    p_receiver, 'INTEREST_RECEIVED',
    'New interest received',
    v_sender_name || ' has expressed interest in your profile.',
    v_sender, v_interest.id, null
  );
  perform public.notify_admins(
    'ADMIN_NOTIFICATION', 'Interest sent',
    v_sender_name || ' sent an interest.', v_sender
  );

  return v_interest;
end;
$$;

-- Accept/reject plus the mutual-match check, all in ONE transaction.
--
-- MATCH RULE: a match is created when interests exist in BOTH directions and
-- both are ACCEPTED. PRD §10.4 branches on "if NO: no match", which only has
-- meaning under this reading — if accepting always produced a match the check
-- would be dead logic. See docs/DECISIONS.md.
create or replace function public.respond_to_interest(
  p_interest_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor       uuid := (select auth.uid());
  v_interest   public.interests;
  v_match_id   uuid;
  v_a           uuid;
  v_b           uuid;
  v_actor_name  text;
  v_other_name  text;
begin

  -- ------------------------------------------------------------
  -- 1. Authentication
  -- ------------------------------------------------------------
  if v_actor is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  -- ------------------------------------------------------------
  -- 2. Validate action
  -- ------------------------------------------------------------
  if p_action not in ('ACCEPT', 'REJECT') then
    raise exception 'Invalid action'
      using errcode = '22023';
  end if;

  -- ------------------------------------------------------------
  -- 3. Lock and fetch the interest
  -- ------------------------------------------------------------
  select *
    into v_interest
    from public.interests
   where id = p_interest_id
   for update;

  if not found then
    raise exception 'Interest not found'
      using errcode = 'P0002';
  end if;

  -- ------------------------------------------------------------
  -- 4. Make sure current user is the receiver
  -- ------------------------------------------------------------
  if v_interest.receiver_user_id <> v_actor then
    raise exception 'You are not the recipient of this interest'
      using errcode = '42501';
  end if;

  -- ------------------------------------------------------------
  -- 5. Prevent responding to an already-processed interest
  -- ------------------------------------------------------------
  if v_interest.status <> 'PENDING' then
    raise exception 'This interest has already been answered'
      using errcode = '22023';
  end if;

  -- ------------------------------------------------------------
  -- 6. Update interest status
  -- ------------------------------------------------------------
  update public.interests
     set status = (
       case
         when p_action = 'ACCEPT' then 'ACCEPTED'
         else 'REJECTED'
       end
     )::public.interest_status,
         responded_at = now()
   where id = p_interest_id
   returning *
        into v_interest;

  -- ------------------------------------------------------------
  -- 7. Get names for notifications
  -- ------------------------------------------------------------
  select full_name
    into v_actor_name
    from public.profiles
   where user_id = v_actor;

  select full_name
    into v_other_name
    from public.profiles
   where user_id = v_interest.sender_user_id;

  -- ============================================================
  -- REJECT
  -- ============================================================
  if p_action = 'REJECT' then

    perform public.notify_user(
      v_interest.sender_user_id,
      'INTEREST_REJECTED',
      'Interest declined',
      'Your interest was not accepted.',
      v_actor,
      v_interest.id,
      null
    );

    return jsonb_build_object(
      'status', 'REJECTED',
      'matched', false
    );

  end if;

  -- ============================================================
  -- ACCEPT
  -- ============================================================

  -- Notify the person who originally sent the interest
  perform public.notify_user(
    v_interest.sender_user_id,
    'INTEREST_ACCEPTED',
    'Interest accepted',
    v_actor_name || ' accepted your interest.',
    v_actor,
    v_interest.id,
    null
  );

  -- ------------------------------------------------------------
  -- IMPORTANT:
  -- An accepted interest itself creates the match.
  --
  -- Example:
  -- A -> B
  -- A -> C
  -- A -> D
  --
  -- If C accepts:
  -- A <-> C becomes a match immediately.
  --
  -- B and D remain independent.
  -- No reverse interest is required.
  -- ------------------------------------------------------------

  -- Always store the smaller UUID as user_a_id and larger UUID
  -- as user_b_id so the same pair cannot create duplicate rows.
  v_a := least(v_actor, v_interest.sender_user_id);
  v_b := greatest(v_actor, v_interest.sender_user_id);

  -- ------------------------------------------------------------
  -- Create the match
  -- ------------------------------------------------------------
  insert into public.matches (
    user_a_id,
    user_b_id
  )
  values (
    v_a,
    v_b
  )
  on conflict (user_a_id, user_b_id)
  do nothing
  returning id
       into v_match_id;

  -- ------------------------------------------------------------
  -- If this pair was already matched, don't send duplicate
  -- MATCH_CREATED notifications.
  -- ------------------------------------------------------------
  if v_match_id is null then

    select id
      into v_match_id
      from public.matches
     where user_a_id = v_a
       and user_b_id = v_b;

    return jsonb_build_object(
      'status', 'ACCEPTED',
      'matched', true,
      'match_id', v_match_id,
      'new', false
    );

  end if;

  -- ------------------------------------------------------------
  -- Notify current user
  -- ------------------------------------------------------------
  perform public.notify_user(
    v_actor,
    'MATCH_CREATED',
    'It''s a match!',
    'You and ' || v_other_name || ' have matched.',
    v_interest.sender_user_id,
    null,
    v_match_id
  );

  -- ------------------------------------------------------------
  -- Notify the person who sent the interest
  -- ------------------------------------------------------------
  perform public.notify_user(
    v_interest.sender_user_id,
    'MATCH_CREATED',
    'It''s a match!',
    'You and ' || v_actor_name || ' have matched.',
    v_actor,
    null,
    v_match_id
  );

  -- ------------------------------------------------------------
  -- Notify admins
  -- ------------------------------------------------------------
  perform public.notify_admins(
    'ADMIN_NOTIFICATION',
    'New match',
    v_actor_name || ' and ' || v_other_name || ' matched.',
    v_actor
  );

  -- ------------------------------------------------------------
  -- Return successful match result to the API
  -- ------------------------------------------------------------
  return jsonb_build_object(
    'status', 'ACCEPTED',
    'matched', true,
    'match_id', v_match_id,
    'new', true
  );

end;
$$;

-- ── Retention sweep, called nightly by /api/cron/cleanup ────────────────────
create or replace function public.cleanup_expired()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_otp int; v_rl int; v_notif int;
begin
  delete from public.phone_verifications where created_at < now() - interval '24 hours';
  get diagnostics v_otp = row_count;

  delete from public.rate_limits where window_start < now() - interval '24 hours';
  get diagnostics v_rl = row_count;

  delete from public.notifications where is_read and created_at < now() - interval '90 days';
  get diagnostics v_notif = row_count;

  return jsonb_build_object(
    'phone_verifications', v_otp, 'rate_limits', v_rl, 'notifications', v_notif
  );
end;
$$;
