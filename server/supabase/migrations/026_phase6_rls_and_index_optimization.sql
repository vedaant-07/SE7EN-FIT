-- Phase 6 performance hardening: cache auth checks and index relationship lookups.

-- Rebuild Phase 6 read policies using scalar subqueries so auth.uid() and
-- is_admin() are evaluated once per statement rather than once per row.

drop policy if exists "member reads own challenge checkins" on public.challenge_checkins;
create policy "member reads own challenge checkins" on public.challenge_checkins
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "member reads own challenge participation" on public.challenge_participants;
create policy "member reads own challenge participation" on public.challenge_participants
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "reporter reads own abuse reports" on public.engagement_abuse_reports;
create policy "reporter reads own abuse reports" on public.engagement_abuse_reports
for select to authenticated
using (
  reporter_user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own integrity flags" on public.engagement_integrity_flags;
create policy "member reads own integrity flags" on public.engagement_integrity_flags
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own leaderboard awards" on public.leaderboard_awards;
create policy "member reads own leaderboard awards" on public.leaderboard_awards
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "authenticated reads active leaderboard prizes" on public.leaderboard_prizes;
create policy "authenticated reads active leaderboard prizes" on public.leaderboard_prizes
for select to authenticated
using (
  active = true
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own leaderboard snapshots" on public.leaderboard_score_snapshots;
create policy "member reads own leaderboard snapshots" on public.leaderboard_score_snapshots
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own legacy leaderboard score" on public.leaderboard_scores;
create policy "member reads own legacy leaderboard score" on public.leaderboard_scores
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own reward transactions" on public.reward_transactions;
create policy "member reads own reward transactions" on public.reward_transactions
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

drop policy if exists "member reads own reward wallet" on public.reward_wallets;
create policy "member reads own reward wallet" on public.reward_wallets
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin((select auth.uid())))
);

-- Index relationship columns used by the Phase 6 API, review queues and RLS.
create index if not exists idx_challenge_checkins_participant
  on public.challenge_checkins(participant_id);

create index if not exists idx_engagement_abuse_reports_reported_user
  on public.engagement_abuse_reports(reported_user_id)
  where reported_user_id is not null;

create index if not exists idx_engagement_abuse_reports_reviewed_by
  on public.engagement_abuse_reports(reviewed_by)
  where reviewed_by is not null;

create index if not exists idx_engagement_integrity_flags_reviewed_by
  on public.engagement_integrity_flags(reviewed_by)
  where reviewed_by is not null;

create index if not exists idx_leaderboard_awards_prize
  on public.leaderboard_awards(prize_id)
  where prize_id is not null;

create index if not exists idx_leaderboard_awards_awarded_by
  on public.leaderboard_awards(awarded_by)
  where awarded_by is not null;

create index if not exists idx_leaderboard_prizes_created_by
  on public.leaderboard_prizes(created_by)
  where created_by is not null;

create index if not exists idx_leaderboard_prizes_gym
  on public.leaderboard_prizes(gym_id)
  where gym_id is not null;

create index if not exists idx_leaderboard_snapshots_user
  on public.leaderboard_score_snapshots(user_id, calculated_at desc);

create index if not exists idx_leaderboard_snapshots_gym
  on public.leaderboard_score_snapshots(gym_id, calculated_at desc)
  where gym_id is not null;

create index if not exists idx_gym_battles_created_by
  on public.gym_battles(created_by, created_at desc);

create index if not exists idx_gym_battles_winner
  on public.gym_battles(winner_user_id)
  where winner_user_id is not null;

create index if not exists idx_gym_battle_members_user
  on public.gym_battle_members(user_id, updated_at desc);
