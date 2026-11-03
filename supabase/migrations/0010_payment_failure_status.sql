-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — A failed payment must move the registration to PAYMENT_FAILED
--
-- fail_payment() previously set payments.status and registrations.payment_status
-- but left registrations.status on PAYMENT_PENDING. Consequences, all real:
--   · the admin's "Payment failed" filter returned nothing, so there was no way
--     to find members whose payment failed in order to chase them
--   · /payment never showed its "your last payment did not go through" notice,
--     because that is keyed on the registration status
--   · the PAYMENT_FAILED enum value and its transition rules were dead code
--
-- The transition is guarded to PAYMENT_PENDING, the only legal source state
-- (0003). Calling fail_payment on an already-failed or already-succeeded
-- registration therefore stays a no-op rather than raising.
--
-- Note the matching change in /api/payment/create: a retry moves
-- PAYMENT_FAILED back to PAYMENT_PENDING before the new attempt, because the
-- machine does not allow PAYMENT_FAILED -> PAYMENT_SUCCESS directly. Without
-- that, this fix alone would make every retry fail with an illegal transition.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fail_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_status  public.registration_status;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.status = 'SUCCESS' then return; end if;

  update public.payments set status = 'FAILED' where id = p_payment_id;

  select status into v_status from public.registrations
   where id = v_payment.registration_id for update;

  update public.registrations
     set payment_status = 'FAILED',
         status = case when v_status = 'PAYMENT_PENDING'
                       then 'PAYMENT_FAILED'::public.registration_status
                       else status end
   where id = v_payment.registration_id;

  perform public.notify_user(
    v_payment.user_id, 'PAYMENT_FAILED', 'Payment failed',
    coalesce(p_reason, 'Your payment could not be completed. Please try again.'));
end;
$$;

-- Starting a fresh attempt after a failure. Separated from payment creation so
-- the state change is one auditable step, and so the legal PAYMENT_FAILED ->
-- PAYMENT_PENDING transition happens in exactly one place.
create or replace function public.begin_payment_retry(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.registrations
     set status = 'PAYMENT_PENDING', payment_status = 'PENDING'
   where user_id = p_user_id
     and status = 'PAYMENT_FAILED';
end;
$$;
