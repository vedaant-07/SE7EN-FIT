create extension if not exists pgcrypto;

create table if not exists public.gym_email_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(gym_id) on delete cascade,
  sent_by uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  body text not null,
  template_name text,
  status text not null default 'queued',
  provider text,
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_email_messages_gym_idx on public.gym_email_messages(gym_id, created_at desc);
