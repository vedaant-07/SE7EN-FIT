-- SE7EN FIT backend schema for Supabase
-- Run this in the Supabase SQL editor or through Supabase migrations before deploying the Render backend.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'user' check (role in ('user', 'gym_owner', 'super_admin', 'nagarsevak')),
  full_name text,
  phone text,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_records (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_entity_records_type on public.entity_records (entity_type);
create index if not exists idx_entity_records_owner on public.entity_records (owner_user_id);
create index if not exists idx_entity_records_data_gin on public.entity_records using gin (data);
create index if not exists idx_entity_records_data_user_id on public.entity_records ((data->>'user_id'));
create index if not exists idx_entity_records_data_owner_id on public.entity_records ((data->>'owner_id'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_entity_records_updated_at on public.entity_records;
create trigger trg_entity_records_updated_at
before update on public.entity_records
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.entity_records enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
for select using (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists entity_records_read_accessible on public.entity_records;
create policy entity_records_read_accessible on public.entity_records
for select using (
  owner_user_id = auth.uid()
  or data->>'user_id' = auth.uid()::text
  or data->>'owner_id' = auth.uid()::text
  or entity_type in ('GymOwner', 'Challenge', 'Reward', 'Announcement', 'GymAnnouncement', 'GymEquipment')
);

drop policy if exists entity_records_insert_own on public.entity_records;
create policy entity_records_insert_own on public.entity_records
for insert with check (owner_user_id = auth.uid());

drop policy if exists entity_records_update_own on public.entity_records;
create policy entity_records_update_own on public.entity_records
for update using (
  owner_user_id = auth.uid()
  or data->>'user_id' = auth.uid()::text
  or data->>'owner_id' = auth.uid()::text
)
with check (
  owner_user_id = auth.uid()
  or data->>'user_id' = auth.uid()::text
  or data->>'owner_id' = auth.uid()::text
);

drop policy if exists entity_records_delete_own on public.entity_records;
create policy entity_records_delete_own on public.entity_records
for delete using (
  owner_user_id = auth.uid()
  or data->>'user_id' = auth.uid()::text
  or data->>'owner_id' = auth.uid()::text
);
