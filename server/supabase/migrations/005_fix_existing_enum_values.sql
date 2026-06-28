-- Compatibility migration for projects where enums were created before the full production values existed.
-- Fixes: invalid input value for enum platform_source: "gym_owner".

alter type public.platform_source add value if not exists 'gym_owner';
alter type public.app_role add value if not exists 'gym_owner';
alter type public.app_role add value if not exists 'gym_staff';
alter type public.membership_status add value if not exists 'removed';
alter type public.lead_status add value if not exists 'trial_booked';
alter type public.ad_target_scope add value if not exists 'referred_users';
alter type public.ad_target_scope add value if not exists 'gym_members';
alter type public.media_kind add value if not exists 'document';
