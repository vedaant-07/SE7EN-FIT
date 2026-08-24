begin;

alter policy "Gym owners manage announcements" on public.gym_announcements
using (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())))
with check (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())));

alter policy "gym manager manage attendance" on public.gym_attendance_logs
using (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())) or user_id = (select auth.uid()))
with check (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())) or user_id = (select auth.uid()));

alter policy "gym equipment member read" on public.gym_equipment
using (
  is_admin((select auth.uid()))
  or owns_gym(gym_id, (select auth.uid()))
  or exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = gym_equipment.gym_id
      and gm.user_id = (select auth.uid())
      and gm.status = any (array['active'::text, 'approved'::text])
  )
);

alter policy "gym manager manage equipment" on public.gym_equipment
using (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())))
with check (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())));

alter policy "Gym owners manage leads" on public.gym_leads
using (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())))
with check (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())));

alter policy "gym manager update memberships" on public.gym_memberships
using (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())))
with check (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())));

alter policy "membership user or gym manager read" on public.gym_memberships
using (user_id = (select auth.uid()) or is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())));

alter policy "Gym owners manage payments" on public.gym_payments
using (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())))
with check (owns_gym(gym_id, (select auth.uid())) or is_admin((select auth.uid())));

alter policy gyms_select_own_owner_profile_id on public.gyms
to authenticated
using (owner_profile_id = (select auth.uid()));

alter policy gyms_insert_own on public.gyms
to authenticated
with check (owner_profile_id = (select auth.uid()));

alter policy gyms_update_own on public.gyms
to authenticated
using (owner_profile_id = (select auth.uid()))
with check (owner_profile_id = (select auth.uid()));

alter policy "admin owner or user read payments" on public.payments
using (is_admin((select auth.uid())) or owns_gym(gym_id, (select auth.uid())) or user_id = (select auth.uid()));

alter policy support_tickets_authenticated_insert on public.support_tickets
with check (user_id is null or user_id = (select auth.uid()));

alter policy support_tickets_user_read_own on public.support_tickets
using (user_id = (select auth.uid()));

alter policy ticket_messages_user_read_non_internal_own_ticket on public.ticket_messages
using (
  not is_internal
  and exists (
    select 1 from public.support_tickets t
    where t.id = ticket_messages.ticket_id
      and t.user_id = (select auth.uid())
  )
);

alter policy user_roles_super_admin_manage on public.user_roles
using (has_role((select auth.uid()), 'super_admin'::public.app_role))
with check (has_role((select auth.uid()), 'super_admin'::public.app_role));

alter policy "member reads own workout sessions" on public.workout_plan_sessions
using (user_id = (select auth.uid()));

alter policy "member reads own workout plans" on public.workout_plans
using (user_id = (select auth.uid()) or created_by = (select auth.uid()));

commit;
