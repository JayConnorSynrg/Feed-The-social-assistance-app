-- ============================================================
-- Phase C: Admin Resources Tab
-- 1. form_templates audit columns
-- 2. approve_form_template RPC
-- 3. admin_list_pending_resources RPC
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. form_templates audit columns
-- ─────────────────────────────────────────────────────────────
alter table public.form_templates
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 2. approve_form_template(p_id text)
-- ─────────────────────────────────────────────────────────────
create or replace function public.approve_form_template(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.form_templates
     set is_active      = true,
         moderated_by   = auth.uid(),
         moderated_at   = now(),
         updated_at     = now()
   where id = p_id;

  if not found then
    raise exception 'form_template % not found', p_id using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.approve_form_template(text) from public;
revoke execute on function public.approve_form_template(text) from anon;
grant  execute on function public.approve_form_template(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. admin_list_pending_resources()
-- Returns ONLY status='pending' rows with derived lat/lng.
-- Never touches approved rows (19 087+).
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_list_pending_resources()
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
  lng                double precision
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
    st_x(r.location::geometry)  as lng
  from public.resources r
  where r.status = 'pending'
  order by r.created_at asc;
end;
$$;

revoke execute on function public.admin_list_pending_resources() from public;
revoke execute on function public.admin_list_pending_resources() from anon;
grant  execute on function public.admin_list_pending_resources() to authenticated;
