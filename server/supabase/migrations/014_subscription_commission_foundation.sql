begin;

create extension if not exists pgcrypto;

create table if not exists public.subscription_plans (
  plan_code text primary key,
  name text not null,
  description text,
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  interval_unit text not null default 'month' check (interval_unit in ('day','week','month','year','one_time')),
  interval_count integer not null default 1 check (interval_count between 1 and 120),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  is_active boolean not null default true,
  is_public boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_code_check check (plan_code ~ '^[a-z0-9_]{2,64}$')
);

create table if not exists public.subscription_plan_entitlements (
  plan_code text not null references public.subscription_plans(plan_code) on delete cascade,
  feature_code text not null,
  enabled boolean not null default true,
  quota integer check (quota is null or quota >= 0),
  quota_period text check (quota_period is null or quota_period in ('day','week','month','subscription','lifetime')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_code, feature_code),
  constraint subscription_entitlement_feature_check check (feature_code ~ '^[a-z0-9_]{2,80}$')
);

create table if not exists public.billing_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  payment_id uuid references public.payments(payment_id) on delete set null,
  subscription_id uuid references public.subscriptions(subscription_id) on delete set null,
  event_type text not null,
  source text not null default 'system',
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint billing_events_type_check check (event_type ~ '^[a-z0-9_.-]{2,100}$')
);

create unique index if not exists billing_events_idempotency_uq
  on public.billing_events(idempotency_key)
  where idempotency_key is not null;
create index if not exists billing_events_user_created_idx
  on public.billing_events(user_id, created_at desc);

insert into public.subscription_plans(plan_code, name, description, price_minor, currency, interval_unit, interval_count, trial_days, is_active, is_public, sort_order, metadata)
values
  ('free', 'Free', 'Core tracking and limited AI access.', 0, 'INR', 'one_time', 1, 0, true, false, 0, '{"tier":"free"}'::jsonb),
  ('free_trial', 'Free Trial', 'Seven days of guided SE7EN FIT access.', 0, 'INR', 'day', 7, 7, true, true, 10, '{"tier":"trial"}'::jsonb),
  ('basic_monthly', 'Basic', 'Essential coaching, nutrition and progress tools.', 29900, 'INR', 'month', 1, 0, true, true, 20, '{"tier":"basic","popular":true}'::jsonb),
  ('premium_monthly', 'Premium', 'Unlimited coaching and complete transformation tools.', 49900, 'INR', 'month', 1, 0, true, true, 30, '{"tier":"premium"}'::jsonb),
  ('premium_quarterly', 'Premium Quarterly', 'Premium access billed every three months.', 99900, 'INR', 'month', 3, 0, true, true, 40, '{"tier":"premium","savings_label":"Save compared with monthly"}'::jsonb),
  ('premium_annual', 'Premium Annual', 'Premium access for a full year.', 399900, 'INR', 'year', 1, 0, true, true, 50, '{"tier":"premium","savings_label":"Best annual value"}'::jsonb)
on conflict (plan_code) do update set
  name = excluded.name,
  description = excluded.description,
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  interval_unit = excluded.interval_unit,
  interval_count = excluded.interval_count,
  trial_days = excluded.trial_days,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  metadata = public.subscription_plans.metadata || excluded.metadata,
  updated_at = now();

