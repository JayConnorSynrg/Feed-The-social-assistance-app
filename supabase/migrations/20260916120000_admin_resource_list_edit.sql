-- ============================================================
-- Admin editable, location-filterable resource list
--
-- Two SECURITY DEFINER RPCs that let any admin:
--   1. admin_list_resources  — list resources (default status='approved'),
--      filtered by state (2-letter), city (ILIKE), and free-text search,
--      with derived lat/lng and pagination.
--   2. admin_update_resource — edit the editable fields of one resource,
--      stamping moderated_by / moderated_at for the audit trail.
--
-- Both mirror the SECDEF idiom of the existing admin RPCs
-- (20260620000100_approve_reject_resource_rpc.sql,
--  20260627000100_admin_resources_phasec.sql):
--   * gate on public.is_current_user_admin()  (errcode 42501)
--   * SET search_path = public, extensions   (multi-schema: needs postgis in extensions)
--   * REVOKE EXECUTE FROM public/anon, GRANT EXECUTE TO authenticated
--
-- Scope is a location FILTER, not per-region permission — any admin may edit
-- any resource. Per-region authorization is deliberately deferred.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. admin_list_resources(...)
-- Lists resources by status (default 'approved') with location filters.
-- Unlike admin_list_pending_resources this has NO pending-only hard filter
-- and DOES accept state / city / search filters.
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_list_resources(
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
  lng           double precision
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
    st_x(r.location::geometry) as lng
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
-- 2. admin_update_resource(...)
-- Edits the editable fields of one resource and stamps the audit trail.
--
-- Update semantics (two tiers):
--   * REQUIRED fields (name, category, status) use COALESCE-keep — a null arg
--     keeps the current value, so they can never be cleared to NULL.
--   * OPTIONAL fields (description, address_line1, city, state, zip_code, phone,
--     email, website) are SET DIRECTLY to the passed value, so an admin can
--     clear them by sending '' or NULL. The admin UI always submits the full
--     current field set, so a direct SET reflects exactly what the admin sees.
--
-- source and submitted_by are intentionally NOT parameters — provenance is
-- immutable through this path.
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_update_resource(
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
  p_status        text default null
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
  lng           double precision
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
         -- Optional fields: SET DIRECTLY so '' / NULL clears them.
         description   = p_description,
         address_line1 = p_address_line1,
         city          = p_city,
         state         = p_state,
         zip_code      = p_zip_code,
         phone         = p_phone,
         email         = p_email,
         website       = p_website,
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
    st_x(r.location::geometry) as lng
  from public.resources r
  where r.id = p_id;
end;
$$;

revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant  execute on function public.admin_update_resource(uuid, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
