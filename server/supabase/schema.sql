create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user', 'gym_owner', 'nagarsevak', 'super_admin')),
  provider text default 'email',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.app_users(id) on delete cascade,
  owner_name text,
  gym_name text,
  email text,
  mobile text,
  phone text,
  city text,
  address text,
  referral_code text unique,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_idx on public.app_users(role);
create index if not exists gym_owners_user_id_idx on public.gym_owners(user_id);
create index if not exists gym_owners_referral_code_idx on public.gym_owners(referral_code);
