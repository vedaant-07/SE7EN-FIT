begin;

create table if not exists public.gym_staff_invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  email text not null,
  name text,
  phone text,
  role text not null default 'trainer',
  permissions jsonb not null default '[]'::jsonb,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_staff_invitations_role_check check (role in ('manager', 'receptionist', 'trainer', 'accountant', 'custom')),
  constraint gym_staff_invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint gym_staff_invitations_email_check check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint gym_staff_invitations_expiry_check check (expires_at > created_at),
  constraint gym_staff_invitations_permissions_array_check check (jsonb_typeof(permissions) = 'array')
);

create unique index if not exists gym_staff_invitations_pending_email_uq
  on public.gym_staff_invitations (gym_id, lower(email))
  where status = 'pending';

create index if not exists gym_staff_invitations_gym_created_idx
  on public.gym_staff_invitations (gym_id, created_at desc);
create index if not exists gym_staff_invitations_expiry_idx
  on public.gym_staff_invitations (expires_at)
  where status = 'pending';

alter table public.gym_staff drop constraint if exists gym_staff_role_check;
alter table public.gym_staff
  add constraint gym_staff_role_check
  check (role in ('manager', 'receptionist', 'trainer', 'accountant', 'custom'));

alter table public.gym_staff drop constraint if exists gym_staff_status_check;
alter table public.gym_staff
  add constraint gym_staff_status_check
  check (status in ('active', 'inactive', 'suspended', 'removed'));

alter table public.gym_staff drop constraint if exists gym_staff_permissions_array_check;
alter table public.gym_staff
  add constraint gym_staff_permissions_array_check
  check (jsonb_typeof(permissions) = 'array');

create unique index if not exists gym_staff_gym_user_uq
  on public.gym_staff (gym_id, user_id)
  where user_id is not null;
create index if not exists gym_staff_gym_status_idx
  on public.gym_staff (gym_id, status, created_at desc);

alter table public.gym_plans drop constraint if exists gym_plans_billing_cycle_check;
alter table public.gym_plans
  add constraint gym_plans_billing_cycle_check
  check (billing_cycle in ('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual', 'custom'));

alter table public.gym_plans drop constraint if exists gym_plans_price_check;
alter table public.gym_plans
  add constraint gym_plans_price_check
  check (price >= 0 and price <= 10000000);

alter table public.gym_plans drop constraint if exists gym_plans_duration_days_check;
alter table public.gym_plans
  add constraint gym_plans_duration_days_check
  check (duration_days is null or duration_days between 1 and 3650);

create unique index if not exists gym_plans_gym_name_uq
  on public.gym_plans (gym_id, lower(name));
create index if not exists gym_plans_gym_active_idx
  on public.gym_plans (gym_id, active, created_at desc);

alter table public.gym_memberships
  add column if not exists plan_id uuid references public.gym_plans(plan_id) on delete set null,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists membership_number text;

create unique index if not exists gym_memberships_gym_number_uq
  on public.gym_memberships (gym_id, membership_number)
  where membership_number is not null;
create index if not exists gym_memberships_gym_joined_idx
  on public.gym_memberships (gym_id, joined_at desc);
create index if not exists gym_memberships_gym_status_idx
  on public.gym_memberships (gym_id, status, joined_at desc);

create index if not exists gym_manual_members_gym_created_idx
  on public.gym_manual_members (gym_id, created_at desc);
create index if not exists gym_manual_members_gym_status_idx
  on public.gym_manual_members (gym_id, status, created_at desc);
create index if not exists gym_attendance_logs_gym_checkin_idx
  on public.gym_attendance_logs (gym_id, check_in_at desc);
create index if not exists gym_equipment_gym_created_idx
  on public.gym_equipment (gym_id, created_at desc);
create index if not exists gym_leads_gym_created_idx
  on public.gym_leads (gym_id, created_at desc);
create index if not exists gym_leads_gym_status_idx
  on public.gym_leads (gym_id, status, created_at desc);

alter table public.gym_payments
  add column if not exists member_type text,
  add column if not exists payment_reference text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.gym_payments drop constraint if exists gym_payments_member_type_check;
alter table public.gym_payments
  add constraint gym_payments_member_type_check
  check (member_type is null or member_type in ('app', 'manual'));

create index if not exists gym_payments_gym_paid_idx
  on public.gym_payments (gym_id, paid_at desc);
create index if not exists gym_payments_gym_status_idx
  on public.gym_payments (gym_id, status, paid_at desc);
create unique index if not exists gym_payments_gym_reference_uq
  on public.gym_payments (gym_id, payment_reference)
  where payment_reference is not null;

create index if not exists gym_announcements_gym_created_idx
  on public.gym_announcements (gym_id, created_at desc);

alter table public.gym_staff_invitations enable row level security;
revoke all on public.gym_staff_invitations from anon, authenticated;
grant all on public.gym_staff_invitations to service_role;

commit;