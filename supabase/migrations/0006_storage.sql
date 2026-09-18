-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — Storage buckets and object policies
--
-- Uploads go from the browser STRAIGHT to Supabase Storage rather than through
-- a Vercel function. That keeps multi-megabyte scans off our serverless
-- bandwidth bill, and it is safe because size and MIME limits are declared on
-- the bucket itself and enforced by Supabase server-side — the client cannot
-- talk its way past them. A Route Handler afterwards reads the object's REAL
-- size and type back from the Storage API before writing the documents row,
-- so nothing downstream ever trusts a client-supplied Content-Type.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Public per the product decision: profile photos are CDN-served for speed
  -- and cost. Paths carry a 21-character random segment, so a URL cannot be
  -- guessed from a user id. Objects are hard-deleted on suspend/delete and on
  -- photo replacement, so a leaked URL cannot outlive the account.
  ('profile-photos', 'profile-photos', true, 5242880,
   array['image/webp', 'image/jpeg', 'image/png']),

  -- Private. Admin-only read (PRD §17, §18.1).
  ('aadhaar-documents', 'aadhaar-documents', false, 10485760,
   array['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),

  -- Private. Owner and admin read.
  ('educational-documents', 'educational-documents', false, 10485760,
   array['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),

  -- Public marketing assets managed from the admin CMS.
  ('site-assets', 'site-assets', true, 5242880,
   array['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml'])
on conflict (id) do nothing;

-- ── profile-photos ──────────────────────────────────────────────────────────
-- Reads need no policy: the bucket is public. Writes are pinned to a folder
-- named after the caller's own uid, so one user cannot overwrite another's
-- photo even though the bucket is world-readable.
create policy "profile photos: owner writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile photos: owner replaces"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile photos: owner or admin deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

-- ── aadhaar-documents ───────────────────────────────────────────────────────
-- Upload once, into your own folder. Only an admin may ever read it back, and
-- only through a short-lived signed URL. There is no update or delete policy
-- for anyone: Aadhaar is write-once, permanently (PRD §18.1).
create policy "aadhaar: owner uploads once"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aadhaar-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'aadhaar-documents'
        and (storage.foldername(o.name))[1] = (select auth.uid())::text
    )
  );

create policy "aadhaar: admin reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'aadhaar-documents' and public.is_admin());

-- ── educational-documents ───────────────────────────────────────────────────
create policy "certificates: owner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'educational-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "certificates: owner or admin reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'educational-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

create policy "certificates: owner replaces before verification"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'educational-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_verified_user()
  );

-- ── site-assets ─────────────────────────────────────────────────────────────
create policy "site assets: admin writes"
  on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and public.is_admin())
  with check (bucket_id = 'site-assets' and public.is_admin());
