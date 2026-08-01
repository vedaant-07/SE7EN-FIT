begin;

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

  -- A partial refund remains a successful payment for the unrefunded balance.
  v_success := lower(coalesce(new.status, '')) = any(array[
    'success','paid','captured','succeeded','completed','partially_refunded'
  ]);
  v_reversed := lower(coalesce(new.status, '')) = any(array[
    'refunded','cancelled','chargeback','reversed'
  ]);
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

  select * into v_ledger
  from public.gym_commission_ledger
  where payment_id = new.payment_id
  for update;

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
          gym_id, user_id, payment_id, commission_id, amount, currency,
          reason, source_key, metadata
        ) values (
          v_ledger.gym_id, v_ledger.user_id, new.payment_id, v_ledger.commission_id,
          -v_remaining, v_ledger.currency, 'Post-payout partial refund',
          new.payment_id::text || ':partial-refund:' || coalesce(new.refunded_amount, 0)::text,
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
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'payment_status', new.status,
               'refunded_amount', coalesce(new.refunded_amount, 0)
             ),
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
          gym_id, user_id, payment_id, commission_id, amount, currency,
          reason, source_key, metadata
        ) values (
          v_ledger.gym_id, v_ledger.user_id, new.payment_id, v_ledger.commission_id,
          -v_remaining, v_ledger.currency, 'Post-payout payment reversal',
          new.payment_id::text || ':full-reversal:' || coalesce(new.status, ''),
          jsonb_build_object('payment_status', new.status, 'refunded_amount', coalesce(new.refunded_amount, 0))
        ) on conflict (source_key) do nothing;
      end if;
    elsif v_ledger.commission_id is not null then
      update public.gym_commission_ledger
         set status = 'reversed',
             gross_amount = 0,
             commission_amount = 0,
             reversed_at = now(),
             reversal_reason = 'Payment status changed to ' || coalesce(new.status, 'reversed'),
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'payment_status', new.status,
               'refunded_amount', coalesce(new.refunded_amount, 0)
             ),
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

commit;
