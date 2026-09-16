-- Migration: resource_service_mode
-- Adds a service delivery mode to resources and threads it through the admin RPCs,
-- plus makes admin_update_resource able to write the PostGIS location atomically.
--
-- Empirical system model (prod ndtpovonpadugthmcntl, verified 2026-09-16):
--   * resources geo model is a SINGLE PostGIS column location geography(Point,4326);
--     lat/lng are DERIVED at read time via st_y/st_x. There are NO stored lat/lng cols.
--   * Row counts: total 19,136; approved 19,118; location IS NOT NULL 19,011;
--     approved + location NULL + website NOT NULL = 100; approved + both NULL = 8.
--
-- Migration ordering (FEED 5-step discipline):
--   1. Extensions            — none required (postgis already present).
--   2. Core types            — enum resource_service_mode (guarded).
--   3. Dependent table cols  — resources.service_mode (NOT NULL DEFAULT 'physical').
--   4. Backfill              — single UPDATE classifying online rows.
--   5. Functions + grants    — DROP+CREATE the three admin RPCs (RETURNS TABLE change),
--                              SECURITY DEFINER + search_path + admin gate + grants preserved.
--
-- Idempotent: enum guarded via pg_type check; column add guarded via IF NOT EXISTS;
-- backfill is a deterministic WHERE-scoped UPDATE (re-running is a no-op after first run);
-- functions use create-or-replace semantics (drop if exists + create).

-- ============================================================
-- 2. Core type: resource_service_mode enum (guarded)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_service_mode') THEN
    CREATE TYPE public.resource_service_mode AS ENUM ('physical', 'online', 'hybrid');
  END IF;
END;
$$;

-- ============================================================
-- 3. Dependent table column: resources.service_mode
-- NOT NULL DEFAULT 'physical' guarantees table-wide completeness for every
-- existing and future row. Guarded so re-running is safe.
-- ============================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS service_mode public.resource_service_mode NOT NULL DEFAULT 'physical';

-- ============================================================
-- 4. Backfill: classify online rows.
-- Invariant 1 (both directions): a row is 'online' IFF (location IS NULL AND website IS NOT NULL);
-- every other row stays 'physical' (from the column default). 'hybrid' is NEVER mass-assigned.
-- Applies to ALL rows regardless of status so the column is complete table-wide.
-- Expected affected rows: ~100 approved online + any non-approved null-location+website rows.
-- Idempotent: after the first run these rows already equal 'online', so re-running changes nothing.
-- ============================================================
UPDATE public.resources
   SET service_mode = 'online'
 WHERE location IS NULL
   AND website IS NOT NULL
   AND website <> ''
   AND service_mode <> 'online';

-- ============================================================
-- 5. Admin RPCs — DROP+CREATE (RETURNS TABLE shape changes require it).
-- Every function is recreated with SECURITY DEFINER + the SAME search_path pin +
-- the SAME admin gate (is_current_user_admin) + REVOKE FROM public/anon +
-- GRANT EXECUTE TO authenticated, matching each prior definition verbatim except
-- for the additive service_mode / lat / lng changes.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 5a. admin_list_resources(...)  — additive: service_mode in RETURNS TABLE.
-- Signature (arg list) is unchanged, but RETURNS TABLE changes, so DROP+CREATE.
-- All previously-returned columns keep their name/type/order; service_mode is appended.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.admin_list_resources(text, text, text, text, int, int);

