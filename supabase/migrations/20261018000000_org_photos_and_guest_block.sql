-- 20261018000000_org_photos_and_guest_block.sql
-- Admin organizations redesign — org photo storage + guest write block on the org plane.
--
-- (a) Storage bucket `org-photos`: PUBLIC (photos render by public URL on the public org /
--     business pages), 5 MB cap, image/webp|jpeg|png allowlist. There is deliberately NO
--     public SELECT policy: public object URLs still serve, while LISTING the bucket stays
--     closed. There is deliberately NO insert/update policy: uploads go through an edge
--     function that validates magic bytes and writes with the service role (same model as
--     post-images, 20260930000000).
-- (b) public.can_manage_org_photos(p_folder text): the single authority for who may list /
--     delete objects under `<org_id>/`. Guests (anonymous sign-ins) never; platform admins
--     for any UUID folder; a member only for the business they submitted.
-- (c) storage.objects policies org_photos_manager_select / org_photos_manager_delete
--     (authenticated, org-photos bucket, folder authority via (b)).
-- (d) Guest block: 15 RESTRICTIVE policies (INSERT / UPDATE / DELETE x organizations,
--     business_hours, business_photos, business_services, org_resources), TO authenticated,
--     using the guest predicate from 20260611173053_guest_access_anonymous_gating.sql. They
--     evaluate TRUE for every permanent user, so members and admins are unaffected; public
--     reads are untouched (no SELECT policy is added).
--
-- Migration order (5-step): (1) no extensions; (2)-(4) bucket row + helper function;
-- (5) RLS policies last. ONE transaction; ledger row in the SAME transaction.

BEGIN;
-- Fail fast instead of queueing behind long reads when a lock is contended.
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- (a) Bucket (idempotent upsert, mirroring post-images).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-photos', 'org-photos', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- (b) Folder authority for org photos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_org_photos(p_folder text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RETURN false;
  END IF;
  IF p_folder IS NULL
     OR p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  IF public.is_current_user_admin() THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organizations o
     WHERE o.id = p_folder::uuid
       AND o.org_type = 'business'
       AND o.submitted_by = auth.uid());
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.can_manage_org_photos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_photos(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- (c) storage.objects policies — managers list + delete inside their org folder.
--     (Storage API delete needs SELECT visibility of the object, hence both.)
-- ---------------------------------------------------------------------------
CREATE POLICY org_photos_manager_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'org-photos'
         AND public.can_manage_org_photos((storage.foldername(name))[1]));

CREATE POLICY org_photos_manager_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-photos'
         AND public.can_manage_org_photos((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- (d) Guest block — RESTRICTIVE, so it ANDs with every permissive policy.
-- ---------------------------------------------------------------------------
-- organizations
CREATE POLICY organizations_block_anon_insert ON public.organizations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY organizations_block_anon_update ON public.organizations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE)
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY organizations_block_anon_delete ON public.organizations
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);

-- business_hours
CREATE POLICY business_hours_block_anon_insert ON public.business_hours
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_hours_block_anon_update ON public.business_hours
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE)
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_hours_block_anon_delete ON public.business_hours
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);

-- business_photos
CREATE POLICY business_photos_block_anon_insert ON public.business_photos
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_photos_block_anon_update ON public.business_photos
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE)
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_photos_block_anon_delete ON public.business_photos
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);

-- business_services
CREATE POLICY business_services_block_anon_insert ON public.business_services
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_services_block_anon_update ON public.business_services
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE)
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY business_services_block_anon_delete ON public.business_services
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);

-- org_resources
CREATE POLICY org_resources_block_anon_insert ON public.org_resources
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY org_resources_block_anon_update ON public.org_resources
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE)
  WITH CHECK (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);
CREATE POLICY org_resources_block_anon_delete ON public.org_resources
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE);

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261018000000', 'org_photos_and_guest_block');

COMMIT;
