-- Phase 6: trusted challenges, gym battles, leaderboards, prizes and abuse reporting.

create extension if not exists pgcrypto;

alter table public.reward_transactions
  add column if not exists idempotency_key text,
  add column if not exists period_key text,
  add column if not exists integrity_status text not null default 'verified',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.reward_transactions drop constraint if exists reward_transactions_integrity_status_check;
alter table public.reward_transactions
  add constraint reward_transactions_integrity_status_check
  check (integrity_status in ('verified', 'review', 'blocked', 'reversed'));

create unique index if not exists uq_reward_transactions_idempotency
  on public.reward_transactions(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_reward_transactions_verified_period
  on public.reward_transactions(user_id, period_key, created_at desc)
  where integrity_status = 'verified';

alter table public.challenge_participants
  add column if not exists integrity_status text not null default 'verified',
  add column if not exists last_verified_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.challenge_participants drop constraint if exists challenge_participants_integrity_status_check;
alter table public.challenge_participants
  add constraint challenge_participants_integrity_status_check
  check (integrity_status in ('verified', 'review', 'blocked'));

create table if not exists public.challenge_checkins (
  checkin_id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(challenge_id) on delete cascade,
  participant_id uuid not null references public.challenge_participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  metric text not null,
  verified_value numeric not null default 0,
  threshold numeric not null default 0,
  integrity_status text not null default 'verified'
    check (integrity_status in ('verified', 'review', 'blocked')),
  evidence jsonb not null default '{}'::jsonb,
  verification_hash text,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, checkin_date)
);

create index if not exists idx_challenge_checkins_user_date
  on public.challenge_checkins(user_id, checkin_date desc);
create index if not exists idx_challenge_checkins_challenge_date
  on public.challenge_checkins(challenge_id, checkin_date desc, integrity_status);

create table if not exists public.engagement_integrity_flags (
  flag_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('activity', 'challenge', 'gym_battle', 'leaderboard', 'reward')),
  source_id text,
  metric text,
  event_date date not null default current_date,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  reason_code text not null,
  score_impact numeric not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'confirmed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_engagement_open_integrity_flag
  on public.engagement_integrity_flags(user_id, source_type, coalesce(source_id, ''), reason_code, event_date)
  where status = 'open';
create index if not exists idx_engagement_integrity_flags_status
  on public.engagement_integrity_flags(status, severity, created_at desc);

create table if not exists public.engagement_abuse_reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('challenge', 'gym_battle', 'leaderboard', 'profile')),
  source_id text,
  reason_code text not null check (reason_code in ('impossible_activity', 'duplicate_account', 'harassment', 'fake_result', 'inappropriate_content', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engagement_abuse_reports_status
  on public.engagement_abuse_reports(status, created_at desc);
create index if not exists idx_engagement_abuse_reports_reporter
  on public.engagement_abuse_reports(reporter_user_id, created_at desc);

create table if not exists public.leaderboard_prizes (
  prize_id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  scope text not null default 'global' check (scope in ('global', 'city', 'gym')),
  city text,
  rank integer not null check (rank between 1 and 100),
  title text not null,
  description text,
  coins integer not null default 0 check (coins between 0 and 100000),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_prizes
  add column if not exists scope text not null default 'global',
  add column if not exists city text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_leaderboard_prizes_scope
  on public.leaderboard_prizes(scope, gym_id, city, active, rank);

create table if not exists public.leaderboard_cycles (
  cycle_id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'city', 'gym')),
  scope_key text not null,
  period_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'locked', 'awarded', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_key, period_key)
);

create table if not exists public.leaderboard_score_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.leaderboard_cycles(cycle_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  score numeric not null default 0,
  rank integer,
  breakdown jsonb not null default '{}'::jsonb,
  integrity_status text not null default 'verified'
    check (integrity_status in ('verified', 'review', 'blocked')),
  calculated_at timestamptz not null default now(),
  unique (cycle_id, user_id)
);

create index if not exists idx_leaderboard_snapshot_cycle_rank
  on public.leaderboard_score_snapshots(cycle_id, rank, score desc);