create function public.admin_list_resources(
  p_state   text default null,
  p_city    text default null,
  p_search  text default null,
  p_status  text default 'approved',
  p_limit   int  default 100,
  p_offset  int  default 0
)
returns table (
  id            uuid,
  name          text,
  description   text,
  category      text,
  address_line1 text,
  city          text,
  state         text,
  zip_code      text,
  phone         text,
  email         text,
  website       text,
  status        text,
  source        text,
  is_verified   boolean,
  moderated_at  timestamptz,
  lat           double precision,
  lng           double precision,
  service_mode  text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'admin only' using errcode = '42501';
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
    r.service_mode::text
  from public.resources r
  where r.status = coalesce(p_status, 'approved')::resource_status
    and (p_state  is null or upper(r.state) = upper(p_state))
    and (p_city   is null or r.city ilike '%' || p_city || '%')
    and (
      p_search is null
      or r.name ilike '%' || p_search || '%'
      or r.description ilike '%' || p_search || '%'
    )
  order by r.name asc
  limit  greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_list_resources(text, text, text, text, int, int) from public;
revoke execute on function public.admin_list_resources(text, text, text, text, int, int) from anon;
grant  execute on function public.admin_list_resources(text, text, text, text, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5b. admin_list_pending_resources()  — additive: service_mode in RETURNS TABLE.
-- Preserves the ORIGINAL search_path pin (public only, no extensions) and the
-- 'not authorized' error text verbatim. Only service_mode (as text) is appended.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.admin_list_pending_resources();

create function public.admin_list_pending_resources()
returns table (
  id                 uuid,
  name               text,
  description        text,
  category           text,
  address            text,
  city               text,
  state              text,
  zip_code           text,
  phone              text,
  website            text,
  status             text,
  discovery_metadata jsonb,
  lat                double precision,
  lng                double precision,
  service_mode       text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.name,
    r.description,
    r.category::text,
    r.address_line1             as address,
    r.city,
    r.state,
    r.zip_code,
    r.phone,
    r.website,
    r.status::text,
    r.discovery_metadata,
    st_y(r.location::geometry)  as lat,
    st_x(r.location::geometry)  as lng,
    r.service_mode::text
  from public.resources r
  where r.status = 'pending'
  order by r.created_at asc;
end;
$$;

revoke execute on function public.admin_list_pending_resources() from public;
revoke execute on function public.admin_list_pending_resources() from anon;
grant  execute on function public.admin_list_pending_resources() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5c. admin_update_resource(...)  — additive params + atomic location write.
-- New params: p_service_mode text, p_lat double precision, p_lng double precision.
-- Invariant 2 (atomic geocode): when BOTH p_lat and p_lng are non-null, location is
--   set to ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography in the SAME UPDATE
--   and the SAME moderated stamp; when EITHER is null, location is left EXACTLY as-is
--   (a null lat/lng never nulls out an existing location).
-- Invariant 3 (service_mode round-trip): p_service_mode is COALESCE-kept like category
--   (NULL preserves; column is NOT NULL so it can never be nulled), and cast through
--   ::resource_service_mode so an invalid value raises 22P02 instead of corrupting data.
-- RETURNS TABLE gains service_mode; all prior columns unchanged. DROP+CREATE required.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text);

create function public.admin_update_resource(
  p_id            uuid,
  p_name          text default null,
  p_description   text default null,
  p_category      text default null,
  p_address_line1 text default null,
  p_city          text default null,
  p_state         text default null,
  p_zip_code      text default null,
  p_phone         text default null,
  p_email         text default null,
  p_website       text default null,
  p_status        text default null,
  p_service_mode  text default null,
  p_lat           double precision default null,
  p_lng           double precision default null
)
returns table (
  id            uuid,
  name          text,
  description   text,
  category      text,
  address_line1 text,
  city          text,
  state         text,
  zip_code      text,
  phone         text,
  email         text,
  website       text,
  status        text,
  source        text,
  is_verified   boolean,
  moderated_at  timestamptz,
  lat           double precision,
  lng           double precision,
  service_mode  text
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
         location      = case
                           when p_lat is not null and p_lng is not null
                             then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
                           else r.location
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
    r.service_mode::text
  from public.resources r
  where r.id = p_id;
end;
$$;

revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision) from public;
revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision) from anon;
grant  execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision) to authenticated;
