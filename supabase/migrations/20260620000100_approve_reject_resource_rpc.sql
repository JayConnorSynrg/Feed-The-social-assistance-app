create or replace function public.approve_resource(p_resource_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.resources
     set status = 'approved', moderated_by = auth.uid(), moderated_at = now(), updated_at = now()
   where id = p_resource_id;
  if not found then raise exception 'resource % not found', p_resource_id using errcode='P0002'; end if;
end; $$;

create or replace function public.reject_resource(p_resource_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.resources
     set status = 'rejected', rejection_reason = p_reason, moderated_by = auth.uid(), moderated_at = now(), updated_at = now()
   where id = p_resource_id;
  if not found then raise exception 'resource % not found', p_resource_id using errcode='P0002'; end if;
end; $$;

revoke execute on function public.approve_resource(uuid, text) from public;
revoke execute on function public.approve_resource(uuid, text) from anon;
revoke execute on function public.reject_resource(uuid, text) from public;
revoke execute on function public.reject_resource(uuid, text) from anon;
grant execute on function public.approve_resource(uuid, text) to authenticated;
grant execute on function public.reject_resource(uuid, text) to authenticated;
