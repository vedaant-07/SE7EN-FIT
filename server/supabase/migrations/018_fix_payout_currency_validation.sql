begin;

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
  v_currency_count integer;
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

  select count(*), coalesce(sum(commission_amount), 0), min(currency),
         count(distinct currency), min(created_at::date), max(created_at::date)
    into v_count, v_commission_total, v_currency, v_currency_count, v_start, v_end
  from public.gym_commission_ledger gc
  where gc.commission_id = any(p_commission_ids)
    and gc.gym_id = p_gym_id
    and gc.status = 'approved'
    and not exists (
      select 1 from public.gym_commission_payout_items item
      where item.commission_id = gc.commission_id
    );

  if v_count <> v_expected then
    raise exception 'commissions_not_payable' using errcode = '22023';
  end if;
  if v_currency_count > 1 then
    raise exception 'mixed_payout_currency' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_adjustment_total
  from public.gym_commission_adjustments
  where gym_id = p_gym_id
    and status = 'pending'
    and currency = coalesce(v_currency, 'INR');

  v_amount := round(v_commission_total + v_adjustment_total, 2);
  if v_amount <= 0 then
    raise exception 'payout_net_not_positive' using errcode = '22023';
  end if;

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
  where gc.commission_id = any(p_commission_ids)
    and gc.gym_id = p_gym_id
    and gc.status = 'approved';

  insert into public.gym_commission_payout_adjustment_items(payout_id, adjustment_id, amount)
  select v_payout.payout_id, adjustment_id, amount
  from public.gym_commission_adjustments
  where gym_id = p_gym_id
    and status = 'pending'
    and currency = coalesce(v_currency, 'INR');

  update public.gym_commission_adjustments
     set status = 'applied', applied_payout_id = v_payout.payout_id, updated_at = now()
   where gym_id = p_gym_id
     and status = 'pending'
     and currency = coalesce(v_currency, 'INR');

  update public.gym_commission_ledger
     set payout_reference = v_payout.payout_id::text,
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payout_id', v_payout.payout_id)
   where commission_id = any(p_commission_ids);

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (
    p_admin_id, 'gym_commission_payout.created', 'gym_commission_payout', v_payout.payout_id::text,
    jsonb_build_object('gym_id', p_gym_id, 'net_amount', v_amount,
      'commission_total', v_commission_total, 'adjustment_total', v_adjustment_total,
      'commission_ids', p_commission_ids)
  );

  return jsonb_build_object(
    'ok', true,
    'payout', to_jsonb(v_payout),
    'commission_total', v_commission_total,
    'adjustment_total', v_adjustment_total
  );
end;
$$;

revoke all on function public.admin_create_gym_commission_payout_v2(uuid, uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.admin_create_gym_commission_payout_v2(uuid, uuid[], uuid, text) to service_role;

commit;
