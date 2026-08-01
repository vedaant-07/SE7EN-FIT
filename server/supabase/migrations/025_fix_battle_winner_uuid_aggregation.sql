-- PostgreSQL does not provide min(uuid). Aggregate UUIDs through text ordering.

create or replace function public.settle_gym_battle_v2(
  p_battle_id uuid,
  p_progress jsonb,
  p_result_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.gym_battles%rowtype;
  v_member record;
  v_member_count integer;
  v_progress_count integer;
  v_max numeric := 0;
  v_leader_count integer := 0;
  v_winner uuid := null;
  v_minimum numeric := 1;
  v_reward integer;
  v_members jsonb := '[]'::jsonb;
  v_reward_result jsonb;
  v_final_status text := 'completed';
begin
  if p_battle_id is null or jsonb_typeof(coalesce(p_progress, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_battle_settlement' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_battle_id::text || ':battle_settlement', 0));

  select * into v_battle
  from public.gym_battles
  where battle_id = p_battle_id
  for update;
  if not found then raise exception 'battle_not_found' using errcode = 'P0002'; end if;

  if v_battle.status in ('completed', 'expired') then
    return jsonb_build_object('ok', true, 'idempotent', true, 'battle', to_jsonb(v_battle));
  end if;
  if v_battle.status <> 'active' then raise exception 'battle_not_active' using errcode = '22023'; end if;

  select count(*) into v_member_count
  from public.gym_battle_members
  where battle_id = p_battle_id and invite_status = 'accepted';

  select count(*) into v_progress_count
  from jsonb_to_recordset(p_progress) as x(user_id uuid, progress numeric, integrity_status text, evidence jsonb);

  if v_member_count <> 2 or v_progress_count <> v_member_count then
    raise exception 'battle_member_progress_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.gym_battle_members m
    where m.battle_id = p_battle_id
      and m.invite_status = 'accepted'
      and not exists (
        select 1
        from jsonb_to_recordset(p_progress) as x(user_id uuid, progress numeric)
        where x.user_id = m.user_id
      )
  ) then
    raise exception 'battle_member_progress_mismatch' using errcode = '22023';
  end if;

  if not (
    now() >= v_battle.ends_at
    or exists (
      select 1
      from jsonb_to_recordset(p_progress) as x(user_id uuid, progress numeric)
      where greatest(0, coalesce(x.progress, 0)) >= v_battle.target_value
    )
  ) then
    raise exception 'battle_not_finished' using errcode = '22023';
  end if;

  for v_member in
    select m.id,
           m.user_id,
           greatest(0, coalesce(x.progress, 0)) as progress,
           coalesce(nullif(x.integrity_status, ''), 'verified') as integrity_status,
           coalesce(x.evidence, '{}'::jsonb) as evidence
    from public.gym_battle_members m
    join jsonb_to_recordset(p_progress) as x(
      user_id uuid,
      progress numeric,
      integrity_status text,
      evidence jsonb
    ) on x.user_id = m.user_id
    where m.battle_id = p_battle_id and m.invite_status = 'accepted'
  loop
    if v_member.integrity_status <> 'verified' then
      raise exception 'battle_activity_requires_review' using errcode = '22023';
    end if;

    update public.gym_battle_members
    set progress = v_member.progress,
        verified_progress = v_member.progress,
        integrity_status = 'verified',
        evidence = v_member.evidence,
        updated_at = now()
    where id = v_member.id;

    v_max := greatest(v_max, v_member.progress);
  end loop;

  begin
    v_minimum := greatest(1, coalesce((v_battle.rules->>'minimum_reward_progress')::numeric, ceil(v_battle.target_value * 0.1)));
  exception when others then
    v_minimum := greatest(1, ceil(v_battle.target_value * 0.1));
  end;

  select count(*), min(m.user_id::text)::uuid
  into v_leader_count, v_winner
  from public.gym_battle_members m
  where m.battle_id = p_battle_id
    and m.invite_status = 'accepted'
    and m.verified_progress = v_max;

  if v_leader_count <> 1 or v_max < v_minimum then v_winner := null; end if;
  if v_max <= 0 then v_final_status := 'expired'; end if;

  update public.gym_battles
  set status = v_final_status,
      winner_user_id = v_winner,
      completed_at = now(),
      rewarded_at = now(),
      integrity_status = 'verified',
      result_snapshot = jsonb_build_object(
        'progress', p_progress,
        'winner_user_id', v_winner,
        'highest_progress', v_max,
        'minimum_reward_progress', v_minimum,
        'metadata', coalesce(p_result_metadata, '{}'::jsonb)
      ),
      version = version + 1,
      updated_at = now()
  where battle_id = p_battle_id
  returning * into v_battle;

  for v_member in
    select *
    from public.gym_battle_members
    where battle_id = p_battle_id and invite_status = 'accepted'
  loop
    v_reward := case
      when v_max <= 0 then 0
      when v_winner is null and v_member.verified_progress >= v_minimum then 70
      when v_winner is null then 0
      when v_member.user_id = v_winner and v_member.verified_progress >= v_minimum then 120
      when v_member.verified_progress >= v_minimum then 30
      else 0
    end;

    if v_reward > 0 then
      select public.grant_reward_once_v2(
        v_member.user_id,
        v_reward,
        'earn',
        'gym_battle_reward:' || p_battle_id::text,
        p_battle_id,
        'gym_battle:' || p_battle_id::text || ':reward:' || v_member.user_id::text,
        to_char(coalesce(v_battle.completed_at, now()), 'YYYY-MM'),
        jsonb_build_object('battle_id', p_battle_id, 'winner_user_id', v_winner)
      ) into v_reward_result;
    end if;

    update public.gym_battle_members
    set reward_coins = v_reward,
        rewarded_at = case when v_reward > 0 then now() else null end,
        updated_at = now()
    where id = v_member.id;

    v_members := v_members || jsonb_build_array(jsonb_build_object(
      'user_id', v_member.user_id,
      'progress', v_member.verified_progress,
      'reward_coins', v_reward
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'battle', to_jsonb(v_battle),
    'members', v_members
  );
end;
$$;

revoke execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) to service_role;
