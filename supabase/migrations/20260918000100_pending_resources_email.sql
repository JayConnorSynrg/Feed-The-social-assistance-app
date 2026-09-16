-- Migration: pending_resources_email
-- Fixes a data-loss regression: the admin approve-through-edit-dialog flow
-- direct-sets resources.email via admin_update_resource, but
-- admin_list_pending_resources() never returned the existing email, so the
-- edit dialog prefilled an empty value and approving would null out a real
-- email on file. This adds `email` as a NEW TRAILING column so the dialog
-- can prefill the real value.
--
-- Empirical baseline (prod ndtpovonpadugthmcntl, verified live via
-- pg_get_functiondef 2026-09-16): reproduced verbatim from
-- supabase/migrations/20260918000000_resource_service_mode.sql section 5b,
-- with ONLY `email text` appended to RETURNS TABLE (after service_mode) and
-- `r.email` appended to the select list. Everything else — SECURITY DEFINER,
-- `set search_path = public` (public ONLY, no extensions), the
-- 'not authorized' admin gate, zero args, `where status = 'pending' order by
-- created_at asc`, and the REVOKE/GRANT trio — is unchanged.
--
-- Additive + non-breaking: email is a trailing column, so existing callers
-- that destructure/select by position up to service_mode are unaffected.

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
  email              text
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
    r.email
  from public.resources r
  where r.status = 'pending'
  order by r.created_at asc;
end;
$$;

revoke execute on function public.admin_list_pending_resources() from public;
revoke execute on function public.admin_list_pending_resources() from anon;
grant  execute on function public.admin_list_pending_resources() to authenticated;
