-- 20260930000000_post_images_bucket.sql
-- FEED P2 W1.2 — attach a photo to a community-feed post.
--
-- Creates the PUBLIC `post-images` storage bucket and its storage.objects RLS.
--
-- SECURITY MODEL (INV-M1 / INV-M2):
--   The bucket is PUBLIC (media=public ruling): the feed renders each photo via
--   its public URL, so SELECT must be public-read.
--
--   A public bucket makes any stored object world-readable by URL. If an
--   authenticated user could write directly, they could upload SVG/HTML bytes
--   under a spoofed image/* content-type and turn the public URL into stored
--   XSS. The bucket's allowed_mime_types only checks the DECLARED content-type
--   (spoofable), so it is defense-in-depth, not a guarantee.
--
--   Therefore there is DELIBERATELY NO direct-client INSERT policy on this
--   bucket. Every write goes through the `post-image-upload` edge function,
--   which validates the raw bytes' MAGIC NUMBERS server-side and then writes
--   via the service_role (which bypasses RLS). This is the only ingestion path,
--   so:
--     - no authenticated user can place a non-image (INV-M1), and
--     - anon/guests cannot upload (INV-M2) — a fortiori, since NO direct
--       client INSERT exists for anyone.
--
--   SELECT  : public-read (anon + authenticated) — required for <img> display.
--   DELETE  : authenticated, owner-folder only (`<uid>/...`) — supports an
--             owner-scoped delete; the account-deletion edge fn uses
--             service_role and bypasses RLS.
--   INSERT/UPDATE: none (service_role only, via the validating edge fn).

-- ---------------------------------------------------------------------------
-- 1. Bucket (idempotent) — public, 5 MB cap, image/* allowlist (defense in depth)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. RLS policies on storage.objects (idempotent)
-- ---------------------------------------------------------------------------

-- Public read: anyone (incl. anon + guests) may read post images for display.
drop policy if exists "post_images_public_select" on storage.objects;
create policy "post_images_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'post-images');

-- Owner-folder delete: an authenticated user may delete only objects under
-- their own `<uid>/` folder. (service_role account-deletion bypasses RLS.)
drop policy if exists "post_images_owner_delete" on storage.objects;
create policy "post_images_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- NOTE: no INSERT or UPDATE policy is created for anon/authenticated by design.
-- All writes flow through the post-image-upload edge function (service_role),
-- which validates image magic bytes before the object ever lands in the bucket.
