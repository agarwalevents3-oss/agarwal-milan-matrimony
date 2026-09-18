-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — Transactional registration and payment
--
-- Registration is split at the point where the account starts to exist, which
-- is what PRD §14's DRAFT state is for:
--
--   create_draft_registration  mobile verified + password + mandatory identity
--                              → a real auth user, so the browser can upload
--                                straight to Storage under its own auth.uid()
--                                and the bucket policies apply normally.
--   submit_registration        documents and consent are in place
--                              → DRAFT → SUBMITTED → PAYMENT_PENDING
--
-- The alternative — holding uploads in a temporary folder and moving them after
-- the account exists — costs a second copy of every file and a move that can
-- fail halfway. This way also makes registration resumable: an interrupted
-- signup is just a DRAFT the user can log back into.
--
-- Each function is one transaction, because supabase-js cannot span statements
-- and a half-written registration is worse than none.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.create_draft_registration(
  p_user_id   uuid,
  p_mobile    text,
  p_email     text,
  p_full_name text,
  p_gender    public.gender
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_registration_id text;
begin
  insert into public.users (id, mobile, email) values (p_user_id, p_mobile, p_email);

  insert into public.profiles (user_id, full_name, gender)
  values (p_user_id, p_full_name, p_gender);

  insert into public.registrations (user_id) values (p_user_id)
  returning registration_id into v_registration_id;

  return jsonb_build_object('registration_id', v_registration_id, 'status', 'DRAFT');
end;
$$;

-- Saves the optional profile sections during the draft steps. Idempotent, so a
-- user can go back and forward through the form without creating duplicates.
create or replace function public.save_draft_profile(
  p_user_id     uuid,
  p_profile     jsonb,
  p_address     jsonb,
  p_family      jsonb,
  p_preferences jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set
    dob                   = coalesce(nullif(p_profile ->> 'dob', '')::date, dob),
    place_of_birth        = coalesce(nullif(p_profile ->> 'placeOfBirth', ''), place_of_birth),
    time_of_birth         = coalesce(nullif(p_profile ->> 'timeOfBirth', '')::time, time_of_birth),
    height_cm             = coalesce(nullif(p_profile ->> 'heightCm', '')::integer, height_cm),
    marital_status        = coalesce(nullif(p_profile ->> 'maritalStatus', '')::public.marital_status, marital_status),
    gotra                 = coalesce(nullif(p_profile ->> 'gotra', ''), gotra),
    subcaste              = coalesce(nullif(p_profile ->> 'subcaste', ''), subcaste),
    highest_qualification = coalesce(nullif(p_profile ->> 'highestQualification', ''), highest_qualification),
    occupation            = coalesce(nullif(p_profile ->> 'occupation', ''), occupation),
    company_business      = coalesce(nullif(p_profile ->> 'companyBusiness', ''), company_business),
    annual_income_inr     = coalesce(nullif(p_profile ->> 'annualIncomeInr', '')::bigint, annual_income_inr)
  where user_id = p_user_id;

  if p_address is not null and p_address <> 'null'::jsonb then
    insert into public.addresses (user_id, line1, city, state, pincode)
    values (p_user_id,
            nullif(p_address ->> 'line1', ''), nullif(p_address ->> 'city', ''),
            nullif(p_address ->> 'state', ''), nullif(p_address ->> 'pincode', ''))
    on conflict (user_id) do update set
      line1 = excluded.line1, city = excluded.city,
      state = excluded.state, pincode = excluded.pincode;
  end if;

  if p_family is not null and p_family <> 'null'::jsonb then
    insert into public.family_details (user_id, father_name, mother_name, native, siblings)
    values (p_user_id,
            nullif(p_family ->> 'fatherName', ''), nullif(p_family ->> 'motherName', ''),
            nullif(p_family ->> 'native', ''), nullif(p_family ->> 'siblings', ''))
    on conflict (user_id) do update set
      father_name = excluded.father_name, mother_name = excluded.mother_name,
      native = excluded.native, siblings = excluded.siblings;
  end if;

  if p_preferences is not null and p_preferences <> 'null'::jsonb then
    insert into public.partner_preferences (
      user_id, age_min, age_max, height_min_cm, height_max_cm,
      education, occupation, location, other_expectations)
    values (p_user_id,
            nullif(p_preferences ->> 'ageMin', '')::integer,
            nullif(p_preferences ->> 'ageMax', '')::integer,
            nullif(p_preferences ->> 'heightMinCm', '')::integer,
            nullif(p_preferences ->> 'heightMaxCm', '')::integer,
            nullif(p_preferences ->> 'education', ''), nullif(p_preferences ->> 'occupation', ''),
            nullif(p_preferences ->> 'location', ''), nullif(p_preferences ->> 'otherExpectations', ''))
    on conflict (user_id) do update set
      age_min = excluded.age_min, age_max = excluded.age_max,
      height_min_cm = excluded.height_min_cm, height_max_cm = excluded.height_max_cm,
      education = excluded.education, occupation = excluded.occupation,
      location = excluded.location, other_expectations = excluded.other_expectations;
  end if;
end;
$$;

-- Finalises the draft. Every mandatory item from PRD §5.2 is checked here, in
-- the database, so an API bug cannot let an incomplete registration through.
create or replace function public.submit_registration(
  p_user_id    uuid,
  p_documents  jsonb,
  p_consent_ip inet
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_registration_id text;
  v_status          public.registration_status;
  v_full_name       text;
  v_consent_text    text := coalesce(p_documents ->> 'consentText', 'Aadhaar consent given at registration.');
begin
  select r.registration_id, r.status, p.full_name
    into v_registration_id, v_status, v_full_name
    from public.registrations r
    join public.profiles p on p.user_id = r.user_id
   where r.user_id = p_user_id
     for update of r;

  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_status <> 'DRAFT' then
    raise exception 'This registration has already been submitted' using errcode = '22023';
  end if;

  if nullif(p_documents ->> 'photoPath', '') is null then
    raise exception 'A profile photo is required' using errcode = '23514';
  end if;
  if nullif(p_documents ->> 'aadhaarPath', '') is null then
    raise exception 'An Aadhaar document is required' using errcode = '23514';
  end if;
  if coalesce((p_documents ->> 'aadhaarConsent')::boolean, false) is not true then
    raise exception 'Aadhaar consent is required' using errcode = '23514';
  end if;

  update public.profiles
     set photo_path       = p_documents ->> 'photoPath',
         photo_thumb_path = p_documents ->> 'photoThumbPath'
   where user_id = p_user_id;

  insert into public.documents (user_id, document_type, storage_path, mime_type, size_bytes)
  values (p_user_id, 'PROFILE_PHOTO', p_documents ->> 'photoPath',
          coalesce(p_documents ->> 'photoMime', 'image/webp'),
          coalesce((p_documents ->> 'photoSize')::bigint, 1));

  insert into public.documents (
    user_id, document_type, storage_path, mime_type, size_bytes,
    is_locked, consent_given, consent_text, consent_timestamp, consent_ip)
  values (p_user_id, 'AADHAAR', p_documents ->> 'aadhaarPath',
          coalesce(p_documents ->> 'aadhaarMime', 'image/webp'),
          coalesce((p_documents ->> 'aadhaarSize')::bigint, 1),
          true, true, v_consent_text, now(), p_consent_ip);

  if nullif(p_documents ->> 'educationalCertificatePath', '') is not null then
    insert into public.documents (user_id, document_type, storage_path, mime_type, size_bytes)
    values (p_user_id, 'EDUCATIONAL_CERTIFICATE', p_documents ->> 'educationalCertificatePath',
            coalesce(p_documents ->> 'certificateMime', 'application/pdf'),
            coalesce((p_documents ->> 'certificateSize')::bigint, 1));
  end if;

  update public.registrations set status = 'SUBMITTED'       where user_id = p_user_id;
  update public.registrations set status = 'PAYMENT_PENDING' where user_id = p_user_id;

  perform public.notify_user(
    p_user_id, 'REGISTRATION_SUBMITTED', 'Registration received',
    'Your registration ' || v_registration_id || ' has been received. Please complete the payment to continue.');
  perform public.notify_admins(
    'ADMIN_NOTIFICATION', 'New registration',
    v_full_name || ' submitted registration ' || v_registration_id || '.', p_user_id);

  return jsonb_build_object('registration_id', v_registration_id, 'status', 'PAYMENT_PENDING');
end;
$$;

-- ── Payment ─────────────────────────────────────────────────────────────────

-- Marks a payment successful and advances the registration into the admin
-- queue. Called ONLY after a server-side signature check (PRD §20.2).
-- Idempotent, so a replayed webhook cannot double-advance the registration.
create or replace function public.confirm_payment(
  p_payment_id         uuid,
  p_gateway_payment_id text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_status  public.registration_status;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'SUCCESS' then
    select status into v_status from public.registrations where id = v_payment.registration_id;
    return jsonb_build_object('already', true, 'registration_status', v_status);
  end if;

  update public.payments
     set status = 'SUCCESS', gateway_payment_id = p_gateway_payment_id,
         signature_verified = true, verified_at = now()
   where id = p_payment_id;

  update public.registrations
     set payment_status = 'SUCCESS', status = 'PAYMENT_SUCCESS'
   where id = v_payment.registration_id;

  update public.registrations set status = 'PENDING_VERIFICATION'
   where id = v_payment.registration_id
  returning status into v_status;

  perform public.notify_user(
    v_payment.user_id, 'PAYMENT_SUCCESS', 'Payment successful',
    'Your payment was received. Your profile is now awaiting administrator verification.');
  perform public.notify_admins(
    'ADMIN_NOTIFICATION', 'Registration awaiting verification',
    'A paid registration is ready for review.', v_payment.user_id);

  return jsonb_build_object('already', false, 'registration_status', v_status);
end;
$$;

create or replace function public.fail_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.status = 'SUCCESS' then return; end if;

  update public.payments set status = 'FAILED' where id = p_payment_id;
  update public.registrations set payment_status = 'FAILED' where id = v_payment.registration_id;

  perform public.notify_user(
    v_payment.user_id, 'PAYMENT_FAILED', 'Payment failed',
    coalesce(p_reason, 'Your payment could not be completed. Please try again.'));
end;
$$;

-- Purge abandoned drafts, so a half-finished signup does not hold a mobile
-- number hostage forever.
--
-- Returns the ids it removed rather than a count: deleting public.users does
-- NOT delete the matching auth.users row (the cascade runs the other way), so
-- the caller must finish the job through the Auth admin API. /api/cron/cleanup
-- does exactly that.
create or replace function public.purge_abandoned_drafts(p_older_than_days integer default 14)
returns uuid[]
language plpgsql security definer
set search_path = ''
as $$
declare v_ids uuid[];
begin
  with doomed as (
    delete from public.users u
     using public.registrations r
     where r.user_id = u.id
       and r.status = 'DRAFT'
       and r.created_at < now() - make_interval(days => p_older_than_days)
    returning u.id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into v_ids from doomed;
  return v_ids;
end;
$$;
