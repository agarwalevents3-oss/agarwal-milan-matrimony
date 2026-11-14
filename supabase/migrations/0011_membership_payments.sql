-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Membership payments: plan reference, failure reason, safe confirmation
--        (Website Improvements §6.3 C–E)
--
-- Additive only: two nullable columns, one partial unique index, new versions
-- of confirm_payment() and fail_payment(), and EXECUTE on four functions
-- restricted to the service role (see the end of this file). No table, column
-- or row is removed, and existing payment records are left exactly as they are.
--
-- The payments table already identified almost everything §6.3C asks for:
--
--   internal payment id ........ id
--   user / registration ........ user_id, registration_id
--   amount / currency .......... amount, currency
--   provider / status .......... gateway, status       ("mock" = demo)
--   provider order / payment ... gateway_order_id, gateway_payment_id
--   verification + timestamp ... signature_verified, verified_at
--   gateway response ........... raw_response
--
-- Missing were the membership plan and the failure reason, added below.
--
-- Status names (§6.3C suggestion → existing payment_status enum):
--   CREATED → INITIATED, PENDING → PENDING, SUCCESS, FAILED and CANCELLED are
--   already there. REFUND_PENDING / REFUNDED are NOT added: no refund flow
--   exists in the product, and refunds are handled by the team per the Refund
--   & Cancellation Policy. Adding states nothing can reach would be dead code.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payments
  add column if not exists membership_plan text,
  add column if not exists failure_reason  text;

comment on column public.payments.membership_plan is
  'Membership plan code the payment was for (lib/membership.ts). NULL on payments made before 0011.';
comment on column public.payments.failure_reason is
  'Why the payment failed, as reported by the gateway or our verification. Never shown raw to members.';
comment on column public.payments.gateway is
  'Provider that processed the payment. "mock" marks a DEMO transaction — no money moved.';

-- A gateway payment id identifies one real transaction. It may confirm at
-- most one payment row, so the same transaction can never be processed twice.
create unique index if not exists payments_gateway_payment_id_key
  on public.payments (gateway, gateway_payment_id)
  where gateway_payment_id is not null;

