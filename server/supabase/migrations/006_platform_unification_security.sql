-- SE7EN FIT platform unification, gym partner commissions, and security hardening

create extension if not exists pgcrypto;

-- Keep duplicated legacy identifiers synchronized while old clients are phased out.
create or replace function public.sync_gyms_id_with_gym_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.gym_id := coalesce(new.gym_id, new.id, gen_random_uuid());
  new.id := new.gym_id;

  new.owner_user_id := coalesce(new.owner_user_id, new.owner_id, new.owner_profile_id);
  new.owner_id := coalesce(new.owner_id, new.owner_user_id, new.owner_profile_id);
  new.owner_profile_id := coalesce(new.owner_profile_id, new.owner_user_id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists trg_sync_gyms_id_with_gym_id on public.gyms;
create trigger trg_sync_gyms_id_with_gym_id
before insert or update on public.gyms
for each row execute function public.sync_gyms_id_with_gym_id();

update public.gyms
set gym_id = coalesce(gym_id, id),
    id = coalesce(gym_id, id),
    owner_user_id = coalesce(owner_user_id, owner_id, owner_profile_id),
    owner_id = coalesce(owner_id, owner_user_id, owner_profile_id),
    owner_profile_id = coalesce(owner_profile_id, owner_user_id, owner_id)
where gym_id is distinct from id
   or owner_user_id is null
   or owner_id is null
   or owner_profile_id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Canonical attendance supports both app-linked and manually-created gym members.
alter table public.gym_attendance_logs
  add column if not exists manual_member_id uuid references public.gym_manual_members(id) on delete set null,
  add column if not exists method text not null default 'app';

create index if not exists idx_gym_attendance_manual_member
  on public.gym_attendance_logs(manual_member_id, date desc)
  where manual_member_id is not null;

-- Immutable gym attribution used for partner commission calculations.
create table if not exists public.gym_referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  referral_code text,
  source text not null default 'app_signup',
  attributed_at timestamptz not null default now(),
  locked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_referrals_gym
  on public.gym_referrals(gym_id, attributed_at desc);

insert into public.gym_referrals(user_id, gym_id, referral_code, source, attributed_at, metadata)
select gm.user_id,
       gm.gym_id,
       gm.referred_by_code,
       'membership_backfill',
       coalesce(gm.joined_at, gm.created_at, now()),
       jsonb_build_object('membership_id', gm.membership_id)
from public.gym_memberships gm
where gm.user_id is not null and gm.gym_id is not null
on conflict (user_id) do nothing;

insert into public.app_settings(key, value, scope, description)
values (
  'gym_partner_commission',
  jsonb_build_object('rate', 0.20, 'hold_days', 7),
  'admin',
  'Commission paid to the attributed gym for successful SE7EN FIT subscription payments.'
)
on conflict (key) do nothing;

create table if not exists public.gym_commission_ledger (
  commission_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payments(payment_id) on delete cascade,
  subscription_id uuid references public.subscriptions(subscription_id) on delete set null,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  commission_rate numeric(6,5) not null default 0.20 check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  available_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  payout_reference text,
  reversal_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id)
);

create index if not exists idx_gym_commission_gym_status
  on public.gym_commission_ledger(gym_id, status, created_at desc);
create index if not exists idx_gym_commission_user
  on public.gym_commission_ledger(user_id, created_at desc);

