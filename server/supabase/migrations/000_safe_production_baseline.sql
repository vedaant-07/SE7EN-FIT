-- SE7EN FIT safe production baseline repair
-- Use this when older migrations fail on a partially-created Supabase database.
-- It creates the minimum production tables needed by the app, gym-owner website, admin, OTP, and health tracking.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user',
  full_name text,
  phone text,
  avatar_url text,
  status text not null default 'active',
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user',
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'app',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table if not exists public.auth_otp_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null default 'login',
  role text not null default 'user',
  otp_hash text not null,
  session_payload jsonb not null default '{}'::jsonb,
  auth_user_payload jsonb not null default '{}'::jsonb,
  profile_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email, purpose)
);

create table if not exists public.gyms (
  gym_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'SE7EN FIT Gym',
  slug text unique,
  referral_code text unique not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  logo_url text,
  cover_url text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  country text default 'India',
  pincode text,
  status text not null default 'pending',
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
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_memberships (
  membership_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  referred_by_code text,
  status text not null default 'pending',
  amount numeric default 0,
  currency text default 'INR',
  payment_status text default 'pending',
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_manual_members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text,
  email text,
  phone text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_leads (
  lead_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'website',
  name text,
  phone text,
  email text,
  city text,
  message text,
  status text not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_attendance_logs (
  log_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
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
  gym_id uuid references public.gyms(gym_id) on delete cascade,
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
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  billing_cycle text not null default 'monthly',
  duration_days integer,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_classes (
  class_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text,
  description text,
  trainer_name text,
  start_at timestamptz,
  end_at timestamptz,
  capacity integer,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_class_bookings (
  booking_id uuid primary key default gen_random_uuid(),
  class_id uuid references public.gym_classes(class_id) on delete cascade,
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'booked',
  created_at timestamptz not null default now()
);

create table if not exists public.gym_reviews (
  review_id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  rating integer,
  title text,
  body text,
  status text not null default 'published',
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.step_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  steps integer not null default 0,
  distance_km numeric,
  calories integer,
  calories_burned integer,
  source text not null default 'app',
  health_provider text,
  external_id text,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cardio_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  activity text,
  duration_minutes integer,
  distance_km numeric,
  calories_burned integer,
  avg_heart_rate integer,
  health_provider text,
  external_id text,
  start_at timestamptz,
  end_at timestamptz,
  route_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, amount_ml integer not null default 0, source text default 'app', created_at timestamptz not null default now());
create table if not exists public.sleep_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, hours numeric not null default 0, quality text, source text default 'app', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.weight_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, weight_kg numeric not null default 0, source text default 'app', created_at timestamptz not null default now());
create table if not exists public.body_measurements (measurement_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, chest_cm numeric, waist_cm numeric, hip_cm numeric, biceps_cm numeric, thighs_cm numeric, notes text, source text default 'app', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.habit_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, habit_key text not null, completed boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.mood_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, mood text, energy integer, notes text, created_at timestamptz not null default now());

create table if not exists public.workout_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, gym_id uuid references public.gyms(gym_id) on delete set null, date date not null default current_date, workout_name text, workout_type text, duration_minutes integer, calories_burned integer, exercises jsonb not null default '[]'::jsonb, completed boolean not null default true, source text default 'app', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.nutrition_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null default current_date, meal_type text, food_name text, calories numeric not null default 0, protein_g numeric not null default 0, carbs_g numeric not null default 0, fat_g numeric not null default 0, image_url text, source text default 'app', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.workout_plans (plan_id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete cascade, title text, goal text, level text, duration_weeks integer, plan_data jsonb not null default '{}'::jsonb, visibility text not null default 'gym', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.diet_plans (plan_id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete cascade, title text, goal text, plan_data jsonb not null default '{}'::jsonb, visibility text not null default 'gym', created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.media_assets (asset_id uuid primary key default gen_random_uuid(), owner_user_id uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete cascade, bucket text not null, path text not null unique, public_url text not null, media_type text not null default 'image', mime_type text, size_bytes bigint, width integer, height integer, duration_seconds integer, crop_position text default 'center center', quality_label text, status text not null default 'active', created_at timestamptz not null default now());
create table if not exists public.advertisements (ad_id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete cascade, source_type text not null default 'admin', source_name text, title text not null default 'Promotion', description text, offer_text text, cta_label text, cta_url text, media_asset_id uuid references public.media_assets(asset_id) on delete set null, media_url text, media_type text, media_crop text default 'center center', target_scope text not null default 'all', status text not null default 'active', start_at timestamptz, end_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.community_posts (post_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, gym_id uuid references public.gyms(gym_id) on delete set null, type text not null default 'general', content text, media_asset_id uuid references public.media_assets(asset_id) on delete set null, media_url text, media_type text, media_crop text default 'center center', likes_count integer not null default 0, comments_count integer not null default 0, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.community_comments (comment_id uuid primary key default gen_random_uuid(), post_id uuid references public.community_posts(post_id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, body text not null, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.community_likes (post_id uuid references public.community_posts(post_id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(post_id, user_id));

create table if not exists public.challenges (challenge_id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete cascade, title text not null default 'Challenge', description text, difficulty text, duration_days integer not null default 7, reward_coins integer not null default 0, rules jsonb not null default '{}'::jsonb, target_scope text not null default 'all', premium_required boolean not null default false, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.challenge_participants (id uuid primary key default gen_random_uuid(), challenge_id uuid references public.challenges(challenge_id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, gym_id uuid references public.gyms(gym_id) on delete set null, progress numeric not null default 0, status text not null default 'active', joined_at timestamptz not null default now(), completed_at timestamptz);
create table if not exists public.leaderboard_scores (score_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, gym_id uuid references public.gyms(gym_id) on delete cascade, period text not null default 'all_time', score numeric not null default 0, rank integer, breakdown jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.reward_wallets (user_id uuid primary key references auth.users(id) on delete cascade, coins integer not null default 0, lifetime_earned integer not null default 0, updated_at timestamptz not null default now());
create table if not exists public.reward_transactions (transaction_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, amount integer not null default 0, type text not null default 'adjustment', source text, reference_id uuid, created_at timestamptz not null default now());

create table if not exists public.ai_chat_messages (message_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, conversation_id text not null default 'ai_trainer_default', role text not null default 'user', content text not null default '', source text not null default 'ai_trainer', edited_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.ai_usage_logs (log_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, feature text not null, date date not null default current_date, success boolean not null default true, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete set null, user_name text, user_email text, user_phone text, source text not null default 'app', subject text not null default 'Support Request', message text not null default '', priority text not null default 'normal', status text not null default 'new', assigned_to uuid references auth.users(id) on delete set null, is_read boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.ticket_messages (id uuid primary key default gen_random_uuid(), ticket_id uuid references public.support_tickets(id) on delete cascade, author_id uuid references auth.users(id) on delete set null, body text not null, is_internal boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.notifications (notification_id uuid primary key default gen_random_uuid(), title text not null, body text not null, target text, audience jsonb not null default '{}'::jsonb, channel text not null default 'in_app', status text not null default 'draft', scheduled_at timestamptz, sent_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.user_notifications (id uuid primary key default gen_random_uuid(), notification_id uuid references public.notifications(notification_id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, read_at timestamptz, created_at timestamptz not null default now());
create table if not exists public.push_tokens (token_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, platform text, token text not null unique, device_info jsonb not null default '{}'::jsonb, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.app_settings (key text primary key, scope text, value jsonb not null default '{}'::jsonb, description text, updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now());
create table if not exists public.admin_logs (log_id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, action text not null, entity text, entity_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.subscriptions (subscription_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, gym_id uuid references public.gyms(gym_id) on delete cascade, plan_code text not null default 'free', provider text, provider_subscription_id text, status text not null default 'active', current_period_start timestamptz, current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.payments (payment_id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, gym_id uuid references public.gyms(gym_id) on delete set null, subscription_id uuid references public.subscriptions(subscription_id) on delete set null, provider text, provider_payment_id text, amount numeric not null default 0, currency text not null default 'INR', status text not null default 'pending', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

insert into public.app_settings(key, scope, value, description)
values
  ('download_links', 'app', '{"play_store_url":"","app_store_url":"","apk_url":""}'::jsonb, 'Mobile app download links'),
  ('ai_status', 'app', '{"enabled":true}'::jsonb, 'AI feature status'),
  ('media_rules', 'app', '{"max_video_seconds":120,"min_long_side_px":1080}'::jsonb, 'Media quality rules')
on conflict (key) do nothing;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists step_logs_user_date_idx on public.step_logs(user_id, date);
create index if not exists cardio_logs_user_date_idx on public.cardio_logs(user_id, date);
create index if not exists gym_memberships_user_idx on public.gym_memberships(user_id);
create index if not exists gym_memberships_gym_idx on public.gym_memberships(gym_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
