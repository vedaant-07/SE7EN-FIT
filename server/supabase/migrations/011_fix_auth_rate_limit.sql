begin;

create or replace function public.consume_auth_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.auth_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  next_attempts integer;
begin
  if coalesce(length(p_key_hash), 0) < 16
    or coalesce(length(p_scope), 0) < 1
    or p_limit < 1
    or p_window_seconds < 1
    or p_block_seconds < 1 then
    raise exception 'Invalid auth rate-limit arguments';
  end if;

  select * into current_row
  from public.auth_rate_limits
  where key_hash = p_key_hash
  for update;

  if not found then
    insert into public.auth_rate_limits (
      key_hash,
      scope,
      attempts,
      window_started_at,
      blocked_until,
      updated_at
    ) values (
      p_key_hash,
      p_scope,
      1,
      v_now,
      null,
      v_now
    );
    return true;
  end if;

  if current_row.blocked_until is not null and current_row.blocked_until > v_now then
    update public.auth_rate_limits
    set updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  if current_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.auth_rate_limits
    set scope = p_scope,
        attempts = 1,
        window_started_at = v_now,
        blocked_until = null,
        updated_at = v_now
    where key_hash = p_key_hash;
    return true;
  end if;

  next_attempts := current_row.attempts + 1;

  if next_attempts > p_limit then
    update public.auth_rate_limits
    set scope = p_scope,
        attempts = next_attempts,
        blocked_until = v_now + make_interval(secs => p_block_seconds),
        updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  update public.auth_rate_limits
  set scope = p_scope,
      attempts = next_attempts,
      blocked_until = null,
      updated_at = v_now
  where key_hash = p_key_hash;

  return true;
end;
$$;

revoke all on function public.consume_auth_rate_limit(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer, integer) to service_role;

commit;