create table if not exists public.leaderboard_awards (
  award_id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.leaderboard_cycles(cycle_id) on delete cascade,
  prize_id uuid references public.leaderboard_prizes(prize_id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank integer not null check (rank between 1 and 100),
  score numeric not null default 0,
  title text not null,
  description text,
  coins integer not null default 0 check (coins between 0 and 100000),
  status text not null default 'awarded' check (status in ('awarded', 'claimed', 'reversed')),
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  claimed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (cycle_id, rank),
  unique (cycle_id, user_id)
);

create index if not exists idx_leaderboard_awards_user
  on public.leaderboard_awards(user_id, awarded_at desc);

alter table public.gym_battles
  add column if not exists completed_at timestamptz,
  add column if not exists rewarded_at timestamptz,
  add column if not exists integrity_status text not null default 'verified',
  add column if not exists result_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists cancelled_reason text,
  add column if not exists version integer not null default 1;

alter table public.gym_battles drop constraint if exists gym_battles_integrity_status_check;
alter table public.gym_battles
  add constraint gym_battles_integrity_status_check
  check (integrity_status in ('verified', 'review', 'blocked'));

alter table public.gym_battles drop constraint if exists gym_battles_status_check;
alter table public.gym_battles
  add constraint gym_battles_status_check
  check (status in ('pending', 'active', 'completed', 'cancelled', 'expired'));

alter table public.gym_battles drop constraint if exists gym_battles_metric_check;
alter table public.gym_battles
  add constraint gym_battles_metric_check
  check (metric in ('steps', 'workouts', 'cardio', 'gym_visits'));

alter table public.gym_battles drop constraint if exists gym_battles_duration_check;
alter table public.gym_battles
  add constraint gym_battles_duration_check
  check (duration_days in (3, 7, 14));

alter table public.gym_battle_members
  add column if not exists verified_progress numeric not null default 0,
  add column if not exists integrity_status text not null default 'verified',
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists reward_coins integer not null default 0,
  add column if not exists rewarded_at timestamptz;

alter table public.gym_battle_members drop constraint if exists gym_battle_members_integrity_status_check;
alter table public.gym_battle_members
  add constraint gym_battle_members_integrity_status_check
  check (integrity_status in ('verified', 'review', 'blocked'));

create or replace function public.grant_reward_once_v2(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_source text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_period_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.reward_transactions%rowtype;
  v_wallet public.reward_wallets%rowtype;
  v_existing boolean := false;
begin
  if p_user_id is null or length(trim(coalesce(p_source, ''))) < 3
     or length(trim(coalesce(p_idempotency_key, ''))) < 8
     or p_amount < -100000 or p_amount > 100000
     or p_type not in ('earn', 'redeem', 'adjustment', 'reversal') then
    raise exception 'invalid_reward_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':reward_wallet', 0));

  select * into v_tx
  from public.reward_transactions
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    v_existing := true;
  else
    insert into public.reward_transactions(
      user_id, amount, type, source, reference_id, idempotency_key,
      period_key, integrity_status, metadata
    ) values (
      p_user_id, p_amount, p_type, left(trim(p_source), 240), p_reference_id,
      left(trim(p_idempotency_key), 240), nullif(trim(coalesce(p_period_key, '')), ''),
      'verified', coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('server_granted', true)
    ) returning * into v_tx;

    insert into public.reward_wallets(user_id, coins, lifetime_earned, updated_at)
    values (
      p_user_id,
      greatest(0, p_amount),
      greatest(0, case when p_type in ('earn', 'reversal') then p_amount else 0 end),
      now()
    )
    on conflict (user_id) do update
    set coins = greatest(0, public.reward_wallets.coins + p_amount),
        lifetime_earned = greatest(
          0,
          public.reward_wallets.lifetime_earned
            + case when p_type in ('earn', 'reversal') then p_amount else 0 end
        ),
        updated_at = now()
    returning * into v_wallet;
  end if;

  if v_existing then
    select * into v_wallet from public.reward_wallets where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', v_existing,
    'transaction', to_jsonb(v_tx),
    'wallet', coalesce(to_jsonb(v_wallet), jsonb_build_object('user_id', p_user_id, 'coins', 0, 'lifetime_earned', 0))
  );
end;
$$;

create or replace function public.join_challenge_v2(
  p_user_id uuid,
  p_challenge_id uuid,
  p_gym_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges%rowtype;
  v_participant public.challenge_participants%rowtype;
begin
  if p_user_id is null or p_challenge_id is null then
    raise exception 'invalid_challenge_join' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_challenge_id::text, 0));

  select * into v_challenge
  from public.challenges
  where challenge_id = p_challenge_id and status = 'active';
  if not found then raise exception 'challenge_not_found' using errcode = 'P0002'; end if;

  select * into v_participant
  from public.challenge_participants
  where challenge_id = p_challenge_id and user_id = p_user_id;

  if not found then
    insert into public.challenge_participants(
      challenge_id, user_id, gym_id, progress, status, integrity_status, metadata
    ) values (
      p_challenge_id, p_user_id, coalesce(v_challenge.gym_id, p_gym_id),
      0, 'active', 'verified', jsonb_build_object('joined_via', 'engagement_v2')
    ) returning * into v_participant;
  end if;

  return jsonb_build_object('ok', true, 'participant', to_jsonb(v_participant));
