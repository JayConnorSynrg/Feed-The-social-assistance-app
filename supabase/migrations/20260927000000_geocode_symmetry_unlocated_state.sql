-- ─────────────────────────────────────────────────────────────
-- 20260927000000_geocode_symmetry_unlocated_state.sql
--
-- PURPOSE (two coupled changes, one PR):
--  W1 — ONE consistent geocode rule + a visible 'location error' state.
--  W2 — the read RPCs surface geocode_accuracy so the admin list/editor can
--       render a "needs location" badge for that state.
--
-- EMPIRICAL MODEL (verified live at develop tip f3966e6 before editing):
--  * resources.geocode_accuracy is plain nullable TEXT (20260920000000) with
--    NO CHECK constraint and NO enum — a new sentinel value can be written
--    with no schema/type change. Live values today: rooftop | parcel | point
--    | interpolated | approximate (+ null). We add ONE sentinel: 'unlocated'.
--  * admin_update_resource (20260926000000) writes location AND
--    geocode_accuracy/geocode_confidence ONLY when BOTH p_lat and p_lng are
--    non-null; otherwise it leaves all three EXACTLY as-is. It has no way to
--    flag "geocode was attempted, produced nothing usable, and the row has no
--    pin" without also writing coordinates. This migration adds that path.
--  * admin_list_resources / admin_list_pending_resources (20260918000000/
--    20260918000100) do NOT return geocode_accuracy, so the admin list has no
--    signal to badge. We append it (additive, trailing RETURNS TABLE column).
--  * search_resources (20260919000000) filters ONLY on status='approved' and
--    never on location, so an 'unlocated' (location-null, still-approved) row
--    stays findable in text search — the "keep findable" invariant needs no
--    change here.
--
-- INVARIANT (W1, holds identically on every geocode write path, both
-- directions — the client picks coords-or-flag, the server is the authority
-- on whether a pin already exists):
--   * STRONG match  → client passes p_lat/p_lng/p_geocode_accuracy(tier) →
--     location + precise tier written (existing behavior, unchanged).
--   * WEAK match OR geocode failure → client passes NO coords and
--     p_mark_unlocated=true. Then:
--       - row ALREADY has a pin (r.location IS NOT NULL) → nothing changes:
--         location AND geocode_accuracy left EXACTLY as-is (never overwrite a
--         good pin with a weak/failed result).
--       - row has NO pin (r.location IS NULL) → location stays null AND
--         geocode_accuracy := 'unlocated' (the visible location-error state).
--   * A later STRONG match self-heals an 'unlocated' row: p_lat/p_lng present
--     → the first CASE branch overwrites 'unlocated' with the precise tier.
--
-- FEED migration discipline: no new tables/columns/enums (sentinel is a text
-- value); every function DROP+CREATEd with SECURITY DEFINER + the SAME
-- search_path pin + the SAME admin gate + REVOKE FROM public/anon + GRANT TO
-- authenticated preserved verbatim; RETURNS TABLE changes are additive/trailing
-- so positional callers are unaffected. Idempotent (drop-if-exists + create).
-- Regenerate packages/database/types.ts after apply.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. admin_update_resource(...) — additive param p_mark_unlocated boolean.
-- Entire prior body preserved verbatim EXCEPT the geocode_accuracy CASE gains
-- one branch that writes the 'unlocated' sentinel when a weak/failed geocode
-- attempt is flagged AND the row currently has no pin. location is UNCHANGED
-- (still written only when both p_lat and p_lng are non-null), so an
-- 'unlocated' write never places coordinates.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text);

create function public.admin_update_resource(
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
  p_geocode_confidence text default null,
  p_mark_unlocated     boolean default false
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
         -- otherwise preserve the existing location exactly. p_mark_unlocated
         -- NEVER writes coordinates.
         location           = case
                                 when p_lat is not null and p_lng is not null
                                   then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
                                 else r.location
                               end,
         -- Accuracy stamp — one consistent rule, both directions:
         --   1. real location write (p_lat + p_lng) -> stamp the passed tier
         --      (self-heals a prior 'unlocated' row on a later strong match);
         --   2. weak/failed attempt flagged AND row has NO pin -> 'unlocated';
         --   3. otherwise (weak/failed attempt but row already has a pin, or
         --      no geocode attempted) -> leave the existing tag EXACTLY as-is.
         geocode_accuracy   = case
                                 when p_lat is not null and p_lng is not null
                                   then p_geocode_accuracy
                                 when p_mark_unlocated and r.location is null
                                   then 'unlocated'
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

revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text, boolean) from public;
revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text, boolean) from anon;
grant  execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision, text, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. admin_list_resources(...) — additive: geocode_accuracy in RETURNS TABLE.
-- Arg list unchanged; RETURNS TABLE gains a trailing geocode_accuracy so the
-- Manage tab can badge 'unlocated' rows. All prior columns keep name/type/order.
-- SECURITY DEFINER + search_path pin + admin gate + grants preserved verbatim.
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
  id               uuid,
  name             text,
  description      text,
  category         text,
  address_line1    text,
  city             text,
  state            text,
  zip_code         text,
  phone            text,
  email            text,
  website          text,
  status           text,
  source           text,
  is_verified      boolean,
  moderated_at     timestamptz,
  lat              double precision,
  lng              double precision,
  service_mode     text,
  geocode_accuracy text
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
    r.service_mode::text,
    r.geocode_accuracy
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
-- 3. admin_list_pending_resources() — additive: geocode_accuracy in RETURNS.
-- Preserves the ORIGINAL search_path pin (public only, no extensions) and the
-- 'not authorized' error text verbatim; only geocode_accuracy is appended so
-- the edit-then-confirm editor can badge an 'unlocated' pending row.
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
  service_mode       text,
  email              text,
  geocode_accuracy   text
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
    r.service_mode::text,
    r.email,
    r.geocode_accuracy
  from public.resources r
  where r.status = 'pending'
  order by r.created_at asc;
end;
$$;

revoke execute on function public.admin_list_pending_resources() from public;
revoke execute on function public.admin_list_pending_resources() from anon;
grant  execute on function public.admin_list_pending_resources() to authenticated;
