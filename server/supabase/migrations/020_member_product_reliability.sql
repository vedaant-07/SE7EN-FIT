-- Phase 5: reliable AI coaching, food scanning, personalized workouts and member summaries.

create extension if not exists pgcrypto;

alter table public.ai_chat_messages
  add column if not exists request_id text,
  add column if not exists status text not null default 'legacy',
  add column if not exists model text,
  add column if not exists safety_flags jsonb not null default '{}'::jsonb;

alter table public.ai_chat_messages drop constraint if exists ai_chat_messages_status_check;
alter table public.ai_chat_messages
  add constraint ai_chat_messages_status_check
  check (status in ('legacy','pending','completed','failed'));

create unique index if not exists uq_ai_chat_request_role
  on public.ai_chat_messages(user_id, request_id, role)
  where request_id is not null;

create index if not exists idx_ai_chat_member_conversation
  on public.ai_chat_messages(user_id, conversation_id, created_at);

create table if not exists public.member_feature_usage (
  usage_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_code text not null check (feature_code ~ '^[a-z0-9_]{2,80}$'),
  request_id text not null check (length(request_id) between 8 and 160),
  period_key text not null check (length(period_key) between 1 and 80),
  plan_code text not null default 'free',
  status text not null default 'reserved' check (status in ('reserved','succeeded','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_code, request_id)
);

create index if not exists idx_member_feature_usage_period
  on public.member_feature_usage(user_id, feature_code, period_key, status, created_at desc);

alter table public.workout_plans
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'manual',
  add column if not exists days_per_week integer,
  add column if not exists activated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.workout_plans
set user_id = coalesce(user_id, created_by),
    activated_at = coalesce(activated_at, created_at)
where user_id is null or activated_at is null;

alter table public.workout_plans drop constraint if exists workout_plans_status_check;
alter table public.workout_plans
  add constraint workout_plans_status_check check (status in ('active','archived','draft'));
alter table public.workout_plans drop constraint if exists workout_plans_days_per_week_check;
alter table public.workout_plans
  add constraint workout_plans_days_per_week_check
  check (days_per_week is null or days_per_week between 1 and 7);

create index if not exists idx_workout_plans_member_status
  on public.workout_plans(user_id, status, created_at desc);

create table if not exists public.workout_plan_sessions (
  session_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(plan_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_day_index integer not null check (schedule_day_index between 0 and 6),
  session_date date not null default current_date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped')),
  external_id text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 0 and 1440),
  calories_burned integer check (calories_burned is null or calories_burned between 0 and 20000),
  exercises jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id, schedule_day_index, session_date)
);

create unique index if not exists uq_workout_plan_sessions_external
  on public.workout_plan_sessions(user_id, external_id)
  where external_id is not null;

create index if not exists idx_workout_plan_sessions_member_date
  on public.workout_plan_sessions(user_id, session_date desc, status);

create table if not exists public.food_scans (
  scan_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (length(request_id) between 8 and 160),
  scan_date date not null default current_date,
  meal_type text not null default 'meal' check (meal_type in ('breakfast','lunch','dinner','snack','meal')),
  status text not null default 'analyzed' check (status in ('analyzed','confirmed','failed')),
  detected_items jsonb not null default '[]'::jsonb,
  confirmed_items jsonb not null default '[]'::jsonb,
  total_calories numeric(10,2) not null default 0,
  total_protein_g numeric(10,2) not null default 0,
  total_carbs_g numeric(10,2) not null default 0,
  total_fat_g numeric(10,2) not null default 0,
  total_fiber_g numeric(10,2) not null default 0,
  confidence_score numeric(5,2),
  notes text,
  provider text,
  model text,
  image_sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index if not exists idx_food_scans_member_date
  on public.food_scans(user_id, scan_date desc, created_at desc);

create table if not exists public.member_nutrition_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorie_target integer not null check (calorie_target between 1000 and 6000),
  protein_g integer not null check (protein_g between 20 and 500),
  carbs_g integer not null check (carbs_g between 20 and 1000),
  fat_g integer not null check (fat_g between 15 and 300),
  fiber_g integer not null check (fiber_g between 10 and 100),
  method text not null default 'mifflin_st_jeor',
  confidence text not null default 'estimated' check (confidence in ('estimated','profile_complete','manual')),
  inputs jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_logs
  add column if not exists food_scan_id uuid references public.food_scans(scan_id) on delete set null,
  add column if not exists fiber_g numeric not null default 0,
  add column if not exists quantity text,
  add column if not exists serving_size text,
  add column if not exists external_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists uq_nutrition_logs_external
  on public.nutrition_logs(user_id, external_id)
  where external_id is not null;

alter table public.workout_logs
  add column if not exists workout_plan_id uuid references public.workout_plans(plan_id) on delete set null,
  add column if not exists workout_session_id uuid references public.workout_plan_sessions(session_id) on delete set null,
  add column if not exists external_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists uq_workout_logs_external
  on public.workout_logs(user_id, external_id)
  where external_id is not null;

insert into public.subscription_plan_entitlements(plan_code, feature_code, enabled, quota, quota_period, metadata)
values
  ('free', 'ai_workout_plans', false, 0, 'month', '{}'::jsonb),
  ('free_trial', 'ai_workout_plans', true, 1, 'subscription', '{}'::jsonb),
  ('basic_monthly', 'ai_workout_plans', true, 2, 'month', '{}'::jsonb),
  ('premium_monthly', 'ai_workout_plans', true, null, null, '{}'::jsonb),
  ('premium_quarterly', 'ai_workout_plans', true, null, null, '{}'::jsonb),
  ('premium_annual', 'ai_workout_plans', true, null, null, '{}'::jsonb)
on conflict (plan_code, feature_code) do update
set enabled = excluded.enabled,
    quota = excluded.quota,
    quota_period = excluded.quota_period,
    updated_at = now();

create or replace function public.reserve_member_feature_usage(
  p_user_id uuid,
  p_feature_code text,
  p_request_id text,
  p_period_key text,
  p_plan_code text,
  p_quota integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.member_feature_usage%rowtype;
  v_count integer;
  v_usage public.member_feature_usage%rowtype;
begin
  if p_user_id is null
     or length(trim(coalesce(p_feature_code, ''))) < 2
     or length(trim(coalesce(p_request_id, ''))) < 8
     or length(trim(coalesce(p_period_key, ''))) < 1 then
    raise exception 'invalid_usage_reservation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_feature_code || ':' || p_period_key,
    0
  ));

  select * into v_existing
  from public.member_feature_usage
  where user_id = p_user_id
    and feature_code = p_feature_code
    and request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.status in ('reserved','succeeded'),
      'idempotent', true,
      'usage_id', v_existing.usage_id,
      'status', v_existing.status
    );
  end if;

  select count(*) into v_count
  from public.member_feature_usage
  where user_id = p_user_id
    and feature_code = p_feature_code
    and period_key = p_period_key
    and status in ('reserved','succeeded');

  if p_quota is not null and p_quota >= 0 and v_count >= p_quota then
    return jsonb_build_object(
      'allowed', false,
      'idempotent', false,
      'usage_count', v_count,
      'remaining', 0
    );
  end if;

  insert into public.member_feature_usage(
    user_id, feature_code, request_id, period_key, plan_code, status
  ) values (
    p_user_id,
    trim(p_feature_code),
    trim(p_request_id),
    trim(p_period_key),
    coalesce(nullif(trim(p_plan_code), ''), 'free'),
    'reserved'
  ) returning * into v_usage;

  return jsonb_build_object(
    'allowed', true,
    'idempotent', false,
    'usage_id', v_usage.usage_id,
    'usage_count', v_count + 1,
    'remaining', case when p_quota is null then null else greatest(0, p_quota - v_count - 1) end
  );