create table if not exists public.gym_commission_payouts (
  payout_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  period_start date,
  period_end date,
  payment_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_commission_payout_items (
  payout_id uuid not null references public.gym_commission_payouts(payout_id) on delete cascade,
  commission_id uuid not null references public.gym_commission_ledger(commission_id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, commission_id),
  unique (commission_id)
);

create or replace function public.sync_gym_referral_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and new.gym_id is not null then
    insert into public.gym_referrals(user_id, gym_id, referral_code, source, attributed_at, metadata)
    values (
      new.user_id,
      new.gym_id,
      new.referred_by_code,
      'gym_membership',
      coalesce(new.joined_at, now()),
      jsonb_build_object('membership_id', new.membership_id)
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_gym_referral_from_membership on public.gym_memberships;
create trigger trg_sync_gym_referral_from_membership
after insert or update of gym_id, user_id, referred_by_code on public.gym_memberships
for each row execute function public.sync_gym_referral_from_membership();

create or replace function public.sync_payment_partner_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
  v_rate numeric := 0.20;
  v_hold_days integer := 7;
  v_success boolean;
  v_reversed boolean;
begin
  if new.user_id is null then
    return new;
  end if;

  v_success := lower(coalesce(new.status, '')) = any(array['paid','captured','succeeded','completed']);
  v_reversed := lower(coalesce(new.status, '')) = any(array['refunded','partially_refunded','cancelled','chargeback','reversed']);

  select coalesce(new.gym_id, gr.gym_id)
    into v_gym_id
  from (select 1) seed
  left join public.gym_referrals gr on gr.user_id = new.user_id;

  if v_gym_id is null then
    select gm.gym_id into v_gym_id
    from public.gym_memberships gm
    where gm.user_id = new.user_id
      and gm.gym_id is not null
      and gm.status in ('active','approved','pending')
    order by gm.joined_at asc
    limit 1;
  end if;

  if v_gym_id is null then
    return new;
  end if;

  select least(1, greatest(0, coalesce((value ->> 'rate')::numeric, 0.20))),
         greatest(0, coalesce((value ->> 'hold_days')::integer, 7))
    into v_rate, v_hold_days
  from public.app_settings
  where key = 'gym_partner_commission';

  v_rate := coalesce(v_rate, 0.20);
  v_hold_days := coalesce(v_hold_days, 7);

  if v_success then
    insert into public.gym_commission_ledger(
      gym_id, user_id, payment_id, subscription_id, gross_amount,
      commission_rate, commission_amount, currency, status, available_at, metadata
    ) values (
      v_gym_id,
      new.user_id,
      new.payment_id,
      new.subscription_id,
      round(coalesce(new.amount, 0)::numeric, 2),
      v_rate,
      round((coalesce(new.amount, 0) * v_rate)::numeric, 2),
      coalesce(new.currency, 'INR'),
      'pending',
      coalesce(new.created_at, now()) + make_interval(days => v_hold_days),
      jsonb_build_object('provider', new.provider, 'provider_payment_id', new.provider_payment_id)
    )
    on conflict (payment_id) do update set
      gym_id = excluded.gym_id,
      gross_amount = excluded.gross_amount,
      commission_rate = excluded.commission_rate,
      commission_amount = excluded.commission_amount,
      currency = excluded.currency,
      status = case when public.gym_commission_ledger.status = 'paid' then 'paid' else 'pending' end,
      reversed_at = null,
      reversal_reason = null,
      updated_at = now();
  elsif v_reversed then
    update public.gym_commission_ledger
       set status = 'reversed',
           reversed_at = now(),
           reversal_reason = concat('Payment status changed to ', new.status),
           updated_at = now()
     where payment_id = new.payment_id
       and status <> 'paid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_payment_partner_commission on public.payments;
create trigger trg_sync_payment_partner_commission
after insert or update of status, amount, gym_id, user_id on public.payments
for each row execute function public.sync_payment_partner_commission();

-- Backfill commission rows for existing successful payments.
insert into public.gym_commission_ledger(
  gym_id, user_id, payment_id, subscription_id, gross_amount,
  commission_rate, commission_amount, currency, status, available_at, metadata
)
select coalesce(p.gym_id, gr.gym_id),
       p.user_id,
       p.payment_id,
       p.subscription_id,
       round(coalesce(p.amount, 0)::numeric, 2),
       0.20,
       round((coalesce(p.amount, 0) * 0.20)::numeric, 2),
       coalesce(p.currency, 'INR'),
       'pending',
       coalesce(p.created_at, now()) + interval '7 days',
       jsonb_build_object('backfilled', true, 'provider', p.provider, 'provider_payment_id', p.provider_payment_id)
from public.payments p
left join public.gym_referrals gr on gr.user_id = p.user_id
where p.user_id is not null
  and coalesce(p.gym_id, gr.gym_id) is not null
  and lower(coalesce(p.status, '')) in ('paid','captured','succeeded','completed')
on conflict (payment_id) do nothing;

-- Correct gym ownership policy calls that previously passed function arguments in reverse order.
drop policy if exists "admin or owner read attendance logs" on public.gym_attendance_logs;
create policy "admin or owner read attendance logs"
on public.gym_attendance_logs for select to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "admin or owner read manual members" on public.gym_manual_members;
create policy "admin or owner manage manual members"
on public.gym_manual_members for all to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()))
with check (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

drop policy if exists "admin or owner read payments" on public.payments;
create policy "admin owner or user read payments"
on public.payments for select to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()) or user_id = auth.uid());

