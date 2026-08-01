begin;

create or replace function public.sync_profile_privileged_role_from_user_roles(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_current public.app_role;
begin
  select role into v_current
  from public.profiles
  where user_id = p_user_id;

  select case
    when exists (select 1 from public.user_roles where user_id = p_user_id and role = 'super_admin') then 'super_admin'::public.app_role
    when exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then 'admin'::public.app_role
    else null
  end into v_role;

  if v_role is not null then
    update public.profiles
       set role = v_role,
           status = case when status = 'pending' then 'active'::public.user_status else status end,
           source = 'admin'::public.platform_source,
           updated_at = now()
     where user_id = p_user_id;
  elsif v_current in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    update public.profiles
       set role = 'user'::public.app_role,
           source = 'app'::public.platform_source,
           updated_at = now()
     where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.sync_profile_privileged_role_from_user_roles(uuid) from public, anon, authenticated;
grant execute on function public.sync_profile_privileged_role_from_user_roles(uuid) to service_role;

commit;
