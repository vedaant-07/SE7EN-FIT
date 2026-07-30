-- Atomic admin operations for the 20% gym-partner commission programme.

create or replace function public.admin_approve_gym_commissions(
  p_commission_ids uuid[],
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_total numeric(14,2);
begin
  if p_admin_id is null or not public.is_admin(p_admin_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_commission_ids is null or cardinality(p_commission_ids) = 0 or cardinality(p_commission_ids) > 500 then
    raise exception 'invalid_commission_selection' using errcode = '22023';
  end if;

  update public.gym_commission_ledger
     set status = 'approved',
         approved_at = now(),
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('approved_by', p_admin_id)
   where commission_id = any(p_commission_ids)
     and status = 'pending'
     and coalesce(available_at, created_at) <= now();

  get diagnostics v_count = row_count;
  select coalesce(sum(commission_amount), 0)
    into v_total
  from public.gym_commission_ledger
  where commission_id = any(p_commission_ids)
    and status = 'approved';

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (
    p_admin_id,
    'gym_commissions.approved',
    'gym_commission_ledger',
    null,
    jsonb_build_object('commission_ids', p_commission_ids, 'updated_count', v_count, 'approved_total', v_total)
  );

  return jsonb_build_object('ok', true, 'updated_count', v_count, 'approved_total', v_total);
end;
$$;

create or replace function public.admin_create_gym_commission_payout(
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

  perform 1
  from public.gym_commission_ledger
  where commission_id = any(p_commission_ids)
  for update;

  select count(*),
         coalesce(sum(commission_amount), 0),
         min(currency),
         min(created_at::date),
         max(created_at::date)
    into v_count, v_amount, v_currency, v_start, v_end
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
  if v_amount <= 0 then
    raise exception 'invalid_payout_amount' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.gym_commission_ledger gc
    where gc.commission_id = any(p_commission_ids)
    group by true
    having count(distinct gc.currency) > 1
  ) then
    raise exception 'mixed_payout_currency' using errcode = '22023';
  end if;

  insert into public.gym_commission_payouts(
    gym_id, amount, currency, status, period_start, period_end,
    notes, created_by, approved_by, approved_at
  ) values (
    p_gym_id, round(v_amount, 2), coalesce(v_currency, 'INR'), 'pending',
    v_start, v_end, nullif(trim(coalesce(p_notes, '')), ''),
    p_admin_id, p_admin_id, now()
  ) returning * into v_payout;

  insert into public.gym_commission_payout_items(payout_id, commission_id, amount)
  select v_payout.payout_id, gc.commission_id, gc.commission_amount
  from public.gym_commission_ledger gc
  where gc.commission_id = any(p_commission_ids)
    and gc.gym_id = p_gym_id
    and gc.status = 'approved';

  update public.gym_commission_ledger
     set payout_reference = v_payout.payout_id::text,
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payout_id', v_payout.payout_id)
   where commission_id = any(p_commission_ids);

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (
    p_admin_id,
    'gym_commission_payout.created',
    'gym_commission_payout',
    v_payout.payout_id::text,
    jsonb_build_object('gym_id', p_gym_id, 'amount', v_payout.amount, 'currency', v_payout.currency, 'commission_ids', p_commission_ids)
  );

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
end;
$$;

create or replace function public.admin_mark_gym_commission_payout_paid(
  p_payout_id uuid,
  p_admin_id uuid,
  p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.gym_commission_payouts%rowtype;
  v_count integer;
begin
  if p_admin_id is null or not public.is_admin(p_admin_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_payout_id is null or length(trim(coalesce(p_payment_reference, ''))) < 3 then
    raise exception 'payment_reference_required' using errcode = '22023';
  end if;

  select * into v_payout
  from public.gym_commission_payouts
  where payout_id = p_payout_id
  for update;

  if not found then
    raise exception 'payout_not_found' using errcode = 'P0002';
  end if;
  if v_payout.status = 'paid' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'payout', to_jsonb(v_payout));
  end if;
  if v_payout.status not in ('pending', 'processing') then
    raise exception 'payout_not_payable' using errcode = '22023';
  end if;

  update public.gym_commission_payouts
     set status = 'paid',
         payment_reference = trim(p_payment_reference),
         paid_at = now(),
         updated_at = now()
   where payout_id = p_payout_id
   returning * into v_payout;

  update public.gym_commission_ledger gc
     set status = 'paid',
         paid_at = now(),
         payout_reference = trim(p_payment_reference),
         updated_at = now()
   where exists (
     select 1 from public.gym_commission_payout_items item
     where item.payout_id = p_payout_id
       and item.commission_id = gc.commission_id
   )
     and gc.status = 'approved';

  get diagnostics v_count = row_count;

  insert into public.admin_logs(actor_id, action, entity, entity_id, details)
  values (
    p_admin_id,
    'gym_commission_payout.paid',
    'gym_commission_payout',
    p_payout_id::text,
    jsonb_build_object('gym_id', v_payout.gym_id, 'amount', v_payout.amount, 'currency', v_payout.currency, 'payment_reference', p_payment_reference, 'commission_count', v_count)
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'commission_count', v_count, 'payout', to_jsonb(v_payout));
end;
$$;

revoke all on function public.admin_approve_gym_commissions(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_gym_commissions(uuid[], uuid) to service_role;
revoke all on function public.admin_create_gym_commission_payout(uuid, uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.admin_create_gym_commission_payout(uuid, uuid[], uuid, text) to service_role;
revoke all on function public.admin_mark_gym_commission_payout_paid(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_mark_gym_commission_payout_paid(uuid, uuid, text) to service_role;

-- Unused legacy helpers are no longer browser-callable.
revoke all on function public.current_owner_gym_status() from public, anon, authenticated;
grant execute on function public.current_owner_gym_status() to service_role;
revoke all on function public.delete_fake_gym_request(uuid) from public, anon, authenticated;
grant execute on function public.delete_fake_gym_request(uuid) to service_role;