-- Canonical shared tables: users read their own data; gym owners/admins manage only their gym.
create policy "membership user or gym manager read"
on public.gym_memberships for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

create policy "gym manager update memberships"
on public.gym_memberships for update to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()))
with check (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

create policy "gym manager manage attendance"
on public.gym_attendance_logs for all to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()) or user_id = auth.uid())
with check (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()) or user_id = auth.uid());

create policy "gym equipment member read"
on public.gym_equipment for select to authenticated
using (
  public.is_admin(auth.uid())
  or public.owns_gym(gym_id, auth.uid())
  or exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = gym_equipment.gym_id
      and gm.user_id = auth.uid()
      and gm.status in ('active','approved')
  )
);

create policy "gym manager manage equipment"
on public.gym_equipment for all to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()))
with check (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

alter table public.gym_referrals enable row level security;
alter table public.gym_commission_ledger enable row level security;
alter table public.gym_commission_payouts enable row level security;
alter table public.gym_commission_payout_items enable row level security;

create policy "referral user gym or admin read"
on public.gym_referrals for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

create policy "commission user gym or admin read"
on public.gym_commission_ledger for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

create policy "payout gym or admin read"
on public.gym_commission_payouts for select to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

create policy "payout items gym or admin read"
on public.gym_commission_payout_items for select to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.gym_commission_payouts gp
    where gp.payout_id = gym_commission_payout_items.payout_id
      and public.owns_gym(gp.gym_id, auth.uid())
  )
);

-- Public gym applications must go through the rate-limited submit-gym-request Edge Function.
drop policy if exists gym_owner_requests_public_insert on public.gym_owner_requests;

-- Prevent role/status escalation from a direct browser update of the profile row.
revoke update on public.profiles from authenticated;
grant update(full_name, phone, avatar_url, metadata, updated_at) on public.profiles to authenticated;

-- Restrict exposed SECURITY DEFINER functions to the roles that actually need them.
revoke all on function public.activate_gym_by_code_hash(text) from public, anon;
grant execute on function public.activate_gym_by_code_hash(text) to authenticated, service_role;

revoke all on function public.activate_gym_by_plain_code(text, text) from public, anon, authenticated;
grant execute on function public.activate_gym_by_plain_code(text, text) to service_role;

revoke all on function public.current_owner_gym_status() from public, anon;
grant execute on function public.current_owner_gym_status() to authenticated, service_role;

revoke all on function public.delete_fake_gym_request(uuid) from public, anon;
grant execute on function public.delete_fake_gym_request(uuid) to authenticated, service_role;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

revoke all on function public.is_super_admin(uuid) from public, anon;
grant execute on function public.is_super_admin(uuid) to authenticated, service_role;

revoke all on function public.owns_gym(uuid, uuid) from public, anon;
grant execute on function public.owns_gym(uuid, uuid) to authenticated, service_role;

-- Unrelated storefront tables must not expose customer/order data through PostgREST.
alter table if exists public.boltmart_coupons enable row level security;
alter table if exists public.boltmart_events enable row level security;
alter table if exists public.boltmart_reviews enable row level security;
drop policy if exists boltmart_customers_read_dashboard on public.boltmart_customers;
drop policy if exists boltmart_orders_read_dashboard on public.boltmart_orders;

-- Updated-at triggers for newly introduced accounting tables.
drop trigger if exists trg_gym_referrals_updated_at on public.gym_referrals;
create trigger trg_gym_referrals_updated_at before update on public.gym_referrals
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_commission_ledger_updated_at on public.gym_commission_ledger;
create trigger trg_gym_commission_ledger_updated_at before update on public.gym_commission_ledger
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_commission_payouts_updated_at on public.gym_commission_payouts;
create trigger trg_gym_commission_payouts_updated_at before update on public.gym_commission_payouts
for each row execute function public.set_updated_at();