insert into public.subscription_plan_entitlements(plan_code, feature_code, enabled, quota, quota_period)
values
  ('free', 'ai_trainer_messages', true, 3, 'day'),
  ('free', 'food_scans', false, 0, 'month'),
  ('free', 'animated_guides', false, 0, 'month'),
  ('free', 'advanced_analytics', false, null, null),
  ('free', 'all_challenges', false, null, null),
  ('free', 'transformation_report', false, null, null),
  ('free', 'reward_wallet', false, null, null),
  ('free_trial', 'ai_trainer_messages', true, 5, 'day'),
  ('free_trial', 'food_scans', true, 3, 'subscription'),
  ('free_trial', 'animated_guides', true, 2, 'subscription'),
  ('free_trial', 'advanced_analytics', false, null, null),
  ('free_trial', 'all_challenges', false, null, null),
  ('free_trial', 'transformation_report', false, null, null),
  ('free_trial', 'reward_wallet', true, null, null),
  ('basic_monthly', 'ai_trainer_messages', true, 20, 'day'),
  ('basic_monthly', 'food_scans', true, 10, 'month'),
  ('basic_monthly', 'animated_guides', true, 5, 'month'),
  ('basic_monthly', 'advanced_analytics', false, null, null),
  ('basic_monthly', 'all_challenges', false, null, null),
  ('basic_monthly', 'transformation_report', false, null, null),
  ('basic_monthly', 'reward_wallet', false, null, null),
  ('premium_monthly', 'ai_trainer_messages', true, null, null),
  ('premium_monthly', 'food_scans', true, null, null),
  ('premium_monthly', 'animated_guides', true, null, null),
  ('premium_monthly', 'advanced_analytics', true, null, null),
  ('premium_monthly', 'all_challenges', true, null, null),
  ('premium_monthly', 'transformation_report', true, null, null),
  ('premium_monthly', 'reward_wallet', true, null, null),
  ('premium_quarterly', 'ai_trainer_messages', true, null, null),
  ('premium_quarterly', 'food_scans', true, null, null),
  ('premium_quarterly', 'animated_guides', true, null, null),
  ('premium_quarterly', 'advanced_analytics', true, null, null),
  ('premium_quarterly', 'all_challenges', true, null, null),
  ('premium_quarterly', 'transformation_report', true, null, null),
  ('premium_quarterly', 'reward_wallet', true, null, null),
  ('premium_annual', 'ai_trainer_messages', true, null, null),
  ('premium_annual', 'food_scans', true, null, null),
  ('premium_annual', 'animated_guides', true, null, null),
  ('premium_annual', 'advanced_analytics', true, null, null),
  ('premium_annual', 'all_challenges', true, null, null),
  ('premium_annual', 'transformation_report', true, null, null),
  ('premium_annual', 'reward_wallet', true, null, null)
on conflict (plan_code, feature_code) do update set
  enabled = excluded.enabled,
  quota = excluded.quota,
  quota_period = excluded.quota_period,
  updated_at = now();

alter table public.subscriptions
  add column if not exists payment_id uuid references public.payments(payment_id) on delete set null,
  add column if not exists source text not null default 'system',
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists plan_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.subscriptions drop constraint if exists subscriptions_plan_code_fkey;
alter table public.subscriptions
  add constraint subscriptions_plan_code_fkey foreign key (plan_code)
  references public.subscription_plans(plan_code) on update cascade on delete restrict;

create unique index if not exists subscriptions_payment_uq
  on public.subscriptions(payment_id)
  where payment_id is not null;
create unique index if not exists subscriptions_one_active_user_uq
  on public.subscriptions(user_id)
  where status = 'active' and user_id is not null;
create index if not exists subscriptions_user_status_period_idx
  on public.subscriptions(user_id, status, current_period_end desc);

alter table public.payments
  add column if not exists provider_order_id text,
  add column if not exists provider_event_id text,
  add column if not exists refunded_amount numeric(14,2) not null default 0,
  add column if not exists captured_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.payments drop constraint if exists payments_refunded_amount_check;
alter table public.payments
  add constraint payments_refunded_amount_check check (refunded_amount >= 0 and refunded_amount <= amount);
