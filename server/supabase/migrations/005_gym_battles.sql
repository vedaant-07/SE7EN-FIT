-- SE7EN FIT verified member-vs-member gym battles

create extension if not exists pgcrypto;

create table if not exists public.gym_battles (
  battle_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  metric text not null,
  target_value numeric not null default 1,
  duration_days integer not null default 7,
  status text not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  winner_user_id uuid references auth.users(id) on delete set null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_battle_members (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.gym_battles(battle_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invite_status text not null default 'pending',
  progress numeric not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(battle_id, user_id)
);

create index if not exists idx_gym_battles_gym_status on public.gym_battles(gym_id, status, created_at desc);
create index if not exists idx_gym_battle_members_user on public.gym_battle_members(user_id, invite_status, updated_at desc);
create index if not exists idx_gym_battle_members_battle on public.gym_battle_members(battle_id);

-- Prevent duplicate battle rewards if multiple clients refresh at the finish line.
create unique index if not exists uq_reward_gym_battle_source
  on public.reward_transactions(user_id, source)
  where source like 'gym_battle_reward:%';
