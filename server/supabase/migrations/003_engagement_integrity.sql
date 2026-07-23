-- SE7EN FIT challenge and reward integrity hardening
-- Run after 002_production_schema.sql.

create unique index if not exists idx_reward_transactions_challenge_once
  on public.reward_transactions(user_id, type, source)
  where source is not null
    and (source like 'challenge_checkin:%' or source like 'challenge_reward:%');

create index if not exists idx_challenge_participants_user_status
  on public.challenge_participants(user_id, status, joined_at desc);

create index if not exists idx_challenge_participants_challenge
  on public.challenge_participants(challenge_id, status);

create index if not exists idx_challenges_scope_status
  on public.challenges(status, target_scope, gym_id, created_at desc);

create index if not exists idx_reward_wallets_lifetime
  on public.reward_wallets(lifetime_earned desc);

create index if not exists idx_reward_transactions_user_created
  on public.reward_transactions(user_id, created_at desc);
