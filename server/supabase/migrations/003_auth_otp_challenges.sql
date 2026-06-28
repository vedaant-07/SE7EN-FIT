-- Production OTP challenge storage for SE7EN FIT auth.
-- Backend stores hashed OTPs and short-lived login/register session payloads here.

create table if not exists public.auth_otp_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('login', 'register')),
  role text not null default 'user',
  otp_hash text not null,
  session_payload jsonb not null,
  auth_user_payload jsonb,
  profile_payload jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email, purpose)
);

create index if not exists idx_auth_otp_email_purpose on public.auth_otp_challenges(email, purpose);
create index if not exists idx_auth_otp_expires on public.auth_otp_challenges(expires_at);

drop trigger if exists trg_auth_otp_challenges_updated_at on public.auth_otp_challenges;
create trigger trg_auth_otp_challenges_updated_at
before update on public.auth_otp_challenges
for each row execute function public.set_updated_at();

alter table public.auth_otp_challenges enable row level security;

-- Only the backend service role should access this table directly.
drop policy if exists auth_otp_no_direct_client_access on public.auth_otp_challenges;
create policy auth_otp_no_direct_client_access on public.auth_otp_challenges
for all using (false) with check (false);
