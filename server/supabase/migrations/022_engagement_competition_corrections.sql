-- Phase 6 corrections: challenge governance, seed data and no-show battle protection.

insert into public.challenges(
  challenge_id, title, description, difficulty, duration_days,
  reward_coins, target_scope, premium_required, status, rules
)
values
  ('00000000-0000-4000-8000-000000000101', '7-Day Momentum', 'Reach 5,000 verified steps on seven different days.', 'Easy', 7, 200, 'all', false, 'active', '{"metric":"steps","threshold":5000,"unit":"steps","emoji":"🌟","category":"movement","action_path":"/tracking?metric=steps"}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', '10K Club', 'Complete 10,000 verified steps on fourteen different days.', 'Medium', 14, 400, 'all', false, 'active', '{"metric":"steps","threshold":10000,"unit":"steps","emoji":"👟","category":"movement","action_path":"/tracking?metric=steps"}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', '21-Day Consistency', 'Record meaningful verified movement or training on twenty-one different days.', 'Hard', 21, 650, 'all', true, 'active', '{"metric":"active_day","threshold":1,"unit":"active day","emoji":"🔥","category":"consistency","action_path":"/tracking/live"}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', 'Strength Streak', 'Complete a verified workout on thirty different days.', 'Hard', 30, 900, 'all', true, 'active', '{"metric":"workout","threshold":1,"unit":"workout","emoji":"💪","category":"training","action_path":"/workout"}'::jsonb),
  ('00000000-0000-4000-8000-000000000105', 'Hydration Reset', 'Log at least 2.5 litres of water on seven different days.', 'Easy', 7, 180, 'all', false, 'active', '{"metric":"water","threshold":2500,"unit":"ml","emoji":"💧","category":"recovery","action_path":"/tracking?metric=water"}'::jsonb),
  ('00000000-0000-4000-8000-000000000106', 'Gym Visit Sprint', 'Complete twelve staff, QR, NFC or biometric verified gym visits.', 'Medium', 12, 500, 'all', true, 'active', '{"metric":"gym_visit","threshold":1,"unit":"visit","emoji":"🏋️","category":"gym","action_path":"/my-gym"}'::jsonb),
  ('00000000-0000-4000-8000-000000000107', 'Protein Target', 'Reach at least 100 grams of logged protein on fourteen different days.', 'Medium', 14, 420, 'all', false, 'active', '{"metric":"protein","threshold":100,"unit":"g","emoji":"⚡","category":"nutrition","action_path":"/nutrition/log"}'::jsonb),
  ('00000000-0000-4000-8000-000000000108', '60-Day Transformation', 'Build sixty verified active days with training, cardio or meaningful movement.', 'Expert', 60, 2200, 'all', true, 'active', '{"metric":"active_day","threshold":1,"unit":"active day","emoji":"⚡","category":"transformation","action_path":"/tracking/live"}'::jsonb)
on conflict (challenge_id) do update
set title = excluded.title,
    description = excluded.description,
    difficulty = excluded.difficulty,
    duration_days = excluded.duration_days,
    reward_coins = excluded.reward_coins,
    target_scope = excluded.target_scope,
    premium_required = excluded.premium_required,
    status = excluded.status,
    rules = excluded.rules,
    updated_at = now();

update public.challenges
set rules = coalesce(rules, '{}'::jsonb) - 'target_days'
where rules ? 'target_days'
  and coalesce(rules->>'target_days', '') !~ '^[1-9][0-9]{0,2}$';

create or replace function public.enforce_challenge_governance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_metric text;
  v_threshold numeric;
  v_active_count integer;
begin
  new.title := left(trim(coalesce(new.title, 'Challenge')), 160);
  new.description := nullif(left(trim(coalesce(new.description, '')), 1200), '');
  new.duration_days := greatest(1, least(90, coalesce(new.duration_days, 7)));
  new.reward_coins := greatest(0, least(5000, coalesce(new.reward_coins, 0)));
  new.rules := coalesce(new.rules, '{}'::jsonb);
  v_metric := coalesce(nullif(new.rules->>'metric', ''), nullif(new.rules->>'type', ''), 'workout');

  if v_metric not in ('steps', 'water', 'protein', 'sleep', 'gym_visit', 'workout', 'active_day', 'cardio') then
    raise exception 'unsupported_challenge_metric' using errcode = '22023';
  end if;

  begin
    v_threshold := greatest(1, coalesce((new.rules->>'threshold')::numeric, 1));
  exception when others then
    raise exception 'invalid_challenge_threshold' using errcode = '22023';
  end;

  if (v_metric = 'steps' and v_threshold > 100000)
     or (v_metric = 'cardio' and v_threshold > 300)
     or (v_metric = 'water' and v_threshold > 10000)
     or (v_metric = 'protein' and v_threshold > 400)
     or (v_metric = 'sleep' and v_threshold > 16)
     or (v_metric in ('gym_visit', 'workout', 'active_day') and v_threshold > 10) then
    raise exception 'challenge_threshold_out_of_range' using errcode = '22023';
  end if;

  if new.target_scope not in ('all', 'city', 'gym') then
    raise exception 'invalid_challenge_scope' using errcode = '22023';
  end if;

  if new.created_by is not null then
    select lower(coalesce(role, 'user')) into v_role
    from public.profiles
    where user_id = new.created_by;
    v_role := coalesce(v_role, 'user');

    if v_role in ('gym_owner', 'owner') then
      if new.gym_id is null or not exists (
        select 1 from public.gyms
        where gym_id = new.gym_id and owner_user_id = new.created_by
      ) then
        raise exception 'gym_owner_challenge_scope_denied' using errcode = '42501';
      end if;
      if new.reward_coins > 500 then
        raise exception 'gym_challenge_reward_limit' using errcode = '22023';
      end if;
      new.target_scope := 'gym';
      new.premium_required := false;
      if tg_op = 'INSERT' and new.status = 'active' then
        select count(*) into v_active_count
        from public.challenges
        where created_by = new.created_by and status = 'active';
        if v_active_count >= 20 then
          raise exception 'gym_active_challenge_limit' using errcode = '54000';
        end if;
      end if;
    elsif v_role not in ('admin', 'super_admin') then
      raise exception 'challenge_creation_role_denied' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_challenge_governance on public.challenges;
create trigger trg_enforce_challenge_governance
before insert or update on public.challenges
for each row execute function public.enforce_challenge_governance();

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

  select * into v_battle from public.gym_battles where battle_id = p_battle_id for update;
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
        select 1 from jsonb_to_recordset(p_progress) as x(user_id uuid, progress numeric)
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
    select m.id, m.user_id, greatest(0, coalesce(x.progress, 0)) as progress,
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

  select count(*), min(m.user_id)
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
    select * from public.gym_battle_members
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

revoke execute on function public.enforce_challenge_governance() from public, anon, authenticated;
revoke execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) to service_role;