end;
$$;

create or replace function public.finalize_member_feature_usage(
  p_usage_id uuid,
  p_user_id uuid,
  p_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.member_feature_usage%rowtype;
begin
  if p_status not in ('succeeded','failed') then
    raise exception 'invalid_usage_status' using errcode = '22023';
  end if;

  update public.member_feature_usage
  set status = p_status,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where usage_id = p_usage_id and user_id = p_user_id
  returning * into v_usage;

  if not found then
    raise exception 'usage_not_found' using errcode = 'P0002';
  end if;

  return to_jsonb(v_usage);
end;
$$;

create or replace function public.activate_generated_workout_plan(
  p_user_id uuid,
  p_gym_id uuid,
  p_title text,
  p_goal text,
  p_level text,
  p_days_per_week integer,
  p_plan_data jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.workout_plans%rowtype;
begin
  if p_user_id is null
     or length(trim(coalesce(p_title, ''))) < 2
     or p_days_per_week is null
     or p_days_per_week not between 1 and 7
     or jsonb_typeof(coalesce(p_plan_data, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_workout_plan' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':active_workout_plan', 0));

  update public.workout_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where user_id = p_user_id and status = 'active';

  insert into public.workout_plans(
    created_by, user_id, gym_id, title, goal, level, duration_weeks,
    plan_data, visibility, status, source, days_per_week,
    activated_at, metadata
  ) values (
    p_user_id, p_user_id, p_gym_id, left(trim(p_title), 160),
    nullif(trim(coalesce(p_goal, '')), ''),
    nullif(trim(coalesce(p_level, '')), ''),
    4, p_plan_data, 'app', 'active', 'ai', p_days_per_week,
    now(), coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_plan;

  return to_jsonb(v_plan);
end;
$$;

create or replace function public.confirm_food_scan(
  p_scan_id uuid,
  p_user_id uuid,
  p_items jsonb,
  p_meal_type text,
  p_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scan public.food_scans%rowtype;
  v_count integer;
  v_total_calories numeric := 0;
  v_total_protein numeric := 0;
  v_total_carbs numeric := 0;
  v_total_fat numeric := 0;
  v_total_fiber numeric := 0;
begin
  if p_scan_id is null
     or p_user_id is null
     or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'invalid_food_scan_items' using errcode = '22023';
  end if;

  select * into v_scan
  from public.food_scans
  where scan_id = p_scan_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'food_scan_not_found' using errcode = 'P0002';
  end if;

  if v_scan.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'scan', to_jsonb(v_scan));
  end if;

  delete from public.nutrition_logs
  where user_id = p_user_id and food_scan_id = p_scan_id;

  insert into public.nutrition_logs(
    user_id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g,
    fiber_g, quantity, serving_size, source, food_scan_id, external_id, metadata
  )
  select
    p_user_id,
    coalesce(p_date, current_date),
    case when p_meal_type in ('breakfast','lunch','dinner','snack') then p_meal_type else 'meal' end,
    left(coalesce(nullif(trim(item->>'name'), ''), 'Food item'), 160),
    round(least(5000, greatest(0, coalesce((item->>'calories')::numeric, 0))) * least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 2),
    round(least(500, greatest(0, coalesce((item->>'protein')::numeric, 0))) * least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 2),
    round(least(1000, greatest(0, coalesce((item->>'carbs')::numeric, 0))) * least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 2),
    round(least(500, greatest(0, coalesce((item->>'fat')::numeric, 0))) * least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 2),
    round(least(100, greatest(0, coalesce((item->>'fiber')::numeric, 0))) * least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 2),
    trim(to_char(least(10, greatest(0.25, coalesce((item->>'quantity')::numeric, 1))), 'FM9990.00')) || 'x',
    left(coalesce(nullif(trim(item->>'serving'), ''), '1 serving'), 120),
    'food_scan',
    p_scan_id,
    p_scan_id::text || ':' || ordinality::text,
    jsonb_build_object(
      'confidence', least(100, greatest(0, coalesce((item->>'confidence')::numeric, 0))),
      'corrected_by_user', true
    )
  from jsonb_array_elements(p_items) with ordinality as foods(item, ordinality);

  select
    count(*),
    coalesce(sum(calories), 0),
    coalesce(sum(protein_g), 0),
    coalesce(sum(carbs_g), 0),
    coalesce(sum(fat_g), 0),
    coalesce(sum(fiber_g), 0)
  into v_count, v_total_calories, v_total_protein, v_total_carbs, v_total_fat, v_total_fiber
  from public.nutrition_logs
  where user_id = p_user_id and food_scan_id = p_scan_id;

  update public.food_scans
  set status = 'confirmed',
      meal_type = case when p_meal_type in ('breakfast','lunch','dinner','snack') then p_meal_type else meal_type end,
      scan_date = coalesce(p_date, scan_date),
      confirmed_items = p_items,
      total_calories = v_total_calories,
      total_protein_g = v_total_protein,
      total_carbs_g = v_total_carbs,
      total_fat_g = v_total_fat,
      total_fiber_g = v_total_fiber,
      confirmed_at = now(),
      updated_at = now()
  where scan_id = p_scan_id
  returning * into v_scan;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'nutrition_log_count', v_count,
    'scan', to_jsonb(v_scan)
  );
end;
$$;

create or replace function public.complete_member_workout_session(
  p_plan_id uuid,
  p_user_id uuid,
  p_schedule_day_index integer,
  p_session_date date,
  p_duration_minutes integer,
  p_calories_burned integer,
  p_exercises jsonb,
  p_external_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.workout_plans%rowtype;
  v_session public.workout_plan_sessions%rowtype;
  v_log public.workout_logs%rowtype;
begin
  if p_user_id is null
     or p_plan_id is null
     or p_schedule_day_index is null
     or p_schedule_day_index not between 0 and 6
     or length(trim(coalesce(p_external_id, ''))) < 8 then
    raise exception 'invalid_workout_completion' using errcode = '22023';
  end if;

  select * into v_plan
  from public.workout_plans
  where plan_id = p_plan_id and user_id = p_user_id
  for share;

  if not found then
    raise exception 'workout_plan_not_found' using errcode = 'P0002';
  end if;

  insert into public.workout_plan_sessions(
    plan_id, user_id, schedule_day_index, session_date, status, external_id,
    duration_minutes, calories_burned, exercises, started_at, completed_at, metadata
  ) values (
    p_plan_id, p_user_id, p_schedule_day_index, coalesce(p_session_date, current_date),
    'completed', trim(p_external_id),
    least(1440, greatest(1, coalesce(p_duration_minutes, 30))),
    least(20000, greatest(0, coalesce(p_calories_burned, 0))),
    coalesce(p_exercises, '[]'::jsonb), now(), now(),
    jsonb_build_object('source', 'ai_workout_plan')
  )
  on conflict (user_id, plan_id, schedule_day_index, session_date)
  do update set
    status = 'completed',
    external_id = coalesce(public.workout_plan_sessions.external_id, excluded.external_id),
    duration_minutes = excluded.duration_minutes,
    calories_burned = excluded.calories_burned,
    exercises = excluded.exercises,
    completed_at = coalesce(public.workout_plan_sessions.completed_at, now()),
    updated_at = now()
  returning * into v_session;

  insert into public.workout_logs(
    user_id, gym_id, date, workout_name, workout_type, duration_minutes,
    calories_burned, exercises, completed, source, workout_plan_id,
    workout_session_id, external_id, metadata
  ) values (
    p_user_id, v_plan.gym_id, coalesce(p_session_date, current_date),
    coalesce(v_plan.title, 'Personalized workout'), 'personalized',
    v_session.duration_minutes, v_session.calories_burned, v_session.exercises,
    true, 'ai_workout_plan', p_plan_id, v_session.session_id,
    trim(p_external_id), jsonb_build_object('schedule_day_index', p_schedule_day_index)
  )
  on conflict (user_id, external_id) where external_id is not null
  do update set
    duration_minutes = excluded.duration_minutes,
    calories_burned = excluded.calories_burned,
    exercises = excluded.exercises,
    completed = true,
    updated_at = now()
  returning * into v_log;

  return jsonb_build_object(
    'ok', true,
    'session', to_jsonb(v_session),
    'workout_log', to_jsonb(v_log)
  );
end;
$$;

alter table public.member_feature_usage enable row level security;
alter table public.workout_plan_sessions enable row level security;
alter table public.food_scans enable row level security;
alter table public.member_nutrition_targets enable row level security;
alter table public.workout_plans enable row level security;

drop policy if exists "member reads own feature usage" on public.member_feature_usage;
create policy "member reads own feature usage"
on public.member_feature_usage for select to authenticated
using (user_id = auth.uid());

drop policy if exists "member reads own workout plans" on public.workout_plans;
create policy "member reads own workout plans"
on public.workout_plans for select to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

drop policy if exists "member reads own workout sessions" on public.workout_plan_sessions;
create policy "member reads own workout sessions"
on public.workout_plan_sessions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "member reads own food scans" on public.food_scans;
create policy "member reads own food scans"
on public.food_scans for select to authenticated
using (user_id = auth.uid());

drop policy if exists "member reads own nutrition target" on public.member_nutrition_targets;
create policy "member reads own nutrition target"
on public.member_nutrition_targets for select to authenticated
using (user_id = auth.uid());

revoke all on function public.reserve_member_feature_usage(uuid, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_member_feature_usage(uuid, text, text, text, text, integer) to service_role;
revoke all on function public.finalize_member_feature_usage(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_member_feature_usage(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.activate_generated_workout_plan(uuid, uuid, text, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.activate_generated_workout_plan(uuid, uuid, text, text, text, integer, jsonb, jsonb) to service_role;
revoke all on function public.confirm_food_scan(uuid, uuid, jsonb, text, date) from public, anon, authenticated;
grant execute on function public.confirm_food_scan(uuid, uuid, jsonb, text, date) to service_role;
revoke all on function public.complete_member_workout_session(uuid, uuid, integer, date, integer, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_member_workout_session(uuid, uuid, integer, date, integer, integer, jsonb, text) to service_role;