-- ── confirm_payment ─────────────────────────────────────────────────────────
-- Replaces the 0008 version. Still called ONLY after a server-side signature
-- check, and still idempotent. New: two real-world cases the gateway can
-- produce, which previously raised an illegal-transition error and left money
-- that had been taken recorded nowhere:
--
--   · Late success after a recorded failure ("amount debited but confirmation
--     not received"). The registration is on PAYMENT_FAILED; the machine only
--     allows PAYMENT_FAILED → PAYMENT_PENDING, so it steps through that.
--
--   · A second successful payment for a registration that is already paid
--     (two tabs, a double click). The money is recorded as SUCCESS so the team
--     can refund it, the admin is told, and the membership is NOT activated or
--     extended a second time.
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
  v_reg     public.registrations;
  v_status  public.registration_status;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  -- The same transaction confirmed again (client verify + webhook, or a
  -- replayed webhook): nothing changes.
  if v_payment.status = 'SUCCESS' then
    select status into v_status from public.registrations where id = v_payment.registration_id;
    return jsonb_build_object('already', true, 'duplicate', false, 'registration_status', v_status);
  end if;

  update public.payments
     set status = 'SUCCESS', gateway_payment_id = p_gateway_payment_id,
         signature_verified = true, verified_at = now(), failure_reason = null
   where id = p_payment_id;

  select * into v_reg from public.registrations where id = v_payment.registration_id for update;

  -- Already paid (or no longer awaiting payment): record the money, never
  -- activate twice.
  if v_reg.status not in ('PAYMENT_PENDING', 'PAYMENT_FAILED') then
    perform public.notify_admins(
      'ADMIN_NOTIFICATION', 'Duplicate payment received',
      'An additional successful payment was received for registration ' || v_reg.registration_id ||
      ', which is already ' || v_reg.status || '. Please review it for a refund.',
      v_payment.user_id);
    return jsonb_build_object('already', false, 'duplicate', true, 'registration_status', v_reg.status);
  end if;

  if v_reg.status = 'PAYMENT_FAILED' then
    update public.registrations set status = 'PAYMENT_PENDING' where id = v_reg.id;
  end if;

  update public.registrations
     set payment_status = 'SUCCESS', status = 'PAYMENT_SUCCESS'
   where id = v_reg.id;

  update public.registrations set status = 'PENDING_VERIFICATION'
   where id = v_reg.id
  returning status into v_status;

  perform public.notify_user(
    v_payment.user_id, 'PAYMENT_SUCCESS', 'Payment successful',
    'Your payment was received. Your profile is now awaiting administrator verification.');
  perform public.notify_admins(
    'ADMIN_NOTIFICATION', 'Registration awaiting verification',
    'A paid registration is ready for review.', v_payment.user_id);

  return jsonb_build_object('already', false, 'duplicate', false, 'registration_status', v_status);
end;
$$;

-- ── fail_payment ────────────────────────────────────────────────────────────
-- Replaces the 0010 version, keeping its PAYMENT_PENDING → PAYMENT_FAILED
-- move. New:
--   · the reason is stored on the payment row, and the member's notification
--     no longer repeats it (it can be a technical gateway message);
--   · a repeat failure of the same payment (a re-delivered webhook) is a
--     no-op, so the member is not notified twice;
--   · one failed attempt can never mark a registration that has ALREADY been
--     paid for by another transaction as unpaid — previously it set
--     payment_status = 'FAILED' unconditionally, which would also have blocked
--     the admin from verifying a member who had in fact paid.
create or replace function public.fail_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_payment        public.payments;
  v_status         public.registration_status;
  v_payment_status public.payment_status;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.status in ('SUCCESS', 'FAILED') then return; end if;

  update public.payments
     set status = 'FAILED', failure_reason = coalesce(p_reason, failure_reason)
   where id = p_payment_id;

  select status, payment_status into v_status, v_payment_status
    from public.registrations
   where id = v_payment.registration_id
     for update;

  if v_payment_status = 'SUCCESS' then return; end if;

  update public.registrations
     set payment_status = 'FAILED',
         status = case when v_status = 'PAYMENT_PENDING'
                       then 'PAYMENT_FAILED'::public.registration_status
                       else status end
   where id = v_payment.registration_id;

  -- The reason is technical (gateway codes, "Signature mismatch") and is kept
  -- on the payment row for the team; the member gets a plain message.
  perform public.notify_user(
    v_payment.user_id, 'PAYMENT_FAILED', 'Payment failed',
    'Your payment could not be completed. You can try again at any time.');
end;
$$;

-- ── Who may call these functions ────────────────────────────────────────────
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase grants it
-- to anon and authenticated as well, exposing every public function at
-- /rest/v1/rpc. These four are SECURITY DEFINER and take the payment or user
-- to act on as a parameter, so until now any signed-in member — or anonymous
-- visitor — could call confirm_payment on their own unpaid registration and be
-- marked as paid, or call save_draft_profile to overwrite someone else's
-- profile. (Proven against the migrations in tests/db/registration-flow.test.ts.)
--
-- Each is only ever called by our Route Handlers through the service role,
-- after the server-side signature check or session check — so that is now the
-- only caller allowed.
revoke execute on function public.confirm_payment(uuid, text)                          from public, anon, authenticated;
revoke execute on function public.fail_payment(uuid, text)                             from public, anon, authenticated;
revoke execute on function public.begin_payment_retry(uuid)                            from public, anon, authenticated;
revoke execute on function public.save_draft_profile(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.confirm_payment(uuid, text)                          to service_role;
grant execute on function public.fail_payment(uuid, text)                             to service_role;
grant execute on function public.begin_payment_retry(uuid)                            to service_role;
grant execute on function public.save_draft_profile(uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
