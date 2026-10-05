-- 20261017000000_org_admin_save.sql
-- Admin organizations redesign — one atomic save RPC for every org type, plus the
-- businesses_in_bounds is_active leak fix.
--
-- (a) public.admin_save_organization(p_org_id uuid, p_payload jsonb) RETURNS jsonb
--     A platform admin creates OR updates one organization (any of the 10 org_types) with
--     its location, hours, photos, linked resources and (business only) services in ONE
--     call. The client generates p_org_id up front so photos can be uploaded into the
--     `<org_id>/` storage folder before the first save.
--
--     Payload keys (all optional except name + org_type; an absent key KEEPS the stored
--     value on update, a present key — including null — SETS it):
--       name, org_type, description, website, phone, email, address, city, state, zip_code
--       location      : null | {"lng": number, "lat": number}
--       hours         : [{"day_of_week": 0-6, "open_time": "HH:MM", "close_time": "HH:MM"}]
--       photos        : [{"kind": "logo|cover|gallery", "storage_path", "url", "caption"?}]
--       resource_ids  : [uuid, ...]                         (order = sort_order)
--       business-only : business_category, cost_model, service_radius_miles, attributes,
--                       social_links, services [{"name", "description"?}]
--     Array keys REPLACE all child rows of that kind.
--
--     SECURITY DEFINER runs as the table owner, so the BEFORE triggers
--     guard_organizations_business_insert / guard_organizations_org_admin_update return early
--     (current_user is not authenticated/anon). The function therefore sets every field
--     those guards would: status, created_by, is_active and moderation fields on create, and
--     it never writes created_by / submitted_by / is_active / status / moderation fields on
--     update (so organizations_cascade_deactivate stays inert).
--
--     The body has no EXCEPTION handler: any validation failure or constraint violation
--     aborts the whole call, so the org row, children and audit row land together or not
--     at all.
--
-- (b) businesses_in_bounds gains `AND is_active` (an approved-but-deactivated business was
--     still returned to the public map). Signature, return shape and grants unchanged.
--
-- Migration order (5-step): (1) no extensions; (2)-(4) no tables; functions only;
-- (5) no RLS changes. ONE transaction; the ledger row is written in the SAME transaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) admin_save_organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_organization(p_org_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  c_org_types   constant text[] := ARRAY['food_bank','pantry','shelter','clinic','mutual_aid','other',
                                         'business','community','nonprofit','government'];
  c_categories  constant text[] := ARRAY['food','housing','health','legal','employment','childcare',
                                         'transportation','education','financial','retail','other'];
  c_cost_models constant text[] := ARRAY['free','sliding_scale','paid'];
  c_attributes  constant text[] := ARRAY['wheelchair_accessible','wifi','parking','accepts_ebt',
                                         'multilingual','woman_owned','veteran_owned','lgbtq_friendly',
                                         'black_owned'];
  c_socials     constant text[] := ARRAY['facebook','instagram','x','linkedin','youtube','tiktok'];
  c_biz_keys    constant text[] := ARRAY['business_category','cost_model','service_radius_miles',
                                         'attributes','social_links','services'];
  c_url_re      constant text := '^https?://';
  c_email_re    constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
  c_open_re     constant text := '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$';
  c_close_re    constant text := '^(([01][0-9]|2[0-3]):[0-5][0-9](:00)?|24:00(:00)?)$';
  c_photo_url   constant text := '^https?://[^/?#]+/storage/v1/object/public/org-photos/';
  v_actor        uuid;
  v_existing     text;
  v_created      boolean;
  v_name         text;
  v_org_type     text;
  v_is_business  boolean;
  v_website      text;
  v_email        text;
  v_location     geography;
  v_category     text;
  v_cost         text;
  v_radius       numeric;
  v_attrs        jsonb := '{}'::jsonb;
  v_socials      jsonb := '{}'::jsonb;
  v_item         jsonb;
  v_key          text;
  v_val          jsonb;
  v_open         time;
  v_close        time;
  v_path         text;
  v_url          text;
  v_path_re      text;
  v_logo_n       int := 0;
  v_cover_n      int := 0;
  v_new_paths    text[] := '{}';
  v_resource_ids uuid[] := '{}';
  v_removed      text[] := '{}';
  v_hours_n      int;
  v_photos_n     int;
  v_res_n        int;
  v_services_n   int;
  v_loc_set      boolean;
BEGIN
  -- ========================= GATE (first statement) =========================
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'org_save_denied: platform admin only' USING ERRCODE = '42501';
  END IF;
  v_actor := auth.uid();

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_save_invalid: p_org_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'org_save_invalid: payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- Create vs update. FOR UPDATE serializes concurrent saves of the same org.
  SELECT o.org_type INTO v_existing FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  v_created := NOT FOUND;

  -- ========================= VALIDATION (no writes) =========================
  v_name := btrim(COALESCE(p_payload->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'org_save_invalid: name is required' USING ERRCODE = '22023';
  END IF;

  v_org_type := p_payload->>'org_type';
  IF v_org_type IS NULL OR NOT (v_org_type = ANY (c_org_types)) THEN
    RAISE EXCEPTION 'org_save_invalid: org_type % is not allowed', COALESCE(v_org_type, '<missing>')
      USING ERRCODE = '22023';
  END IF;
  v_is_business := (v_org_type = 'business');

  -- Business <-> non-business switching would move a row across moderation planes.
  IF NOT v_created AND (v_existing = 'business') <> v_is_business THEN
    RAISE EXCEPTION 'org_save_invalid: cannot switch between business and non-business (% -> %)',
      v_existing, v_org_type USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'website' THEN
    v_website := NULLIF(btrim(p_payload->>'website'), '');
    IF v_website IS NOT NULL AND v_website !~* c_url_re THEN
      RAISE EXCEPTION 'org_save_invalid: website must start with http:// or https://' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_payload ? 'email' THEN
    v_email := NULLIF(btrim(p_payload->>'email'), '');
    IF v_email IS NOT NULL AND v_email !~ c_email_re THEN
      RAISE EXCEPTION 'org_save_invalid: email is not a valid address' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- location: absent -> keep; null -> clear; {lng,lat} -> set.
  IF p_payload ? 'location' AND jsonb_typeof(p_payload->'location') <> 'null' THEN
    IF jsonb_typeof(p_payload->'location') <> 'object'
       OR jsonb_typeof(p_payload->'location'->'lng') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_payload->'location'->'lat') IS DISTINCT FROM 'number'
       OR (p_payload->'location'->>'lng')::double precision NOT BETWEEN -180 AND 180
       OR (p_payload->'location'->>'lat')::double precision NOT BETWEEN -90 AND 90 THEN
      RAISE EXCEPTION 'org_save_invalid: location must be {lng: -180..180, lat: -90..90} or null'
        USING ERRCODE = '22023';
    END IF;
    v_location := ST_SetSRID(ST_MakePoint((p_payload->'location'->>'lng')::double precision,
                                          (p_payload->'location'->>'lat')::double precision), 4326)::geography;
  END IF;

  -- Business-only fields: on a non-business org they may only be absent or empty.
  IF NOT v_is_business THEN
    FOREACH v_key IN ARRAY c_biz_keys LOOP
      IF p_payload ? v_key
         AND p_payload->v_key NOT IN ('null'::jsonb, '{}'::jsonb, '[]'::jsonb, '""'::jsonb) THEN
        RAISE EXCEPTION 'org_save_invalid: % is a business-only field', v_key USING ERRCODE = '22023';
      END IF;
    END LOOP;
  ELSE
    IF p_payload ? 'business_category' THEN
      v_category := NULLIF(btrim(p_payload->>'business_category'), '');
      IF v_category IS NOT NULL AND NOT (v_category = ANY (c_categories)) THEN
        RAISE EXCEPTION 'org_save_invalid: business_category % is not allowed', v_category USING ERRCODE = '22023';
      END IF;
    END IF;
    IF p_payload ? 'cost_model' THEN
      v_cost := NULLIF(btrim(p_payload->>'cost_model'), '');
      IF v_cost IS NOT NULL AND NOT (v_cost = ANY (c_cost_models)) THEN
        RAISE EXCEPTION 'org_save_invalid: cost_model % is not allowed', v_cost USING ERRCODE = '22023';
      END IF;
    END IF;
    IF p_payload ? 'service_radius_miles' AND jsonb_typeof(p_payload->'service_radius_miles') <> 'null' THEN
      IF jsonb_typeof(p_payload->'service_radius_miles') <> 'number'
         OR (p_payload->>'service_radius_miles')::numeric < 0 THEN
        RAISE EXCEPTION 'org_save_invalid: service_radius_miles must be a number >= 0' USING ERRCODE = '22023';
      END IF;
      v_radius := (p_payload->>'service_radius_miles')::numeric;
    END IF;
    IF p_payload ? 'attributes' AND jsonb_typeof(p_payload->'attributes') <> 'null' THEN
      IF jsonb_typeof(p_payload->'attributes') <> 'object' THEN
        RAISE EXCEPTION 'org_save_invalid: attributes must be an object' USING ERRCODE = '22023';
      END IF;
      FOR v_key, v_val IN SELECT e.key, e.value FROM jsonb_each(p_payload->'attributes') e LOOP
        IF NOT (v_key = ANY (c_attributes)) OR jsonb_typeof(v_val) <> 'boolean' THEN
          RAISE EXCEPTION 'org_save_invalid: attribute % is not an allowed boolean key', v_key USING ERRCODE = '22023';
        END IF;
        IF v_val = 'true'::jsonb THEN
          v_attrs := v_attrs || jsonb_build_object(v_key, true);
        END IF;
      END LOOP;
    END IF;
    IF p_payload ? 'social_links' AND jsonb_typeof(p_payload->'social_links') <> 'null' THEN
      IF jsonb_typeof(p_payload->'social_links') <> 'object' THEN
        RAISE EXCEPTION 'org_save_invalid: social_links must be an object' USING ERRCODE = '22023';
      END IF;
      FOR v_key, v_val IN SELECT e.key, e.value FROM jsonb_each(p_payload->'social_links') e LOOP
        IF NOT (v_key = ANY (c_socials)) OR jsonb_typeof(v_val) NOT IN ('string', 'null') THEN
          RAISE EXCEPTION 'org_save_invalid: social link % is not an allowed platform', v_key USING ERRCODE = '22023';
        END IF;
        v_url := NULLIF(btrim(v_val #>> '{}'), '');
        IF v_url IS NOT NULL THEN
          IF v_url !~* c_url_re THEN
            RAISE EXCEPTION 'org_save_invalid: social link % must be an absolute http(s) URL', v_key
              USING ERRCODE = '22023';
          END IF;
          v_socials := v_socials || jsonb_build_object(v_key, v_url);
        END IF;
      END LOOP;
    END IF;
    IF p_payload ? 'services' THEN
      IF jsonb_typeof(p_payload->'services') <> 'array' THEN
        RAISE EXCEPTION 'org_save_invalid: services must be an array' USING ERRCODE = '22023';
      END IF;
      FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'services') e LOOP
        IF jsonb_typeof(v_item) <> 'object' OR btrim(COALESCE(v_item->>'name', '')) = '' THEN
          RAISE EXCEPTION 'org_save_invalid: every service needs a name' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- hours: each interval is non-zero-length; '24:00' closes only an all-day (00:00) interval;
  -- close < open is an overnight interval.
  IF p_payload ? 'hours' THEN
    IF jsonb_typeof(p_payload->'hours') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: hours must be an array' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'hours') e LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR jsonb_typeof(v_item->'day_of_week') IS DISTINCT FROM 'number'
         OR (v_item->>'day_of_week') !~ '^[0-6]$'
         OR COALESCE(v_item->>'open_time', '') !~ c_open_re
         OR COALESCE(v_item->>'close_time', '') !~ c_close_re THEN
        RAISE EXCEPTION 'org_save_invalid: each hours entry needs day_of_week 0-6, open_time HH:MM, close_time HH:MM'
          USING ERRCODE = '22023';
      END IF;
      v_open  := (v_item->>'open_time')::time;
      v_close := (v_item->>'close_time')::time;
      IF v_open = v_close THEN
        RAISE EXCEPTION 'org_save_invalid: an hours interval cannot open and close at the same time'
          USING ERRCODE = '22023';
      END IF;
      IF v_close = '24:00'::time AND v_open <> '00:00'::time THEN
        RAISE EXCEPTION 'org_save_invalid: close 24:00 is only valid with open 00:00 (open 24 hours)'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- photos: at most one logo + one cover; every file lives in this org's folder and the url
  -- is exactly the public org-photos URL of that file.
  IF p_payload ? 'photos' THEN
    IF jsonb_typeof(p_payload->'photos') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: photos must be an array' USING ERRCODE = '22023';
    END IF;
    v_path_re := '^' || p_org_id::text
              || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$';
    FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'photos') e LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR COALESCE(v_item->>'kind', '') NOT IN ('logo', 'cover', 'gallery') THEN
        RAISE EXCEPTION 'org_save_invalid: photo kind must be logo, cover or gallery' USING ERRCODE = '22023';
      END IF;
      v_path := COALESCE(v_item->>'storage_path', '');
      v_url  := COALESCE(v_item->>'url', '');
      IF v_path !~ v_path_re THEN
        RAISE EXCEPTION 'org_save_invalid: photo storage_path % is not <org_id>/<uuid>.(webp|jpg|png)', v_path
          USING ERRCODE = '22023';
      END IF;
      IF v_url !~ c_photo_url OR regexp_replace(v_url, c_photo_url, '') <> v_path THEN
        RAISE EXCEPTION 'org_save_invalid: photo url must be the public org-photos URL of its storage_path'
          USING ERRCODE = '22023';
      END IF;
      IF v_item->>'kind' = 'logo'  THEN v_logo_n  := v_logo_n + 1;  END IF;
      IF v_item->>'kind' = 'cover' THEN v_cover_n := v_cover_n + 1; END IF;
      v_new_paths := v_new_paths || v_path;
    END LOOP;
    IF v_logo_n > 1 OR v_cover_n > 1 THEN
      RAISE EXCEPTION 'org_save_invalid: at most one logo and one cover photo' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- resource_ids: ordered; every id is an approved resource.
  IF p_payload ? 'resource_ids' THEN
    IF jsonb_typeof(p_payload->'resource_ids') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: resource_ids must be an array' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(e::uuid ORDER BY ord), '{}')
      INTO v_resource_ids
      FROM jsonb_array_elements_text(p_payload->'resource_ids') WITH ORDINALITY AS t(e, ord);
    IF EXISTS (SELECT 1 FROM unnest(v_resource_ids) u(rid)
               WHERE NOT EXISTS (SELECT 1 FROM public.resources r
                                 WHERE r.id = u.rid AND r.status = 'approved')) THEN
      RAISE EXCEPTION 'org_save_invalid: every linked resource must be an approved resource'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ========================= WRITES (atomic) =========================
  IF v_created THEN
    INSERT INTO public.organizations (
      id, name, org_type, description, website, phone, email, address, city, state, zip_code,
      location, business_category, cost_model, service_radius_miles, attributes, social_links,
      created_by, submitted_by, status, is_active, moderated_by, moderated_at, rejection_reason)
    VALUES (
      p_org_id, v_name, v_org_type,
      NULLIF(btrim(p_payload->>'description'), ''),
      v_website,
      NULLIF(btrim(p_payload->>'phone'), ''),
      v_email,
      NULLIF(btrim(p_payload->>'address'), ''),
      NULLIF(btrim(p_payload->>'city'), ''),
      NULLIF(btrim(p_payload->>'state'), ''),
      NULLIF(btrim(p_payload->>'zip_code'), ''),
      v_location,
      v_category, v_cost,
      CASE WHEN v_is_business AND p_payload ? 'service_radius_miles' THEN v_radius ELSE 10 END,
      v_attrs, v_socials,
      v_actor, NULL, 'approved', true,
      CASE WHEN v_is_business THEN v_actor END,
      CASE WHEN v_is_business THEN now() END,
      NULL);
  ELSE
    UPDATE public.organizations o SET
      name        = v_name,
      org_type    = v_org_type,
      description = CASE WHEN p_payload ? 'description' THEN NULLIF(btrim(p_payload->>'description'), '') ELSE o.description END,
      website     = CASE WHEN p_payload ? 'website'     THEN v_website ELSE o.website END,
      phone       = CASE WHEN p_payload ? 'phone'       THEN NULLIF(btrim(p_payload->>'phone'), '') ELSE o.phone END,
      email       = CASE WHEN p_payload ? 'email'       THEN v_email ELSE o.email END,
      address     = CASE WHEN p_payload ? 'address'     THEN NULLIF(btrim(p_payload->>'address'), '') ELSE o.address END,
      city        = CASE WHEN p_payload ? 'city'        THEN NULLIF(btrim(p_payload->>'city'), '') ELSE o.city END,
      state       = CASE WHEN p_payload ? 'state'       THEN NULLIF(btrim(p_payload->>'state'), '') ELSE o.state END,
      zip_code    = CASE WHEN p_payload ? 'zip_code'    THEN NULLIF(btrim(p_payload->>'zip_code'), '') ELSE o.zip_code END,
      location    = CASE WHEN p_payload ? 'location'    THEN v_location ELSE o.location END,
      business_category    = CASE WHEN v_is_business AND p_payload ? 'business_category'    THEN v_category ELSE o.business_category END,
      cost_model           = CASE WHEN v_is_business AND p_payload ? 'cost_model'           THEN v_cost     ELSE o.cost_model END,
      service_radius_miles = CASE WHEN v_is_business AND p_payload ? 'service_radius_miles' THEN v_radius   ELSE o.service_radius_miles END,
      attributes           = CASE WHEN v_is_business AND p_payload ? 'attributes'           THEN v_attrs    ELSE o.attributes END,
      social_links         = CASE WHEN v_is_business AND p_payload ? 'social_links'         THEN v_socials  ELSE o.social_links END,
      updated_at  = now()
    WHERE o.id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'org_save_failed: update of organization % affected 0 rows', p_org_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_payload ? 'hours' THEN
    DELETE FROM public.business_hours h WHERE h.org_id = p_org_id;
    INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time)
    SELECT p_org_id, (e->>'day_of_week')::smallint, (e->>'open_time')::time, (e->>'close_time')::time
      FROM jsonb_array_elements(p_payload->'hours') AS e;
  END IF;

  IF p_payload ? 'photos' THEN
    SELECT COALESCE(array_agg(bp.storage_path ORDER BY bp.storage_path), '{}')
      INTO v_removed
      FROM public.business_photos bp
     WHERE bp.org_id = p_org_id AND NOT (bp.storage_path = ANY (v_new_paths));
    DELETE FROM public.business_photos bp WHERE bp.org_id = p_org_id;
    INSERT INTO public.business_photos (org_id, kind, url, storage_path, sort_order, caption)
    SELECT p_org_id, e->>'kind', e->>'url', e->>'storage_path', (ord - 1)::int,
           NULLIF(btrim(e->>'caption'), '')
      FROM jsonb_array_elements(p_payload->'photos') WITH ORDINALITY AS t(e, ord);
  END IF;

  IF p_payload ? 'resource_ids' THEN
    DELETE FROM public.org_resources r WHERE r.org_id = p_org_id;
    INSERT INTO public.org_resources (org_id, resource_id, sort_order)
    SELECT p_org_id, rid, (ord - 1)::int
      FROM unnest(v_resource_ids) WITH ORDINALITY AS t(rid, ord);
  END IF;

  IF v_is_business AND p_payload ? 'services' THEN
    DELETE FROM public.business_services s WHERE s.org_id = p_org_id;
    INSERT INTO public.business_services (org_id, name, description, sort_order)
    SELECT p_org_id, btrim(e->>'name'), NULLIF(btrim(e->>'description'), ''), (ord - 1)::int
      FROM jsonb_array_elements(p_payload->'services') WITH ORDINALITY AS t(e, ord);
  END IF;

  -- ========================= AUDIT (exactly one row) =========================
  SELECT count(*) INTO v_hours_n    FROM public.business_hours    WHERE org_id = p_org_id;
  SELECT count(*) INTO v_photos_n   FROM public.business_photos   WHERE org_id = p_org_id;
  SELECT count(*) INTO v_res_n      FROM public.org_resources     WHERE org_id = p_org_id;
  SELECT count(*) INTO v_services_n FROM public.business_services WHERE org_id = p_org_id;
  SELECT (o.location IS NOT NULL) INTO v_loc_set FROM public.organizations o WHERE o.id = p_org_id;

  PERFORM public.record_admin_action(
    v_actor,
    CASE WHEN v_is_business THEN 'business' ELSE 'org' END
      || CASE WHEN v_created THEN '.create' ELSE '.update' END,
    'organization', p_org_id::text, 'ok', NULL,
    jsonb_build_object('org_type', v_org_type, 'hours_count', v_hours_n, 'photo_count', v_photos_n,
                       'resource_count', v_res_n, 'service_count', v_services_n,
                       'location_set', v_loc_set),
    public.request_id());

  RETURN jsonb_build_object('id', p_org_id, 'created', v_created,
                            'removed_photo_paths', to_jsonb(v_removed));
END
$fn$;

-- Supabase default privileges grant EXECUTE to anon + authenticated directly; revoke both
-- PUBLIC and anon, then grant the one intended caller role (the admin gate runs inside).
REVOKE EXECUTE ON FUNCTION public.admin_save_organization(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_organization(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- (b) businesses_in_bounds — only ACTIVE approved located businesses reach the map.
--     Same signature + return shape => CREATE OR REPLACE keeps the existing grants;
--     the REVOKE/GRANT pair below restates them unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.businesses_in_bounds(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision,
  max_results integer DEFAULT 500)
 RETURNS TABLE(
   id uuid, name text, description text, org_type text,
   address text, city text, state text, phone text, website text,
   location geography, resource_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $fn$
  SELECT id, name, description, org_type, address, city, state, phone, website, location, resource_id
  FROM organizations
  WHERE org_type = 'business' AND status = 'approved' AND is_active AND location IS NOT NULL
    AND location::geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  ORDER BY name
  LIMIT max_results;
$fn$;

REVOKE EXECUTE ON FUNCTION public.businesses_in_bounds(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.businesses_in_bounds(double precision, double precision, double precision, double precision, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261017000000', 'org_admin_save');

COMMIT;