end;
$$;

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
set search_path = public
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
  v_existing boolean := false;
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
    v_existing := true;
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
    p_challenge_id, v_participant.id, p_user_id, p_checkin_date, left(trim(p_metric), 80),
    p_verified_value, p_threshold, 'verified', coalesce(p_evidence, '{}'::jsonb),
    encode(digest(
      p_user_id::text || ':' || p_challenge_id::text || ':' || p_checkin_date::text || ':' || p_verified_value::text,
      'sha256'
    ), 'hex')
  ) returning * into v_checkin;

  v_target := greatest(1, coalesce((v_challenge.rules->>'target_days')::integer, v_challenge.duration_days, 1));
  v_progress := least(v_target, coalesce(v_participant.progress, 0) + 1);
  v_completed := v_progress >= v_target;

  update public.challenge_participants
  set progress = v_progress,
      status = case when v_completed then 'completed' else 'active' end,
      completed_at = case when v_completed then coalesce(completed_at, now()) else completed_at end,
      integrity_status = 'verified',
      last_verified_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_metric', p_metric, 'last_checkin_date', p_checkin_date),
      joined_at = joined_at
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
    'idempotent', v_existing,
    'completed', v_completed,
    'participant', to_jsonb(v_participant),
    'checkin', to_jsonb(v_checkin),
    'reward_coins', v_reward_amount,
    'reward', v_reward
  );
end;
$$;

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
  v_max numeric := 0;
  v_leader_count integer := 0;
  v_winner uuid := null;
  v_reward integer;
  v_members jsonb := '[]'::jsonb;
  v_reward_result jsonb;
