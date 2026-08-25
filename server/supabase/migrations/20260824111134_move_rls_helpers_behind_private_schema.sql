begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = _user_id and ur.role = _role);
$$;

create or replace function private.owns_gym(p_gym_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.gyms g
    where (g.id = p_gym_id or g.gym_id = p_gym_id)
      and (g.owner_id = p_user_id or g.owner_user_id = p_user_id)
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'gym_owner'::public.app_role
      and ur.gym_id = p_gym_id
  );
$$;

revoke all on function private.has_role(uuid, public.app_role) from public, anon;
revoke all on function private.owns_gym(uuid, uuid) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.owns_gym(uuid, uuid) to authenticated;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select case when _user_id is null or _user_id is distinct from (select auth.uid()) then false else private.has_role(_user_id, _role) end;
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select case when _user_id is null or _user_id is distinct from (select auth.uid()) then false else private.has_role(_user_id, 'admin'::public.app_role) or private.has_role(_user_id, 'super_admin'::public.app_role) end;
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select case when _user_id is null or _user_id is distinct from (select auth.uid()) then false else private.has_role(_user_id, 'super_admin'::public.app_role) end;
$$;

create or replace function public.owns_gym(p_gym_id uuid, p_user_id uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select case when p_user_id is null or p_user_id is distinct from (select auth.uid()) then false else private.owns_gym(p_gym_id, p_user_id) end;
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_super_admin(uuid) from public, anon;
revoke execute on function public.owns_gym(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.owns_gym(uuid, uuid) to authenticated;

commit;
