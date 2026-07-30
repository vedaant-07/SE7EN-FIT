begin;

create or replace function public.accept_gym_staff_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.gym_staff_invitations%rowtype;
  staff_row public.gym_staff%rowtype;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_invitation_id is null or p_user_id is null or normalized_email = '' then
    raise exception 'Invalid staff invitation acceptance request';
  end if;

  select * into invite_row
  from public.gym_staff_invitations
  where invitation_id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;
  if invite_row.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;
  if invite_row.expires_at <= clock_timestamp() then
    update public.gym_staff_invitations
    set status = 'expired', updated_at = clock_timestamp()
    where invitation_id = invite_row.invitation_id;
    raise exception 'Invitation has expired';
  end if;
  if lower(invite_row.email) <> normalized_email then
    raise exception 'Invitation email does not match the signed-in account';
  end if;

  select * into staff_row
  from public.gym_staff
  where gym_id = invite_row.gym_id and user_id = p_user_id
  limit 1
  for update;

  if found then
    update public.gym_staff
    set name = coalesce(invite_row.name, name),
        email = invite_row.email,
        phone = coalesce(invite_row.phone, phone),
        role = invite_row.role,
        permissions = invite_row.permissions,
        status = 'active',
        updated_at = clock_timestamp()
    where id = staff_row.id
    returning * into staff_row;
  else
    insert into public.gym_staff (
      gym_id, user_id, name, email, phone, role, permissions, status
    ) values (
      invite_row.gym_id,
      p_user_id,
      invite_row.name,
      invite_row.email,
      invite_row.phone,
      invite_row.role,
      invite_row.permissions,
      'active'
    ) returning * into staff_row;
  end if;

  insert into public.user_roles (user_id, role, gym_id)
  values (p_user_id, 'staff'::public.app_role, invite_row.gym_id)
  on conflict (user_id, role)
  do update set gym_id = excluded.gym_id;

  insert into public.profiles (
    user_id,
    email,
    role,
    status,
    source,
    full_name,
    phone,
    metadata
  ) values (
    p_user_id,
    normalized_email,
    'staff',
    'active',
    'website',
    invite_row.name,
    invite_row.phone,
    '{}'::jsonb
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    role = case
      when public.profiles.role in ('admin', 'super_admin', 'gym_owner') then public.profiles.role
      else 'staff'
    end,
    status = 'active',
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = clock_timestamp();

  update public.gym_staff_invitations
  set status = 'accepted',
      accepted_by = p_user_id,
      accepted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where invitation_id = invite_row.invitation_id;

  return jsonb_build_object(
    'staff_id', staff_row.id,
    'gym_id', staff_row.gym_id,
    'role', staff_row.role,
    'permissions', staff_row.permissions,
    'status', staff_row.status
  );
end;
$$;

revoke all on function public.accept_gym_staff_invitation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_gym_staff_invitation(uuid, uuid, text) to service_role;

commit;