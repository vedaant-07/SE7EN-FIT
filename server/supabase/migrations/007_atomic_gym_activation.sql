-- Atomic website gym activation shared by the website and native app.

create or replace function public.activate_approved_gym_owner(
  p_user_id uuid,
  p_user_email text,
  p_code_id uuid,
  p_request_id uuid,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code public.unique_access_codes%rowtype;
  v_request public.gym_owner_requests%rowtype;
  v_gym public.gyms%rowtype;
  v_gym_id uuid;
  v_slug text;
  v_referral text;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_code_id is null or p_request_id is null then
    raise exception 'invalid_activation_request' using errcode = '22023';
  end if;

  select * into v_code
  from public.unique_access_codes
  where id = p_code_id and request_id = p_request_id
  for update;

  if not found then
    raise exception 'activation_code_not_found' using errcode = 'P0002';
  end if;

  if v_code.expires_at <= v_now and v_code.used_at is null then
    raise exception 'activation_code_expired' using errcode = '22023';
  end if;

  select * into v_request
  from public.gym_owner_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'gym_request_not_found' using errcode = 'P0002';
  end if;

  if lower(trim(v_request.owner_email)) <> lower(trim(coalesce(p_user_email, ''))) then
    raise exception 'activation_email_mismatch' using errcode = '42501';
  end if;

  if v_request.status not in ('approved', 'activated') then
    raise exception 'gym_request_not_approved' using errcode = '42501';
  end if;

  if v_code.used_at is not null and v_code.used_by is distinct from p_user_id then
    raise exception 'activation_code_already_used' using errcode = '23505';
  end if;

  -- Idempotent retry: return the already linked gym for this owner.
  select g.* into v_gym
  from public.gym_owners go
  join public.gyms g on g.gym_id = go.gym_id
  where go.user_id = p_user_id
  order by go.created_at asc
  limit 1;

  if found then
    update public.unique_access_codes
       set status = 'used', used_at = coalesce(used_at, v_now), used_by = p_user_id, updated_at = v_now
     where id = p_code_id;
    update public.gym_owner_requests
       set status = 'activated', updated_at = v_now
     where id = p_request_id;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'gym', jsonb_build_object('id', v_gym.gym_id, 'gym_id', v_gym.gym_id, 'name', v_gym.name, 'slug', v_gym.slug, 'status', v_gym.status)
    );
  end if;

  v_gym_id := gen_random_uuid();
  v_slug := trim(both '-' from regexp_replace(lower(v_request.gym_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'gym'; end if;
  v_slug := left(v_slug, 46) || '-' || left(replace(p_request_id::text, '-', ''), 8);
  v_referral := 'SE7-' || upper(left(replace(v_gym_id::text, '-', ''), 8));

  insert into public.gyms(
    gym_id, id, owner_user_id, owner_id, owner_profile_id,
    name, slug, referral_code, owner_name, email, contact_email, phone,
    city, country, gym_type, member_capacity, gym_capacity,
    status, partnership_status, onboarding_completed, metadata, branding,
    created_at, updated_at
  ) values (
    v_gym_id, v_gym_id, p_user_id, p_user_id, p_user_id,
    v_request.gym_name, v_slug, v_referral, v_request.owner_full_name,
    v_request.owner_email, v_request.owner_email, v_request.owner_phone,
    v_request.city, coalesce(v_request.country, 'India'), v_request.gym_type,
    v_request.estimated_members, v_request.estimated_members,
    'active', 'approved', false,
    jsonb_build_object('source', 'gym_owner_request', 'request_id', p_request_id),
    jsonb_build_object('source', 'gym_owner_request', 'request_id', p_request_id),
    v_now, v_now
  ) returning * into v_gym;

  insert into public.profiles(
    user_id, id, email, role, status, source, full_name, phone, metadata, updated_at
  ) values (
    p_user_id, p_user_id, lower(trim(p_user_email)), 'gym_owner', 'active', 'website',
    v_request.owner_full_name, v_request.owner_phone,
    jsonb_build_object('gym_id', v_gym_id, 'request_id', p_request_id, 'role', 'gym_owner'),
    v_now
  )
  on conflict (user_id) do update set
    id = excluded.id,
    email = excluded.email,
    role = 'gym_owner',
    status = 'active',
    source = 'website',
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    metadata = coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = v_now;

  insert into public.user_roles(user_id, role, gym_id)
  values (p_user_id, 'gym_owner', v_gym_id)
  on conflict (user_id, role) do update set gym_id = excluded.gym_id;

  insert into public.gym_owners(
    user_id, gym_id, owner_name, email, phone, kyc_status, onboarding_complete, updated_at
  ) values (
    p_user_id, v_gym_id, v_request.owner_full_name, v_request.owner_email,
    v_request.owner_phone, 'pending', false, v_now
  )
  on conflict (user_id, gym_id) do update set
    owner_name = excluded.owner_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = v_now;

  update public.unique_access_codes
     set status = 'used', used_at = v_now, used_by = p_user_id, updated_at = v_now
   where id = p_code_id;

  update public.gym_owner_requests
     set status = 'activated', updated_at = v_now
   where id = p_request_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata, ip)
  values (
    p_user_id,
    'gym_owner.activated',
    'gym',
    v_gym_id::text,
    jsonb_build_object('request_id', p_request_id, 'code_id', p_code_id),
    p_ip
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'gym', jsonb_build_object('id', v_gym_id, 'gym_id', v_gym_id, 'name', v_gym.name, 'slug', v_gym.slug, 'referral_code', v_gym.referral_code, 'status', v_gym.status)
  );
end;
$$;

revoke all on function public.activate_approved_gym_owner(uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.activate_approved_gym_owner(uuid, text, uuid, uuid, text) to service_role;