begin
  if p_battle_id is null or jsonb_typeof(coalesce(p_progress, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_battle_settlement' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_battle_id::text || ':battle_settlement', 0));

  select * into v_battle from public.gym_battles where battle_id = p_battle_id for update;
  if not found then raise exception 'battle_not_found' using errcode = 'P0002'; end if;

  if v_battle.status = 'completed' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'battle', to_jsonb(v_battle));
  end if;
  if v_battle.status <> 'active' then raise exception 'battle_not_active' using errcode = '22023'; end if;

  if not (
    now() >= v_battle.ends_at
    or exists (
      select 1
      from jsonb_to_recordset(p_progress) as x(user_id uuid, progress numeric)
      where coalesce(x.progress, 0) >= v_battle.target_value
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

  select count(*), min(m.user_id)
  into v_leader_count, v_winner
  from public.gym_battle_members m
  where m.battle_id = p_battle_id
    and m.invite_status = 'accepted'
    and m.verified_progress = v_max;

  if v_leader_count <> 1 then v_winner := null; end if;

  update public.gym_battles
  set status = 'completed',
      winner_user_id = v_winner,
      completed_at = now(),
      rewarded_at = now(),
      integrity_status = 'verified',
      result_snapshot = jsonb_build_object(
        'progress', p_progress,
        'winner_user_id', v_winner,
        'highest_progress', v_max,
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
      when v_winner is null then 70
      when v_member.user_id = v_winner then 120
      else 30
    end;

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

    update public.gym_battle_members
    set reward_coins = v_reward,
        rewarded_at = now(),
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

create or replace function public.award_leaderboard_prize_v2(
  p_cycle_id uuid,
  p_prize_id uuid,
  p_user_id uuid,
  p_rank integer,
  p_score numeric,
  p_awarded_by uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.leaderboard_cycles%rowtype;
  v_prize public.leaderboard_prizes%rowtype;
  v_award public.leaderboard_awards%rowtype;
  v_reward jsonb := '{}'::jsonb;
  v_existing boolean := false;
begin
  if p_cycle_id is null or p_user_id is null or p_rank < 1 or p_rank > 100 then
    raise exception 'invalid_leaderboard_award' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cycle_id::text || ':rank:' || p_rank::text, 0));

  select * into v_cycle from public.leaderboard_cycles where cycle_id = p_cycle_id for update;
  if not found then raise exception 'leaderboard_cycle_not_found' using errcode = 'P0002'; end if;

  if p_prize_id is not null then
    select * into v_prize from public.leaderboard_prizes where prize_id = p_prize_id and active = true;
  end if;

  select * into v_award from public.leaderboard_awards where cycle_id = p_cycle_id and rank = p_rank;
  if found then
    v_existing := true;
  else
    insert into public.leaderboard_awards(
      cycle_id, prize_id, user_id, rank, score, title, description,
      coins, status, awarded_by, metadata
    ) values (
      p_cycle_id, p_prize_id, p_user_id, p_rank, greatest(0, coalesce(p_score, 0)),
      coalesce(v_prize.title, 'Leaderboard rank ' || p_rank::text),
      v_prize.description,
      coalesce(v_prize.coins, 0),
      'awarded', p_awarded_by, coalesce(p_metadata, '{}'::jsonb)
    ) returning * into v_award;

    if v_award.coins > 0 then
      select public.grant_reward_once_v2(
        p_user_id,
        v_award.coins,
        'earn',
        'leaderboard_prize:' || v_award.award_id::text,
        v_award.award_id,
        'leaderboard:' || p_cycle_id::text || ':rank:' || p_rank::text,
        v_cycle.period_key,
        jsonb_build_object('cycle_id', p_cycle_id, 'rank', p_rank, 'prize_id', p_prize_id)
      ) into v_reward;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', v_existing,
    'award', to_jsonb(v_award),
    'reward', v_reward
  );
end;
$$;

alter table public.challenge_checkins enable row level security;
alter table public.engagement_integrity_flags enable row level security;
alter table public.engagement_abuse_reports enable row level security;
alter table public.leaderboard_prizes enable row level security;
alter table public.leaderboard_cycles enable row level security;
alter table public.leaderboard_score_snapshots enable row level security;
alter table public.leaderboard_awards enable row level security;

 drop policy if exists "member reads own challenge checkins" on public.challenge_checkins;
create policy "member reads own challenge checkins" on public.challenge_checkins
for select to authenticated using (user_id = auth.uid());

 drop policy if exists "member reads own integrity flags" on public.engagement_integrity_flags;
create policy "member reads own integrity flags" on public.engagement_integrity_flags
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

 drop policy if exists "reporter reads own abuse reports" on public.engagement_abuse_reports;
create policy "reporter reads own abuse reports" on public.engagement_abuse_reports
for select to authenticated using (reporter_user_id = auth.uid() or public.is_admin(auth.uid()));

 drop policy if exists "authenticated reads active leaderboard prizes" on public.leaderboard_prizes;
create policy "authenticated reads active leaderboard prizes" on public.leaderboard_prizes
for select to authenticated using (active = true or public.is_admin(auth.uid()));

 drop policy if exists "member reads relevant leaderboard cycles" on public.leaderboard_cycles;
create policy "member reads relevant leaderboard cycles" on public.leaderboard_cycles
for select to authenticated using (true);

 drop policy if exists "member reads own leaderboard snapshots" on public.leaderboard_score_snapshots;
create policy "member reads own leaderboard snapshots" on public.leaderboard_score_snapshots
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

 drop policy if exists "member reads own leaderboard awards" on public.leaderboard_awards;
create policy "member reads own leaderboard awards" on public.leaderboard_awards
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

revoke all on public.challenge_checkins from anon, authenticated;
revoke all on public.engagement_integrity_flags from anon, authenticated;
revoke all on public.engagement_abuse_reports from anon, authenticated;
revoke all on public.leaderboard_cycles from anon, authenticated;
revoke all on public.leaderboard_score_snapshots from anon, authenticated;
revoke all on public.leaderboard_awards from anon, authenticated;

grant select on public.challenge_checkins to authenticated;
grant select on public.engagement_integrity_flags to authenticated;
grant select on public.engagement_abuse_reports to authenticated;
grant select on public.leaderboard_prizes to authenticated;
grant select on public.leaderboard_cycles to authenticated;
grant select on public.leaderboard_score_snapshots to authenticated;
grant select on public.leaderboard_awards to authenticated;

grant all on public.challenge_checkins to service_role;
grant all on public.engagement_integrity_flags to service_role;
grant all on public.engagement_abuse_reports to service_role;
grant all on public.leaderboard_prizes to service_role;
grant all on public.leaderboard_cycles to service_role;
grant all on public.leaderboard_score_snapshots to service_role;
grant all on public.leaderboard_awards to service_role;

revoke execute on function public.grant_reward_once_v2(uuid, integer, text, text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.join_challenge_v2(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_challenge_checkin_v2(uuid, uuid, date, text, numeric, numeric, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.award_leaderboard_prize_v2(uuid, uuid, uuid, integer, numeric, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.grant_reward_once_v2(uuid, integer, text, text, uuid, text, text, jsonb) to service_role;
grant execute on function public.join_challenge_v2(uuid, uuid, uuid) to service_role;
grant execute on function public.record_challenge_checkin_v2(uuid, uuid, date, text, numeric, numeric, jsonb, integer) to service_role;
grant execute on function public.settle_gym_battle_v2(uuid, jsonb, jsonb) to service_role;
grant execute on function public.award_leaderboard_prize_v2(uuid, uuid, uuid, integer, numeric, uuid, jsonb) to service_role;