create unique index if not exists payments_provider_payment_uq
  on public.payments(provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;
create unique index if not exists payments_provider_order_uq
  on public.payments(provider, provider_order_id)
  where provider is not null and provider_order_id is not null;
create unique index if not exists payments_provider_event_uq
  on public.payments(provider, provider_event_id)
  where provider is not null and provider_event_id is not null;

alter table public.gym_referrals
  add column if not exists qualified_at timestamptz,
  add column if not exists first_payment_id uuid references public.payments(payment_id) on delete set null;

create table if not exists public.gym_commission_adjustments (
  adjustment_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payments(payment_id) on delete cascade,
  commission_id uuid references public.gym_commission_ledger(commission_id) on delete set null,
  amount numeric(14,2) not null check (amount < 0),
  currency text not null default 'INR',
  reason text not null,
  source_key text not null unique,
  status text not null default 'pending' check (status in ('pending','applied','waived')),
  applied_payout_id uuid references public.gym_commission_payouts(payout_id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_commission_adjustments_gym_status_idx
  on public.gym_commission_adjustments(gym_id, status, created_at desc);

alter table public.gym_commission_payouts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.gym_commission_payout_adjustment_items (
  payout_id uuid not null references public.gym_commission_payouts(payout_id) on delete cascade,
  adjustment_id uuid not null references public.gym_commission_adjustments(adjustment_id) on delete restrict,
  amount numeric(14,2) not null check (amount < 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, adjustment_id),
  unique (adjustment_id)
);

create or replace function public.enforce_gym_referral_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  v_locked := old.qualified_at is not null
    or exists (select 1 from public.gym_commission_ledger where user_id = old.user_id limit 1);

  if tg_op = 'DELETE' then
    if v_locked then
      raise exception 'qualified_referral_is_immutable' using errcode = '23000';
    end if;
    return old;
  end if;

  if v_locked and (
    new.user_id is distinct from old.user_id
    or new.gym_id is distinct from old.gym_id
    or new.referral_code is distinct from old.referral_code
    or new.attributed_at is distinct from old.attributed_at
    or new.locked_at is distinct from old.locked_at
  ) then
    raise exception 'qualified_referral_is_immutable' using errcode = '23000';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_gym_referral_immutability on public.gym_referrals;
create trigger trg_enforce_gym_referral_immutability
before update or delete on public.gym_referrals
for each row execute function public.enforce_gym_referral_immutability();

create or replace function public.qualify_gym_referral_for_payment(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_gym_id uuid;
begin
  select * into v_payment from public.payments where payment_id = p_payment_id for update;
  if not found or v_payment.user_id is null then return null; end if;
  if lower(coalesce(v_payment.status, '')) not in ('success','paid','captured','succeeded','completed') then return null; end if;

  select gym_id into v_gym_id from public.gym_referrals where user_id = v_payment.user_id;
  if v_gym_id is null then return null; end if;

  update public.gym_referrals
     set qualified_at = coalesce(qualified_at, coalesce(v_payment.captured_at, v_payment.created_at, now())),
         first_payment_id = coalesce(first_payment_id, v_payment.payment_id),
         updated_at = now()
   where user_id = v_payment.user_id;

  return v_gym_id;
end;
$$;

create or replace function public.billing_period_end(p_start timestamptz, p_unit text, p_count integer)
returns timestamptz
language sql
immutable
as $$
  select case p_unit
    when 'day' then p_start + make_interval(days => p_count)
    when 'week' then p_start + make_interval(days => p_count * 7)
    when 'month' then p_start + make_interval(months => p_count)
    when 'year' then p_start + make_interval(years => p_count)
    else p_start + interval '100 years'
  end;
$$;

create or replace function public.activate_verified_subscription(
  p_payment_id uuid,
  p_plan_code text,
  p_source text default 'provider',
  p_provider_subscription_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_existing public.subscriptions%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_start timestamptz := now();
  v_end timestamptz;
  v_gym_id uuid;
begin
  select * into v_payment from public.payments where payment_id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if v_payment.user_id is null then raise exception 'payment_user_required' using errcode = '22023'; end if;
  if lower(coalesce(v_payment.status, '')) not in ('success','paid','captured','succeeded','completed') then
    raise exception 'payment_not_verified' using errcode = '22023';
  end if;

  select * into v_plan from public.subscription_plans where plan_code = p_plan_code and is_active = true;
  if not found then raise exception 'plan_not_available' using errcode = '22023'; end if;
  if v_plan.price_minor > 0 and round(v_payment.amount * 100)::bigint <> v_plan.price_minor then
    raise exception 'payment_amount_mismatch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.user_id::text, 0));

  select * into v_existing from public.subscriptions where payment_id = p_payment_id limit 1;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true, 'subscription', to_jsonb(v_existing));
  end if;

  v_gym_id := public.qualify_gym_referral_for_payment(p_payment_id);
  v_end := public.billing_period_end(v_start, v_plan.interval_unit, v_plan.interval_count);

  update public.subscriptions
     set status = 'expired', updated_at = now()
   where user_id = v_payment.user_id and status = 'active';

  insert into public.subscriptions(
    user_id, gym_id, payment_id, plan_code, provider, provider_subscription_id,
    status, current_period_start, current_period_end, source, plan_snapshot, metadata
  ) values (
    v_payment.user_id, coalesce(v_payment.gym_id, v_gym_id), v_payment.payment_id,
    v_plan.plan_code, v_payment.provider, p_provider_subscription_id,
    'active', v_start, v_end, nullif(trim(coalesce(p_source, '')), ''),
    to_jsonb(v_plan), coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_subscription;

  update public.payments
     set subscription_id = v_subscription.subscription_id,
         gym_id = coalesce(gym_id, v_gym_id),
         updated_at = now()
   where payment_id = p_payment_id;

  update public.gym_commission_ledger
     set subscription_id = v_subscription.subscription_id, updated_at = now()
   where payment_id = p_payment_id;

  insert into public.billing_events(user_id, payment_id, subscription_id, event_type, source, idempotency_key, payload)
  values (
    v_payment.user_id, p_payment_id, v_subscription.subscription_id,
    'subscription.activated', coalesce(nullif(trim(p_source), ''), 'provider'),
    'subscription-activation:' || p_payment_id::text,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', v_end)
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object('ok', true, 'idempotent', false, 'subscription', to_jsonb(v_subscription));
end;
$$;

create or replace function public.resolve_user_subscription_entitlements(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_entitlements jsonb;
begin
  update public.subscriptions
     set status = 'expired', updated_at = now()
   where user_id = p_user_id and status = 'active'
     and current_period_end is not null and current_period_end < now();

  select * into v_subscription
  from public.subscriptions
  where user_id = p_user_id and status = 'active'
    and (current_period_end is null or current_period_end >= now())
  order by current_period_end desc nulls first, created_at desc
  limit 1;

  select * into v_plan
  from public.subscription_plans
  where plan_code = coalesce(v_subscription.plan_code, 'free');

  select coalesce(jsonb_object_agg(
    feature_code,
    jsonb_build_object('enabled', enabled, 'quota', quota, 'quota_period', quota_period, 'metadata', metadata)
  ), '{}'::jsonb)
  into v_entitlements
  from public.subscription_plan_entitlements
  where plan_code = v_plan.plan_code;

  return jsonb_build_object(
    'subscription', case when v_subscription.subscription_id is null then null else to_jsonb(v_subscription) end,
    'plan', to_jsonb(v_plan),
    'entitlements', v_entitlements
  );
end;
$$;

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
  v_net numeric(14,2);
  v_expected numeric(14,2);
  v_ledger public.gym_commission_ledger%rowtype;
  v_adjusted numeric(14,2) := 0;
  v_remaining numeric(14,2);
begin
  if new.user_id is null then return new; end if;

  v_success := lower(coalesce(new.status, '')) = any(array['success','paid','captured','succeeded','completed']);
  v_reversed := lower(coalesce(new.status, '')) = any(array['refunded','cancelled','chargeback','reversed']);
  v_net := greatest(round((coalesce(new.amount, 0) - coalesce(new.refunded_amount, 0))::numeric, 2), 0);

  select coalesce(new.gym_id, gr.gym_id) into v_gym_id
  from (select 1) seed left join public.gym_referrals gr on gr.user_id = new.user_id;
  if v_gym_id is null then return new; end if;

  select least(1, greatest(0, coalesce((value ->> 'rate')::numeric, 0.20))),
         greatest(0, coalesce((value ->> 'hold_days')::integer, 7))
    into v_rate, v_hold_days
  from public.app_settings where key = 'gym_partner_commission';
  v_rate := coalesce(v_rate, 0.20);
  v_hold_days := coalesce(v_hold_days, 7);
  v_expected := round((v_net * v_rate)::numeric, 2);

  select * into v_ledger from public.gym_commission_ledger where payment_id = new.payment_id for update;

  if v_success and v_net > 0 then
    perform public.qualify_gym_referral_for_payment(new.payment_id);

    if v_ledger.commission_id is null then
      insert into public.gym_commission_ledger(
        gym_id, user_id, payment_id, subscription_id, gross_amount, commission_rate,
        commission_amount, currency, status, available_at, metadata
      ) values (
        v_gym_id, new.user_id, new.payment_id, new.subscription_id, v_net, v_rate,
        v_expected, coalesce(new.currency, 'INR'), 'pending',
        coalesce(new.captured_at, new.created_at, now()) + make_interval(days => v_hold_days),
        jsonb_build_object('provider', new.provider, 'provider_payment_id', new.provider_payment_id)
      );
    elsif v_ledger.status = 'paid' then
      select coalesce(abs(sum(amount)), 0) into v_adjusted
      from public.gym_commission_adjustments
      where commission_id = v_ledger.commission_id and status <> 'waived';
      v_remaining := greatest(v_ledger.commission_amount - v_expected - v_adjusted, 0);
      if v_remaining > 0 then
        insert into public.gym_commission_adjustments(
          gym_id, user_id, payment_id, commission_id, amount, currency, reason, source_key, metadata
        ) values (
          v_ledger.gym_id, v_ledger.user_id, new.payment_id, v_ledger.commission_id,
          -v_remaining, v_ledger.currency, 'Post-payout refund or chargeback',
          new.payment_id::text || ':' || coalesce(new.status, '') || ':' || coalesce(new.refunded_amount, 0)::text,
          jsonb_build_object('net_amount', v_net, 'expected_commission', v_expected)
        ) on conflict (source_key) do nothing;
      end if;
    else
      update public.gym_commission_ledger
         set gym_id = v_gym_id,
             subscription_id = coalesce(new.subscription_id, subscription_id),
             gross_amount = v_net,
             commission_rate = v_rate,
             commission_amount = v_expected,
             currency = coalesce(new.currency, 'INR'),
             status = case when status = 'approved' then 'approved' else 'pending' end,
             reversed_at = null,
             reversal_reason = null,
             updated_at = now()
       where commission_id = v_ledger.commission_id;
    end if;
  elsif v_reversed or v_net = 0 then
    if v_ledger.commission_id is not null and v_ledger.status = 'paid' then
      select coalesce(abs(sum(amount)), 0) into v_adjusted
      from public.gym_commission_adjustments
      where commission_id = v_ledger.commission_id and status <> 'waived';
      v_remaining := greatest(v_ledger.commission_amount - v_adjusted, 0);
      if v_remaining > 0 then
        insert into public.gym_commission_adjustments(
          gym_id, user_id, payment_id, commission_id, amount, currency, reason, source_key, metadata
        ) values (
          v_ledger.gym_id, v_ledger.user_id, new.payment_id, v_ledger.commission_id,
          -v_remaining, v_ledger.currency, 'Post-payout payment reversal',
          new.payment_id::text || ':full-reversal:' || coalesce(new.status, ''),
          jsonb_build_object('payment_status', new.status)
        ) on conflict (source_key) do nothing;
      end if;
    elsif v_ledger.commission_id is not null then
      update public.gym_commission_ledger
         set status = 'reversed', reversed_at = now(),
             reversal_reason = 'Payment status changed to ' || coalesce(new.status, 'reversed'),
             updated_at = now()
       where commission_id = v_ledger.commission_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_payment_partner_commission on public.payments;
create trigger trg_sync_payment_partner_commission
after insert or update of status, amount, refunded_amount, gym_id, user_id, subscription_id on public.payments
for each row execute function public.sync_payment_partner_commission();

create or replace function public.admin_create_gym_commission_payout_v2(
  p_gym_id uuid,
  p_commission_ids uuid[],
  p_admin_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_expected integer;
  v_commission_total numeric(14,2);
  v_adjustment_total numeric(14,2);
  v_amount numeric(14,2);
  v_currency text;
  v_start date;
  v_end date;
  v_payout public.gym_commission_payouts%rowtype;
begin
  if p_admin_id is null or not public.is_admin(p_admin_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_gym_id is null or p_commission_ids is null or cardinality(p_commission_ids) = 0 or cardinality(p_commission_ids) > 500 then
    raise exception 'invalid_payout_selection' using errcode = '22023';
  end if;

  v_expected := cardinality(p_commission_ids);
  perform 1 from public.gym_commission_ledger where commission_id = any(p_commission_ids) for update;
  perform 1 from public.gym_commission_adjustments where gym_id = p_gym_id and status = 'pending' for update;

  select count(*), coalesce(sum(commission_amount), 0), min(currency), min(created_at::date), max(created_at::date)
    into v_count, v_commission_total, v_currency, v_start, v_end
  from public.gym_commission_ledger gc
  where gc.commission_id = any(p_commission_ids)
    and gc.gym_id = p_gym_id
    and gc.status = 'approved'
    and not exists (select 1 from public.gym_commission_payout_items item where item.commission_id = gc.commission_id);

  if v_count <> v_expected then raise exception 'commissions_not_payable' using errcode = '22023'; end if;
  if exists (
    select 1 from public.gym_commission_ledger gc
    where gc.commission_id = any(p_commission_ids)
    group by true having count(distinct gc.currency) > 1
  ) then raise exception 'mixed_payout_currency' using errcode = '22023'; end if;

  select coalesce(sum(amount), 0) into v_adjustment_total
  from public.gym_commission_adjustments
  where gym_id = p_gym_id and status = 'pending' and currency = coalesce(v_currency, 'INR');

  v_amount := round(v_commission_total + v_adjustment_total, 2);
  if v_amount <= 0 then raise exception 'payout_net_not_positive' using errcode = '22023'; end if;

  insert into public.gym_commission_payouts(
    gym_id, amount, currency, status, period_start, period_end,
    notes, created_by, approved_by, approved_at, metadata
  ) values (
    p_gym_id, v_amount, coalesce(v_currency, 'INR'), 'pending', v_start, v_end,
    nullif(trim(coalesce(p_notes, '')), ''), p_admin_id, p_admin_id, now(),
    jsonb_build_object('gross_commission_total', v_commission_total, 'adjustment_total', v_adjustment_total)
  ) returning * into v_payout;

  insert into public.gym_commission_payout_items(payout_id, commission_id, amount)
  select v_payout.payout_id, gc.commission_id, gc.commission_amount
  from public.gym_commission_ledger gc
  where gc.commission_id = any(p_commission_ids) and gc.gym_id = p_gym_id and gc.status = 'approved';

  insert into public.gym_commission_payout_adjustment_items(payout_id, adjustment_id, amount)
  select v_payout.payout_id, adjustment_id, amount
  from public.gym_commission_adjustments
  where gym_id = p_gym_id and status = 'pending' and currency = coalesce(v_currency, 'INR');

  update public.gym_commission_adjustments
     set status = 'applied', applied_payout_id = v_payout.payout_id, updated_at = now()
   where gym_id = p_gym_id and status = 'pending' and currency = coalesce(v_currency, 'INR');

  update public.gym_commission_ledger
     set payout_reference = v_payout.payout_id::text,
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payout_id', v_payout.payout_id)
   where commission_id = any(p_commission_ids);

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (
    p_admin_id, 'gym_commission_payout.created', 'gym_commission_payout', v_payout.payout_id::text,
    jsonb_build_object('gym_id', p_gym_id, 'net_amount', v_amount, 'commission_total', v_commission_total,
      'adjustment_total', v_adjustment_total, 'commission_ids', p_commission_ids)
  );

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout),
    'commission_total', v_commission_total, 'adjustment_total', v_adjustment_total);
end;
$$;

create or replace function public.admin_release_gym_commission_payout(
  p_payout_id uuid,
  p_admin_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.gym_commission_payouts%rowtype;
  v_commission_ids uuid[];
  v_adjustment_ids uuid[];
begin
  if p_admin_id is null or not public.is_admin(p_admin_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_status not in ('failed','cancelled') then
    raise exception 'invalid_release_status' using errcode = '22023';
  end if;

  select * into v_payout from public.gym_commission_payouts where payout_id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0002'; end if;
  if v_payout.status = 'paid' then raise exception 'paid_payout_is_final' using errcode = '22023'; end if;

  select array_agg(commission_id) into v_commission_ids
  from public.gym_commission_payout_items where payout_id = p_payout_id;
  select array_agg(adjustment_id) into v_adjustment_ids
  from public.gym_commission_payout_adjustment_items where payout_id = p_payout_id;

  update public.gym_commission_payouts
     set status = p_status,
         notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
         metadata = metadata || jsonb_build_object('released_at', now(), 'released_by', p_admin_id,
           'released_commission_ids', coalesce(to_jsonb(v_commission_ids), '[]'::jsonb),
           'released_adjustment_ids', coalesce(to_jsonb(v_adjustment_ids), '[]'::jsonb)),
         updated_at = now()
   where payout_id = p_payout_id
   returning * into v_payout;

  update public.gym_commission_ledger
     set payout_reference = null,
         metadata = metadata - 'payout_id',
         updated_at = now()
   where commission_id = any(coalesce(v_commission_ids, array[]::uuid[]));

  update public.gym_commission_adjustments
     set status = 'pending', applied_payout_id = null, updated_at = now()
   where adjustment_id = any(coalesce(v_adjustment_ids, array[]::uuid[]));

  delete from public.gym_commission_payout_adjustment_items where payout_id = p_payout_id;
  delete from public.gym_commission_payout_items where payout_id = p_payout_id;

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (p_admin_id, 'gym_commission_payout.' || p_status, 'gym_commission_payout', p_payout_id::text,
    jsonb_build_object('gym_id', v_payout.gym_id, 'amount', v_payout.amount, 'notes', p_notes));

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
end;
$$;

alter table public.subscription_plans enable row level security;
alter table public.subscription_plan_entitlements enable row level security;
alter table public.billing_events enable row level security;
alter table public.gym_commission_adjustments enable row level security;
alter table public.gym_commission_payout_adjustment_items enable row level security;

drop policy if exists "public read active subscription plans" on public.subscription_plans;
create policy "public read active subscription plans"
on public.subscription_plans for select to anon, authenticated
using (is_active = true and is_public = true);

drop policy if exists "public read active plan entitlements" on public.subscription_plan_entitlements;
create policy "public read active plan entitlements"
on public.subscription_plan_entitlements for select to anon, authenticated
using (exists (
  select 1 from public.subscription_plans p
  where p.plan_code = subscription_plan_entitlements.plan_code
    and p.is_active = true and p.is_public = true
));

drop policy if exists "commission adjustments gym or admin read" on public.gym_commission_adjustments;
create policy "commission adjustments gym or admin read"
on public.gym_commission_adjustments for select to authenticated
using (public.is_admin(auth.uid()) or public.owns_gym(gym_id, auth.uid()));

drop policy if exists "payout adjustment items gym or admin read" on public.gym_commission_payout_adjustment_items;
create policy "payout adjustment items gym or admin read"
on public.gym_commission_payout_adjustment_items for select to authenticated
using (
  public.is_admin(auth.uid()) or exists (
    select 1 from public.gym_commission_payouts p
    where p.payout_id = gym_commission_payout_adjustment_items.payout_id
      and public.owns_gym(p.gym_id, auth.uid())
  )
);

revoke all on public.subscription_plans from anon, authenticated;
revoke all on public.subscription_plan_entitlements from anon, authenticated;
grant select on public.subscription_plans to anon, authenticated;
grant select on public.subscription_plan_entitlements to anon, authenticated;
revoke all on public.billing_events from anon, authenticated;
revoke all on public.gym_commission_adjustments from anon, authenticated;
revoke all on public.gym_commission_payout_adjustment_items from anon, authenticated;
grant select on public.gym_commission_adjustments to authenticated;
grant select on public.gym_commission_payout_adjustment_items to authenticated;
grant all on public.subscription_plans, public.subscription_plan_entitlements, public.billing_events,
  public.gym_commission_adjustments, public.gym_commission_payout_adjustment_items to service_role;

revoke all on function public.qualify_gym_referral_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.qualify_gym_referral_for_payment(uuid) to service_role;
revoke all on function public.activate_verified_subscription(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.activate_verified_subscription(uuid, text, text, text, jsonb) to service_role;
revoke all on function public.resolve_user_subscription_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.resolve_user_subscription_entitlements(uuid) to service_role;
revoke all on function public.admin_create_gym_commission_payout_v2(uuid, uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.admin_create_gym_commission_payout_v2(uuid, uuid[], uuid, text) to service_role;
revoke all on function public.admin_release_gym_commission_payout(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_release_gym_commission_payout(uuid, uuid, text, text) to service_role;

commit;
