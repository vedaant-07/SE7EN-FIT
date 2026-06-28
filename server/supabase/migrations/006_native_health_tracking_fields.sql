-- Native health tracking fields for HealthKit and Health Connect.

alter table if exists public.step_logs
  add column if not exists calories_burned integer,
  add column if not exists health_provider text,
  add column if not exists external_id text,
  add column if not exists synced_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.cardio_logs
  add column if not exists avg_heart_rate integer,
  add column if not exists health_provider text,
  add column if not exists external_id text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists route_summary jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists step_logs_user_date_idx on public.step_logs(user_id, date);
create index if not exists cardio_logs_user_date_idx on public.cardio_logs(user_id, date);
