-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Restore check_rate_limit()
--
-- Commit b4598d7 edited the already-applied migration 0003 in place and, along
-- with its other changes, deleted check_rate_limit(). The live database still
-- has the function (0003 was applied there before the edit, and an applied
-- migration is never re-run), but any database built from these files does
-- not — so on a fresh environment every rate-limited route and the OTP
-- service fail or silently stop limiting, and `npm run gen:types` drops the
-- function from types/database.ts, breaking the build.
--
-- This re-creates it exactly as originally written in 0003. On a database
-- that already has it, `create or replace` with the same body changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rate limiting, without a paid Redis tier ────────────────────────────────
-- Fixed-window counter. Returns true when the request is allowed.
create or replace function public.check_rate_limit(
  p_key             text,
  p_limit           integer,
  p_window_seconds  integer
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_start  timestamptz;
  v_count  integer;
begin
  insert into public.rate_limits (bucket_key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set window_start = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now else public.rate_limits.window_start end,
        count = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1 else public.rate_limits.count + 1 end
  returning window_start, count into v_start, v_count;

  return v_count <= p_limit;
end;
$$;
