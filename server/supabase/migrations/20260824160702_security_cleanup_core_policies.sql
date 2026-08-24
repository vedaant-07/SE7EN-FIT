begin;

revoke execute on function public.enforce_gym_referral_immutability() from public, anon, authenticated;
alter function public.billing_period_end(timestamptz, text, integer) set search_path = pg_catalog;

drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_select_own_user_id on public.profiles;
drop policy if exists profiles_insert_own_user_id on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_own_user_id on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "admin or owner read gym owners" on public.gym_owners;
create policy "admin or owner read gym owners"
on public.gym_owners
for select
to authenticated
using (is_admin((select auth.uid())) or user_id = (select auth.uid()));

drop policy if exists "admin or owner read attendance logs" on public.gym_attendance_logs;

commit;
