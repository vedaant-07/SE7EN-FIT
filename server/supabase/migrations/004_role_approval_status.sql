-- SE7EN FIT role approval hardening
-- Adds explicit approval fields while keeping existing status-based code compatible.

alter table public.profiles
  add column if not exists account_status text,
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists approved_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists deactivated_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists deactivated_at timestamptz;

update public.profiles
set account_status = coalesce(account_status, status, case when role = 'gym_owner' then 'pending' else 'active' end)
where account_status is null;

create index if not exists idx_profiles_role_status on public.profiles(role, status);
create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_profiles_phone on public.profiles(phone);

alter table public.gym_owners
  add column if not exists approved_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists deactivated_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists deactivated_at timestamptz;
