-- Phase 6 defence in depth: revoke direct competition writes and bind awards to verified snapshots.

alter table public.reward_wallets enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.leaderboard_scores enable row level security;

revoke insert, update, delete on public.reward_wallets from anon, authenticated;
revoke insert, update, delete on public.reward_transactions from anon, authenticated;
revoke insert, update, delete on public.challenge_participants from anon, authenticated;
revoke insert, update, delete on public.leaderboard_scores from anon, authenticated;

grant select on public.reward_wallets to authenticated;
grant select on public.reward_transactions to authenticated;
grant select on public.challenge_participants to authenticated;
grant select on public.leaderboard_scores to authenticated;

drop policy if exists "member reads own reward wallet" on public.reward_wallets;
create policy "member reads own reward wallet" on public.reward_wallets
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "member reads own reward transactions" on public.reward_transactions;
create policy "member reads own reward transactions" on public.reward_transactions
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "member reads own challenge participation" on public.challenge_participants;
create policy "member reads own challenge participation" on public.challenge_participants
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "member reads own legacy leaderboard score" on public.leaderboard_scores;
create policy "member reads own legacy leaderboard score" on public.leaderboard_scores
for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

create unique index if not exists uq_active_leaderboard_prize_scope_rank
  on public.leaderboard_prizes(
    scope,
    coalesce(gym_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lower(city), ''),
    rank
  )
  where active = true;

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
  v_snapshot public.leaderboard_score_snapshots%rowtype;
  v_award public.leaderboard_awards%rowtype;
  v_reward jsonb := '{}'::jsonb;
  v_existing boolean := false;
begin
  if p_cycle_id is null or p_user_id is null or p_rank < 1 or p_rank > 100
     or coalesce(p_score, 0) <= 0 then
    raise exception 'invalid_leaderboard_award' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cycle_id::text || ':rank:' || p_rank::text, 0));

  select * into v_cycle
  from public.leaderboard_cycles
  where cycle_id = p_cycle_id
  for update;
  if not found then raise exception 'leaderboard_cycle_not_found' using errcode = 'P0002'; end if;

  select * into v_award
  from public.leaderboard_awards
  where cycle_id = p_cycle_id and rank = p_rank;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true, 'award', to_jsonb(v_award), 'reward', v_reward);
  end if;

  if now() < v_cycle.ends_at or v_cycle.status not in ('open', 'locked', 'awarded') then
    raise exception 'leaderboard_cycle_not_awardable' using errcode = '22023';
  end if;

  select * into v_snapshot
  from public.leaderboard_score_snapshots
  where cycle_id = p_cycle_id
    and user_id = p_user_id
    and rank = p_rank
    and integrity_status = 'verified'
    and score > 0;
  if not found then raise exception 'verified_leaderboard_snapshot_not_found' using errcode = 'P0002'; end if;

  if v_snapshot.score <> p_score then
    raise exception 'leaderboard_score_mismatch' using errcode = '22023';
  end if;

  if p_prize_id is not null then
    select * into v_prize
    from public.leaderboard_prizes
    where prize_id = p_prize_id and active = true;
    if not found then raise exception 'leaderboard_prize_not_found' using errcode = 'P0002'; end if;
    if v_prize.scope <> v_cycle.scope or v_prize.rank <> p_rank then
      raise exception 'leaderboard_prize_scope_mismatch' using errcode = '22023';
    end if;
    if v_cycle.scope = 'gym' and coalesce(v_prize.gym_id::text, '') <> v_cycle.scope_key then
      raise exception 'leaderboard_prize_scope_mismatch' using errcode = '22023';
    end if;
    if v_cycle.scope = 'city' and lower(coalesce(v_prize.city, '')) <> lower(v_cycle.scope_key) then
      raise exception 'leaderboard_prize_scope_mismatch' using errcode = '22023';
    end if;
  end if;

  insert into public.leaderboard_awards(
    cycle_id, prize_id, user_id, rank, score, title, description,
    coins, status, awarded_by, metadata
  ) values (
    p_cycle_id, p_prize_id, p_user_id, p_rank, v_snapshot.score,
    coalesce(v_prize.title, 'Leaderboard rank ' || p_rank::text),
    v_prize.description,
    coalesce(v_prize.coins, 0),
    'awarded', p_awarded_by,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('snapshot_id', v_snapshot.snapshot_id)
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
      jsonb_build_object('cycle_id', p_cycle_id, 'rank', p_rank, 'prize_id', p_prize_id, 'snapshot_id', v_snapshot.snapshot_id)
    ) into v_reward;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', v_existing,
    'award', to_jsonb(v_award),
    'reward', v_reward
  );
end;
$$;

revoke execute on function public.award_leaderboard_prize_v2(uuid, uuid, uuid, integer, numeric, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.award_leaderboard_prize_v2(uuid, uuid, uuid, integer, numeric, uuid, jsonb) to service_role;
