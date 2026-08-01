begin;

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
  select * into v_payment
  from public.payments
  where payment_id = p_payment_id
  for update;

  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if v_payment.user_id is null then raise exception 'payment_user_required' using errcode = '22023'; end if;
  if lower(coalesce(v_payment.status, '')) not in ('success','paid','captured','succeeded','completed','partially_refunded') then
    raise exception 'payment_not_verified' using errcode = '22023';
  end if;

  select * into v_plan
  from public.subscription_plans
  where plan_code = p_plan_code and is_active = true;

  if not found then raise exception 'plan_not_available' using errcode = '22023'; end if;
  if v_plan.price_minor > 0 and round(v_payment.amount * 100)::bigint <> v_plan.price_minor then
    raise exception 'payment_amount_mismatch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.user_id::text, 0));

  select * into v_existing
  from public.subscriptions
  where payment_id = p_payment_id
  limit 1;

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
    'active', v_start, v_end, coalesce(nullif(trim(p_source), ''), 'provider'),
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

  insert into public.billing_events(
    user_id, payment_id, subscription_id, event_type, source, idempotency_key, payload
  ) values (
    v_payment.user_id, p_payment_id, v_subscription.subscription_id,
    'subscription.activated', coalesce(nullif(trim(p_source), ''), 'provider'),
    'subscription-activation:' || p_payment_id::text,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', v_end)
  ) on conflict do nothing;

  return jsonb_build_object('ok', true, 'idempotent', false, 'subscription', to_jsonb(v_subscription));
end;
$$;

revoke all on function public.activate_verified_subscription(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.activate_verified_subscription(uuid, text, text, text, jsonb) to service_role;

commit;
