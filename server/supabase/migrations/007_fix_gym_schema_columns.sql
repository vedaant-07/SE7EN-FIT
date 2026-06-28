-- Fix missing columns required by gym owner onboarding.
-- Run this if onboarding fails with schema cache errors such as missing amenities/opening_hours/pricing.

alter table if exists public.gyms
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text not null default 'SE7EN FIT Gym',
  add column if not exists slug text,
  add column if not exists referral_code text,
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text default 'India',
  add column if not exists pincode text,
  add column if not exists status text not null default 'pending',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists amenities jsonb not null default '[]'::jsonb,
  add column if not exists pricing jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.gyms
set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null or referral_code = '';

create unique index if not exists gyms_referral_code_uidx on public.gyms(referral_code);
create index if not exists gyms_owner_user_id_idx on public.gyms(owner_user_id);

notify pgrst, 'reload schema';
