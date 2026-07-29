-- Security-advisor cleanup for newly introduced and unrelated exposed objects.

alter table public.gym_battles enable row level security;
alter table public.gym_battle_members enable row level security;

drop policy if exists "battle participants read battles" on public.gym_battles;
create policy "battle participants read battles"
on public.gym_battles for select to authenticated
using (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or public.owns_gym(gym_id, auth.uid())
  or exists (
    select 1
    from public.gym_battle_members gbm
    where gbm.battle_id = gym_battles.battle_id
      and gbm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = gym_battles.gym_id
      and gm.user_id = auth.uid()
      and gm.status in ('active', 'approved')
  )
);

drop policy if exists "battle members read relevant entries" on public.gym_battle_members;
create policy "battle members read relevant entries"
on public.gym_battle_members for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.gym_battles gb
    where gb.battle_id = gym_battle_members.battle_id
      and (
        gb.created_by = auth.uid()
        or public.owns_gym(gb.gym_id, auth.uid())
        or exists (
          select 1 from public.gym_battle_members mine
          where mine.battle_id = gb.battle_id and mine.user_id = auth.uid()
        )
      )
  )
);

-- These functions are trigger-only and must not be exposed as RPC endpoints.
revoke all on function public.sync_gym_referral_from_membership() from public, anon, authenticated;
grant execute on function public.sync_gym_referral_from_membership() to service_role;
revoke all on function public.sync_payment_partner_commission() from public, anon, authenticated;
grant execute on function public.sync_payment_partner_commission() to service_role;

-- Legacy access-code activation is replaced by the authenticated Edge Function and atomic RPC.
revoke all on function public.activate_gym_by_code_hash(text) from public, anon, authenticated;
grant execute on function public.activate_gym_by_code_hash(text) to service_role;

-- An unrelated storefront admin RPC must never be callable from browser roles.
revoke all on function public.boltmart_admin_update_order_status(text, text, text, text) from public, anon, authenticated;
grant execute on function public.boltmart_admin_update_order_status(text, text, text, text) to service_role;
