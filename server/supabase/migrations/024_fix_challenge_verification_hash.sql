-- Supabase installs pgcrypto in the extensions schema. Resolve digest explicitly.

create or replace function public.record_challenge_checkin_v2(
  p_user_id uuid,
  p_challenge_id uuid,
  p_checkin_date date,
  p_metric text,
  p_verified_value numeric,
  p_threshold numeric,
  p_evidence jsonb,
  p_reward_multiplier integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_challenge public.challenges%rowtype;
  v_participant public.challenge_participants%rowtype;
  v_checkin public.challenge_checkins%rowtype;
  v_target integer;
  v_progress numeric;
  v_completed boolean;
  v_reward_amount integer := 0;
  v_reward jsonb := '{}'::jsonb;
begin
  if p_user_id is null or p_challenge_id is null or p_checkin_date is null
     or length(trim(coalesce(p_metric, ''))) < 2
     or p_verified_value < 0 or p_threshold < 0
     or p_reward_multiplier not in (1, 2) then
    raise exception 'invalid_challenge_checkin' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_challenge_id::text || ':' || p_checkin_date::text,
    0
  ));

  select * into v_challenge
  from public.challenges
  where challenge_id = p_challenge_id and status = 'active';
  if not found then raise exception 'challenge_not_found' using errcode = 'P0002'; end if;

  select * into v_participant
  from public.challenge_participants
  where challenge_id = p_challenge_id and user_id = p_user_id
  for update;
  if not found then raise exception 'challenge_not_joined' using errcode = 'P0002'; end if;

  if v_participant.status = 'completed' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'completed', true,
      'participant', to_jsonb(v_participant),
      'reward_coins', 0
    );
  end if;

  select * into v_checkin
  from public.challenge_checkins
  where challenge_id = p_challenge_id
    and user_id = p_user_id
    and checkin_date = p_checkin_date;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'completed', v_participant.status = 'completed',
      'participant', to_jsonb(v_participant),
      'checkin', to_jsonb(v_checkin),
      'reward_coins', 0
    );
  end if;

  if p_verified_value < p_threshold then
    raise exception 'activity_target_not_met' using errcode = '22023';
  end if;

  insert into public.challenge_checkins(
    challenge_id, participant_id, user_id, checkin_date, metric,
    verified_value, threshold, integrity_status, evidence, verification_hash
  ) values (
    p_challenge_id,
    v_participant.id,
    p_user_id,
    p_checkin_date,
    left(trim(p_metric), 80),
    p_verified_value,
    p_threshold,
    'verified',
    coalesce(p_evidence, '{}'::jsonb),
    encode(extensions.digest(
      p_user_id::text || ':' || p_challenge_id::text || ':' || p_checkin_date::text || ':' || p_verified_value::text,
      'sha256'
    ), 'hex')
  ) returning * into v_checkin;

  begin
    v_target := greatest(1, coalesce((v_challenge.rules->>'target_days')::integer, v_challenge.duration_days, 1));
  exception when others then
    v_target := greatest(1, coalesce(v_challenge.duration_days, 1));
  end;

  v_progress := least(v_target, coalesce(v_participant.progress, 0) + 1);
  v_completed := v_progress >= v_target;

  update public.challenge_participants
  set progress = v_progress,
      status = case when v_completed then 'completed' else 'active' end,
      completed_at = case when v_completed then coalesce(completed_at, now()) else completed_at end,
      integrity_status = 'verified',
      last_verified_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_metric', p_metric,
        'last_checkin_date', p_checkin_date
      )
  where id = v_participant.id
  returning * into v_participant;

  if v_completed then
    v_reward_amount := least(100000, greatest(0, v_challenge.reward_coins) * p_reward_multiplier);
    if v_reward_amount > 0 then
      select public.grant_reward_once_v2(
        p_user_id,
        v_reward_amount,
        'earn',
        'challenge_reward:' || p_challenge_id::text,
        p_challenge_id,
        'challenge:' || p_challenge_id::text || ':completion:' || p_user_id::text,
        to_char(p_checkin_date, 'YYYY-MM'),
        jsonb_build_object('challenge_id', p_challenge_id, 'multiplier', p_reward_multiplier)
      ) into v_reward;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'completed', v_completed,
    'participant', to_jsonb(v_participant),
    'checkin', to_jsonb(v_checkin),
    'reward_coins', v_reward_amount,
    'reward', v_reward
  );
end;
$$;

revoke execute on function public.record_challenge_checkin_v2(uuid, uuid, date, text, numeric, numeric, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_challenge_checkin_v2(uuid, uuid, date, text, numeric, numeric, jsonb, integer) to service_role;
