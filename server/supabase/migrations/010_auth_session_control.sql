begin;

create or replace function public.is_auth_session_active(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = p_session_id
      and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
  );
$$;

create or replace function public.revoke_user_auth_sessions(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed_sessions integer := 0;
begin
  delete from auth.refresh_tokens
  where user_id = p_user_id::text;

  delete from auth.sessions
  where user_id = p_user_id;

  get diagnostics removed_sessions = row_count;
  return removed_sessions;
end;
$$;

revoke all on function public.is_auth_session_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_user_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.is_auth_session_active(uuid, uuid) to service_role;
grant execute on function public.revoke_user_auth_sessions(uuid) to service_role;

commit;
