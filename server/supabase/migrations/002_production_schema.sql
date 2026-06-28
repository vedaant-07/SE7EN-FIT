-- SE7EN FIT production schema
-- Run after 001_initial_schema.sql. This creates the real production tables used by the app,
-- gym management website, and super admin dashboard.

create extension if not exists pgcrypto;

-- Existing 001 schema used a restrictive text role check. Expand it for the production role model.
alter table if exists public.profiles drop constraint if exists profiles_role_check;

-- Enums are created defensively so this migration can run safely after partial setup.
do $$ begin
  create type public.app_role as enum ('super_admin', 'admin', 'staff', 'gym_owner', 'gym_staff', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.platform_source as enum ('app', 'website', 'gym_owner', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'blocked', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gym_status as enum ('pending', 'verified', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('pending', 'active', 'paused', 'cancelled', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'trial_booked', 'converted', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('new', 'open', 'pending', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum ('image', 'video', 'document');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_target_scope as enum ('all', 'gym_members', 'referred_users', 'custom');
exception when duplicate_object then null; end $$;

-- Shared trigger helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles production columns.
alter table public.profiles
  add column if not exists status public.user_status not null default 'active',
  add column if not exists source public.platform_source not null default 'app',
  add column if not exists last_seen_at timestamptz;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create or replace function public.has_role(target_user_id uuid, target_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = target_role
  ) or exists (
    select 1 from public.profiles p
    where p.user_id = target_user_id and p.role = target_role::text
  );
$$;

create or replace function public.is_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(target_user_id, 'super_admin') or public.has_role(target_user_id, 'admin');
$$;

-- Gyms and gym management.
create table if not exists public.gyms (
  gym_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  referral_code text unique not null,
  logo_url text,
  cover_url text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  country text default 'India',
  pincode text,
  latitude numeric,
  longitude numeric,
  status public.gym_status not null default 'pending',
  opening_hours jsonb not null default '{}'::jsonb,
  amenities jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  owner_name text,
  email text,
  phone text,
  kyc_status text not null default 'pending',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gym_id)
);

create table if not exists public.gym_staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, user_id)
);

create table if not exists public.gym_memberships (
  membership_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  referred_by_code text,
  status public.membership_status not null default 'pending',
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, user_id)
);

create table if not exists public.gym_leads (
  lead_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  source public.platform_source not null default 'website',
  name text,
  phone text,
  email text,
  city text,
  message text,
  status public.lead_status not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_attendance_logs (
  log_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid references public.gym_memberships(membership_id) on delete set null,
  date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  duration_minutes integer,
  status text not null default 'checked_in',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_equipment (
  equipment_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  name text not null,
  category text,
  quantity integer not null default 1,
  available boolean not null default true,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_plans (
  plan_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  billing_cycle text not null default 'monthly',
  duration_days integer,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fitness tracking.
create table if not exists public.workout_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  date date not null default current_date,
  workout_name text,
  workout_type text,
  duration_minutes integer,
  calories_burned integer,
  exercises jsonb not null default '[]'::jsonb,
  completed boolean not null default true,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  meal_type text,
  food_name text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  image_url text,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount_ml integer not null,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.step_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  steps integer not null default 0,
  distance_km numeric,
  calories integer,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.sleep_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  hours numeric not null default 0,
  quality text,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric not null,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  measurement_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  chest_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  biceps_cm numeric,
  thighs_cm numeric,
  notes text,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardio_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  activity text,
  duration_minutes integer,
  distance_km numeric,
  calories_burned integer,
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  habit_key text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, date, habit_key)
);

create table if not exists public.mood_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  mood text,
  energy integer,
  notes text,
  created_at timestamptz not null default now()
);

-- Planning.
create table if not exists public.workout_plans (
  plan_id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  title text not null,
  goal text,
  level text,
  duration_weeks integer,
  plan_data jsonb not null default '{}'::jsonb,
  visibility text not null default 'gym',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(plan_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, user_id)
);

create table if not exists public.diet_plans (
  plan_id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  title text not null,
  goal text,
  plan_data jsonb not null default '{}'::jsonb,
  visibility text not null default 'gym',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diet_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans(plan_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, user_id)
);

-- Media, ads, community.
create table if not exists public.media_assets (
  asset_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  bucket text not null,
  path text not null unique,
  public_url text not null,
  media_type public.media_kind not null,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  crop_position text default 'center center',
  quality_label text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.advertisements (
  ad_id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  source_type text not null default 'admin',
  source_name text,
  title text not null,
  description text,
  offer_text text,
  cta_label text,
  cta_url text,
  media_asset_id uuid references public.media_assets(asset_id) on delete set null,
  media_url text,
  media_type public.media_kind,
  media_crop text default 'center center',
  target_scope public.ad_target_scope not null default 'all',
  status text not null default 'active',
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.advertisements(ad_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source public.platform_source default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.advertisements(ad_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source public.platform_source default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  post_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  type text not null default 'general',
  content text,
  media_asset_id uuid references public.media_assets(asset_id) on delete set null,
  media_url text,
  media_type public.media_kind,
  media_crop text default 'center center',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  comment_id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(post_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(post_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

-- Challenges, leaderboard, rewards.
create table if not exists public.challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  title text not null,
  description text,
  difficulty text,
  duration_days integer not null default 7,
  reward_coins integer not null default 0,
  rules jsonb not null default '{}'::jsonb,
  target_scope text not null default 'all',
  premium_required boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(challenge_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  progress numeric not null default 0,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(challenge_id, user_id)
);

create table if not exists public.leaderboard_scores (
  score_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  period text not null default 'all_time',
  score numeric not null default 0,
  rank integer,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gym_id, period)
);

create table if not exists public.leaderboard_prizes (
  prize_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  rank integer not null,
  title text not null,
  description text,
  coins integer not null default 0,
  asset_id uuid references public.media_assets(asset_id) on delete set null,
  period text not null default 'monthly',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0,
  lifetime_earned integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  type text not null,
  source text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- AI chat.
create table if not exists public.ai_chat_messages (
  message_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null default 'ai_trainer_default',
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source text not null default 'ai_trainer',
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  date date not null default current_date,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Support, notifications, settings.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  user_name text,
  user_email text,
  user_phone text,
  source public.platform_source not null default 'app',
  subject text not null,
  message text not null,
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target public.platform_source,
  audience jsonb not null default '{}'::jsonb,
  channel text not null default 'in_app',
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(notification_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, user_id)
);

create table if not exists public.push_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  token text not null unique,
  device_info jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  scope public.platform_source,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  log_id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Payments.
create table if not exists public.subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  plan_code text not null,
  provider text,
  provider_subscription_id text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  payment_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  gym_id uuid references public.gyms(gym_id) on delete set null,
  provider text,
  provider_payment_id text,
  amount numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Owner/staff helper functions.
create or replace function public.is_gym_owner(target_user_id uuid, target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gyms g
    where g.gym_id = target_gym_id and g.owner_user_id = target_user_id
  ) or exists (
    select 1 from public.gym_owners go
    where go.gym_id = target_gym_id and go.user_id = target_user_id
  );
$$;

create or replace function public.is_gym_staff(target_user_id uuid, target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gym_staff gs
    where gs.gym_id = target_gym_id and gs.user_id = target_user_id and gs.status = 'active'
  );
$$;

create or replace function public.can_manage_gym(target_user_id uuid, target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(target_user_id) or public.is_gym_owner(target_user_id, target_gym_id) or public.is_gym_staff(target_user_id, target_gym_id);
$$;

-- Indexes.
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_gyms_owner on public.gyms(owner_user_id);
create index if not exists idx_gyms_referral on public.gyms(referral_code);
create index if not exists idx_gym_owners_user on public.gym_owners(user_id);
create index if not exists idx_gym_memberships_gym on public.gym_memberships(gym_id);
create index if not exists idx_gym_memberships_user on public.gym_memberships(user_id);
create index if not exists idx_gym_leads_gym on public.gym_leads(gym_id);
create index if not exists idx_gym_attendance_gym_date on public.gym_attendance_logs(gym_id, date);
create index if not exists idx_gym_attendance_user_date on public.gym_attendance_logs(user_id, date);
create index if not exists idx_tracking_workout_user_date on public.workout_logs(user_id, date);
create index if not exists idx_tracking_nutrition_user_date on public.nutrition_logs(user_id, date);
create index if not exists idx_tracking_water_user_date on public.water_logs(user_id, date);
create index if not exists idx_tracking_steps_user_date on public.step_logs(user_id, date);
create index if not exists idx_ads_gym_scope on public.advertisements(gym_id, target_scope, status);
create index if not exists idx_community_posts_created on public.community_posts(created_at desc);
create index if not exists idx_ai_chat_user_conversation on public.ai_chat_messages(user_id, conversation_id, created_at);
create index if not exists idx_support_status on public.support_tickets(status, priority, created_at desc);
create index if not exists idx_notifications_status on public.notifications(status, scheduled_at);

-- Updated_at triggers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','gyms','gym_owners','gym_staff','gym_memberships','gym_leads','gym_attendance_logs',
    'gym_equipment','gym_plans','workout_logs','nutrition_logs','sleep_logs','body_measurements','cardio_logs',
    'workout_plans','workout_assignments','diet_plans','diet_assignments','advertisements','community_posts',
    'community_comments','challenges','leaderboard_scores','leaderboard_prizes','reward_wallets','ai_chat_messages',
    'support_tickets','notifications','push_tokens','subscriptions'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- RLS enablement.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_roles','gyms','gym_owners','gym_staff','gym_memberships','gym_leads','gym_attendance_logs','gym_equipment','gym_plans',
    'workout_logs','nutrition_logs','water_logs','step_logs','sleep_logs','weight_logs','body_measurements','cardio_logs','habit_logs','mood_logs',
    'workout_plans','workout_assignments','diet_plans','diet_assignments','media_assets','advertisements','ad_impressions','ad_clicks',
    'community_posts','community_comments','community_likes','challenges','challenge_participants','leaderboard_scores','leaderboard_prizes',
    'reward_wallets','reward_transactions','ai_chat_messages','ai_usage_logs','support_tickets','ticket_messages','notifications','user_notifications',
    'push_tokens','app_settings','admin_logs','subscriptions','payments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Baseline RLS policies. Service role bypasses RLS; these policies protect any direct Supabase frontend reads.
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles for update using (auth.uid() = user_id or public.is_admin(auth.uid())) with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists gyms_select_accessible on public.gyms;
create policy gyms_select_accessible on public.gyms for select using (
  public.is_admin(auth.uid()) or owner_user_id = auth.uid() or public.is_gym_staff(auth.uid(), gym_id) or exists (
    select 1 from public.gym_memberships gm where gm.gym_id = gyms.gym_id and gm.user_id = auth.uid()
  )
);

drop policy if exists gyms_manage_owner_or_admin on public.gyms;
create policy gyms_manage_owner_or_admin on public.gyms for all using (public.is_admin(auth.uid()) or owner_user_id = auth.uid()) with check (public.is_admin(auth.uid()) or owner_user_id = auth.uid());

drop policy if exists memberships_select_accessible on public.gym_memberships;
create policy memberships_select_accessible on public.gym_memberships for select using (public.is_admin(auth.uid()) or user_id = auth.uid() or public.can_manage_gym(auth.uid(), gym_id));

drop policy if exists memberships_insert_own on public.gym_memberships;
create policy memberships_insert_own on public.gym_memberships for insert with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists memberships_manage_gym on public.gym_memberships;
create policy memberships_manage_gym on public.gym_memberships for update using (public.is_admin(auth.uid()) or public.can_manage_gym(auth.uid(), gym_id)) with check (public.is_admin(auth.uid()) or public.can_manage_gym(auth.uid(), gym_id));

-- Generic ownership policies for personal tracking tables.
do $$
declare table_name text;
begin
  foreach table_name in array array['workout_logs','nutrition_logs','water_logs','step_logs','sleep_logs','weight_logs','body_measurements','cardio_logs','habit_logs','mood_logs','ai_chat_messages','ai_usage_logs','reward_wallets','reward_transactions','push_tokens','user_notifications'] loop
    execute format('drop policy if exists %I_owner_select on public.%I', table_name, table_name);
    execute format('create policy %I_owner_select on public.%I for select using (user_id = auth.uid() or public.is_admin(auth.uid()))', table_name, table_name);
    execute format('drop policy if exists %I_owner_insert on public.%I', table_name, table_name);
    execute format('create policy %I_owner_insert on public.%I for insert with check (user_id = auth.uid() or public.is_admin(auth.uid()))', table_name, table_name);
    execute format('drop policy if exists %I_owner_update on public.%I', table_name, table_name);
    execute format('create policy %I_owner_update on public.%I for update using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()))', table_name, table_name);
    execute format('drop policy if exists %I_owner_delete on public.%I', table_name, table_name);
    execute format('create policy %I_owner_delete on public.%I for delete using (user_id = auth.uid() or public.is_admin(auth.uid()))', table_name, table_name);
  end loop;
end $$;

-- Public feed policies.
drop policy if exists ads_select_visible on public.advertisements;
create policy ads_select_visible on public.advertisements for select using (
  status = 'active' and (
    target_scope = 'all' or public.is_admin(auth.uid()) or public.can_manage_gym(auth.uid(), gym_id) or exists (
      select 1 from public.gym_memberships gm where gm.gym_id = advertisements.gym_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  )
);

drop policy if exists community_posts_select_active on public.community_posts;
create policy community_posts_select_active on public.community_posts for select using (status = 'active' or user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists community_posts_insert_own on public.community_posts;
create policy community_posts_insert_own on public.community_posts for insert with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists community_posts_update_own_or_admin on public.community_posts;
create policy community_posts_update_own_or_admin on public.community_posts for update using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists support_select_own_or_admin on public.support_tickets;
create policy support_select_own_or_admin on public.support_tickets for select using (user_id = auth.uid() or public.is_admin(auth.uid()) or public.can_manage_gym(auth.uid(), gym_id));

drop policy if exists support_insert_any_auth on public.support_tickets;
create policy support_insert_any_auth on public.support_tickets for insert with check (user_id = auth.uid() or user_id is null or public.is_admin(auth.uid()));

-- Storage buckets. These require the storage schema available in Supabase.
insert into storage.buckets (id, name, public)
values
  ('profile-avatars', 'profile-avatars', true),
  ('progress-photos', 'progress-photos', false),
  ('community-media', 'community-media', true),
  ('ad-media', 'ad-media', true),
  ('gym-assets', 'gym-assets', true),
  ('support-attachments', 'support-attachments', false),
  ('food-scan-images', 'food-scan-images', false)
on conflict (id) do nothing;

-- Seed production settings.
insert into public.app_settings (key, scope, value, description)
values
  ('download_links', 'website', '{"play_store_url":"","app_store_url":"","apk_url":"","status":"coming_soon"}'::jsonb, 'Public download links used on website and admin dashboard'),
  ('ai_status', 'admin', '{"trainer_enabled":true,"food_scan_enabled":true,"provider":"pending"}'::jsonb, 'AI feature provider status'),
  ('media_rules', 'admin', '{"min_long_side":1080,"max_video_seconds":120}'::jsonb, 'Production media upload rules')
on conflict (key) do nothing;
