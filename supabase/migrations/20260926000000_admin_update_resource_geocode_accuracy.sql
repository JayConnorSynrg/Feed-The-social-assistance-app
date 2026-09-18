-- ─────────────────────────────────────────────────────────────
-- 20260926000000_admin_update_resource_geocode_accuracy.sql
--
-- PURPOSE: when an admin edits a resource's address in the moderation edit
-- dialog and it re-geocodes, stamp geocode_accuracy/geocode_confidence in
-- the SAME atomic write as the location update -- instead of leaving the
-- row untagged (NULL) until the next geocode-backfill cadence run picks it
-- up (20260925000000_geocode_backfill_cadence.sql).
--
-- EMPIRICAL MODEL (verified live before editing):
--   * admin_update_resource (20260918000000, lines 223-322) already writes
--     location atomically: `location = CASE WHEN p_lat IS NOT NULL AND
--     p_lng IS NOT NULL THEN st_setsrid(st_makepoint(p_lng, p_lat), 4326)::
--     geography ELSE r.location END`. It has NO p_geocode_accuracy /
--     p_geocode_confidence params today.
--   * set_resource_geocode (20260920000000) is the existing reusable
--     geocode-write primitive, but it is a SEPARATE RPC granted only to
--     service_role (not authenticated) and would require a second round
--     trip from the admin edit dialog. Since admin_update_resource already
--     updates every other field in one call, the two new params are added
--     directly to it instead of calling set_resource_geocode a second time.
--   * geocode_accuracy/geocode_confidence columns already exist as plain
--     nullable text (20260920000000) -- no new columns needed here.
--
-- INVARIANT (both directions): when location is being written (p_lat AND
-- p_lng both non-null), geocode_accuracy/geocode_confidence are set to
-- p_geocode_accuracy/p_geocode_confidence in the SAME UPDATE. When location
-- is left untouched (p_lat or p_lng null -- address unchanged, or an
-- online-only resource), geocode_accuracy/geocode_confidence are likewise
-- left EXACTLY as-is -- an edit to an unrelated field (e.g. phone) must
-- never null out or overwrite a previously-verified accuracy tag.
--
-- Entire prior body (params, SECURITY DEFINER, search_path, RETURNS TABLE
-- columns, GRANTs) preserved verbatim; the two new geocode_accuracy /
-- geocode_confidence outputs are appended as trailing RETURNS TABLE columns
-- (additive, matches the service_mode precedent in 20260918000000) so
-- existing positional callers are unaffected.
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision);

CREATE FUNCTION public.admin_update_resource(
  p_id                 uuid,
  p_name               text default null,
  p_description        text default null,
  p_category           text default null,
  p_address_line1      text default null,
  p_city               text default null,
  p_state              text default null,
  p_zip_code           text default null,
  p_phone              text default null,
  p_email              text default null,
  p_website            text default null,
  p_status             text default null,
  p_service_mode       text default null,
  p_lat                double precision default null,
  p_lng                double precision default null,
  p_geocode_accuracy   text default null,
  p_geocode_confidence text default null
)
returns table (
  id                 uuid,
  name               text,
  description        text,
  category           text,
  address_line1      text,
  city               text,
  state              text,
  zip_code           text,
  phone              text,
  email              text,
  website            text,
  status             text,
  source             text,
  is_verified        boolean,
  moderated_at       timestamptz,
  lat                double precision,
  lng                double precision,
  service_mode       text,
  geocode_accuracy   text,
  geocode_confidence text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.resources r
     -- Required fields: COALESCE-keep (never cleared to NULL).
     set name          = coalesce(p_name, r.name),
         category      = coalesce(p_category::resource_category, r.category),
         status        = coalesce(p_status::resource_status, r.status),
         -- service_mode: COALESCE-keep, validated via cast (invalid -> 22P02).
         service_mode  = coalesce(p_service_mode::resource_service_mode, r.service_mode),
         -- Optional fields: SET DIRECTLY so '' / NULL clears them.
         description   = p_description,
         address_line1 = p_address_line1,
         city          = p_city,
         state         = p_state,
         zip_code      = p_zip_code,
         phone         = p_phone,
         email         = p_email,
         website       = p_website,
         -- Atomic geocode: set location only when BOTH lat and lng are provided;
         -- otherwise preserve the existing location exactly.
         location           = case
                                 when p_lat is not null and p_lng is not null
                                   then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
                                 else r.location
                               end,
         -- Atomic accuracy/confidence stamp: written ONLY alongside a real
         -- location write (same condition as `location` above), so an edit
         -- that does not re-geocode never touches a previously-verified tag.
         geocode_accuracy   = case
                                 when p_lat is not null and p_lng is not null
                                   then p_geocode_accuracy
                                 else r.geocode_accuracy
                               end,
         geocode_confidence = case
                                 when p_lat is not null and p_lng is not null
                                   then p_geocode_confidence
                                 else r.geocode_confidence
                               end,
         moderated_by  = auth.uid(),
         moderated_at  = now(),
         updated_at    = now()
   where r.id = p_id;

  if not found then
    raise exception 'resource % not found', p_id using errcode = 'P0002';
  end if;

  return query
  select
    r.id,
    r.name,
    r.description,
    r.category::text,
    r.address_line1,
    r.city,
    r.state,
    r.zip_code,
    r.phone,
    r.email,
    r.website,
    r.status::text,
    r.source::text,
    r.is_verified,
    r.moderated_at,
    st_y(r.location::geometry) as lat,
    st_x(r.location::geometry) as lng,
    r.service_mode::text,
    r.geocode_accuracy,
    r.geocode_confidence
  from public.resources r
  where r.id = p_id;
end;
$$;

revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text) from public;
revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text) from anon;
grant  execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text) to authenticated;
