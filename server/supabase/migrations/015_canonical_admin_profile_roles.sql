begin;

create or replace function public.sync_profile_privileged_role_from_user_roles(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
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
  end if;
end;
$$;

create or replace function public.sync_profile_privileged_role_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_privileged_role_from_user_roles(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_profile_privileged_role on public.user_roles;
create trigger trg_sync_profile_privileged_role
after insert or update or delete on public.user_roles
for each row execute function public.sync_profile_privileged_role_trigger();

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct user_id from public.user_roles where role in ('admin','super_admin')
  loop
    perform public.sync_profile_privileged_role_from_user_roles(v_user_id);
  end loop;
end;
$$;

revoke all on function public.sync_profile_privileged_role_from_user_roles(uuid) from public, anon, authenticated;
grant execute on function public.sync_profile_privileged_role_from_user_roles(uuid) to service_role;
revoke all on function public.sync_profile_privileged_role_trigger() from public, anon, authenticated;
grant execute on function public.sync_profile_privileged_role_trigger() to service_role;

commit;
