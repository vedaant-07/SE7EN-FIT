# SE7EN FIT Supabase Schema Plan

This file defines the production database target for the app, gym owner website, and admin dashboard.

The current backend can keep `entity_records` temporarily as a compatibility bridge, but the production system should use typed tables for critical data.

---

## Core principles

1. One Supabase project for the full ecosystem.
2. Auth users live in `auth.users`.
3. Public profile and role data lives in `public.profiles` and `public.user_roles`.
4. Service-role operations happen only in the Render backend.
5. Frontends never receive the Supabase service-role key.
6. Gym owner data is scoped by `gym_id` and ownership/staff assignment.
7. Admin actions are logged in `admin_logs`.
8. Media files use Supabase Storage and a `media_assets` metadata table.

---

## Enums

```sql
create type public.app_role as enum (
  'super_admin',
  'admin',
  'staff',
  'gym_owner',
  'gym_staff',
  'user'
);

create type public.platform_source as enum (
  'app',
  'website',
  'gym_owner',
  'admin'
);

create type public.user_status as enum (
  'active',
  'blocked',
  'pending'
);

create type public.gym_status as enum (
  'pending',
  'verified',
  'rejected',
  'suspended'
);

create type public.membership_status as enum (
  'pending',
  'active',
  'paused',
  'cancelled',
  'removed'
);

create type public.lead_status as enum (
  'new',
  'contacted',
  'trial_booked',
  'converted',
  'lost'
);

create type public.ticket_status as enum (
  'new',
  'open',
  'pending',
  'resolved',
  'closed'
);

create type public.ticket_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.media_type as enum (
  'image',
  'video',
  'document'
);

create type public.ad_target_scope as enum (
  'all',
  'gym_members',
  'referred_users',
  'custom'
);
```

---

## Identity and role tables

### `profiles`

One row per auth user.

Important columns:

```text
user_id uuid primary key references auth.users(id)
email text
role text or app_role
full_name text
phone text
avatar_url text
source platform_source
status user_status
metadata jsonb
last_seen_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `user_roles`

Additional role assignments.

```text
id uuid primary key
user_id uuid references auth.users(id)
role app_role
created_at timestamptz
unique(user_id, role)
```

### Required helper functions

```text
has_role(user_id, role)
is_admin(user_id)
is_gym_owner(user_id, gym_id)
is_gym_staff(user_id, gym_id)
```

---

## Gym management tables

### `gyms`

```text
gym_id uuid primary key
owner_user_id uuid references auth.users(id)
name text
slug text unique
referral_code text unique
logo_asset_id uuid references media_assets(id)
cover_asset_id uuid references media_assets(id)
phone text
email text
address text
city text
state text
country text
pincode text
latitude numeric
longitude numeric
status gym_status
opening_hours jsonb
amenities jsonb
pricing jsonb
metadata jsonb
created_at timestamptz
updated_at timestamptz
```

### `gym_owners`

```text
id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
owner_name text
email text
phone text
kyc_status text
onboarding_complete boolean
created_at timestamptz
updated_at timestamptz
unique(user_id, gym_id)
```

### `gym_staff`

```text
id uuid primary key
gym_id uuid references gyms(gym_id)
user_id uuid references auth.users(id)
role text
permissions jsonb
status text
created_at timestamptz
updated_at timestamptz
unique(gym_id, user_id)
```

### `gym_memberships`

This is the key table connecting app users to gyms.

```text
membership_id uuid primary key
gym_id uuid references gyms(gym_id)
user_id uuid references auth.users(id)
referred_by_code text
status membership_status
joined_at timestamptz
approved_at timestamptz
cancelled_at timestamptz
notes text
metadata jsonb
created_at timestamptz
updated_at timestamptz
unique(gym_id, user_id)
```

### `gym_leads`

```text
lead_id uuid primary key
gym_id uuid references gyms(gym_id)
owner_user_id uuid references auth.users(id)
source platform_source
name text
phone text
email text
city text
message text
status lead_status
assigned_to uuid references auth.users(id)
created_at timestamptz
updated_at timestamptz
```

### `gym_attendance_logs`

```text
log_id uuid primary key
gym_id uuid references gyms(gym_id)
user_id uuid references auth.users(id)
membership_id uuid references gym_memberships(membership_id)
date date
check_in_at timestamptz
check_out_at timestamptz
duration_minutes integer
status text
created_at timestamptz
updated_at timestamptz
```

### `gym_equipment`

```text
equipment_id uuid primary key
gym_id uuid references gyms(gym_id)
name text
category text
quantity integer
available boolean
image_asset_id uuid references media_assets(id)
metadata jsonb
created_at timestamptz
updated_at timestamptz
```

### `gym_plans`

```text
plan_id uuid primary key
gym_id uuid references gyms(gym_id)
name text
price numeric
billing_cycle text
duration_days integer
features jsonb
active boolean
created_at timestamptz
updated_at timestamptz
```

---

## User fitness tables

### Tracking

```text
workout_logs
nutrition_logs
water_logs
step_logs
sleep_logs
weight_logs
body_measurements
cardio_logs
habit_logs
mood_logs
```

Each should include:

```text
id uuid primary key
user_id uuid references auth.users(id)
date date
data columns specific to module
source platform_source default 'app'
created_at timestamptz
updated_at timestamptz
```

Important module columns:

- `nutrition_logs`: meal_type, food_name, calories, protein_g, carbs_g, fat_g, image_asset_id
- `water_logs`: amount_ml
- `step_logs`: steps, distance_km, calories
- `sleep_logs`: hours, quality
- `weight_logs`: weight_kg
- `body_measurements`: chest_cm, waist_cm, hip_cm, biceps_cm, thighs_cm, notes
- `workout_logs`: workout_name, workout_type, duration_minutes, calories_burned, exercises jsonb, completed boolean

---

## Workout and diet planning tables

### `workout_plans`

```text
plan_id uuid primary key
created_by uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
title text
goal text
level text
duration_weeks integer
plan_data jsonb
visibility text
created_at timestamptz
updated_at timestamptz
```

### `workout_assignments`

```text
assignment_id uuid primary key
plan_id uuid references workout_plans(plan_id)
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
assigned_by uuid references auth.users(id)
status text
created_at timestamptz
updated_at timestamptz
```

### `diet_plans` and `diet_assignments`

Same pattern as workout plans.

---

## Community tables

### `community_posts`

```text
post_id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
type text
content text
media_asset_id uuid references media_assets(id)
media_url text
media_type media_type
media_crop text
likes_count integer
comments_count integer
status text
created_at timestamptz
updated_at timestamptz
```

### `community_comments`

```text
comment_id uuid primary key
post_id uuid references community_posts(post_id)
user_id uuid references auth.users(id)
body text
status text
created_at timestamptz
updated_at timestamptz
```

### `community_likes`

```text
post_id uuid references community_posts(post_id)
user_id uuid references auth.users(id)
created_at timestamptz
primary key(post_id, user_id)
```

---

## Ads and media tables

### `media_assets`

```text
asset_id uuid primary key
owner_user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
bucket text
path text
public_url text
media_type media_type
mime_type text
size_bytes bigint
width integer
height integer
duration_seconds integer
crop_position text
quality_label text
status text
created_at timestamptz
```

### `advertisements`

```text
ad_id uuid primary key
created_by uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
source_type text -- admin or gym_owner
source_name text
title text
description text
offer_text text
cta_label text
cta_url text
media_asset_id uuid references media_assets(asset_id)
media_url text
media_type media_type
media_crop text
target_scope ad_target_scope
status text
start_at timestamptz
end_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `ad_impressions` and `ad_clicks`

```text
id uuid primary key
ad_id uuid references advertisements(ad_id)
user_id uuid references auth.users(id)
source platform_source
created_at timestamptz
```

---

## Challenges, rewards, leaderboard

### `challenges`

```text
challenge_id uuid primary key
created_by uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
title text
description text
difficulty text
duration_days integer
reward_coins integer
rules jsonb
target_scope text
premium_required boolean
status text
created_at timestamptz
updated_at timestamptz
```

### `challenge_participants`

```text
id uuid primary key
challenge_id uuid references challenges(challenge_id)
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
progress numeric
status text
joined_at timestamptz
completed_at timestamptz
unique(challenge_id, user_id)
```

### `leaderboard_scores`

```text
score_id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
period text
score numeric
rank integer
breakdown jsonb
created_at timestamptz
updated_at timestamptz
unique(user_id, gym_id, period)
```

### `leaderboard_prizes`

```text
prize_id uuid primary key
gym_id uuid references gyms(gym_id)
created_by uuid references auth.users(id)
rank integer
title text
description text
coins integer
asset_id uuid references media_assets(asset_id)
period text
active boolean
created_at timestamptz
updated_at timestamptz
```

### `reward_wallets` and `reward_transactions`

```text
reward_wallets:
user_id uuid primary key references auth.users(id)
coins integer
lifetime_earned integer
updated_at timestamptz

reward_transactions:
transaction_id uuid primary key
user_id uuid references auth.users(id)
amount integer
type text
source text
reference_id uuid
created_at timestamptz
```

---

## Support and notifications

Admin dashboard already defines these, but source values should include `gym_owner` as well.

### `support_tickets`

```text
id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
user_name text
user_email text
user_phone text
source platform_source
subject text
message text
priority ticket_priority
status ticket_status
assigned_to uuid references auth.users(id)
is_read boolean
created_at timestamptz
updated_at timestamptz
```

### `ticket_messages`

```text
id uuid primary key
ticket_id uuid references support_tickets(id)
author_id uuid references auth.users(id)
body text
is_internal boolean
created_at timestamptz
```

### `notifications`

```text
notification_id uuid primary key
title text
body text
target platform_source
audience jsonb
channel text
status text
scheduled_at timestamptz
sent_at timestamptz
created_by uuid references auth.users(id)
created_at timestamptz
```

### `push_tokens`

```text
token_id uuid primary key
user_id uuid references auth.users(id)
platform text
token text unique
device_info jsonb
active boolean
created_at timestamptz
updated_at timestamptz
```

---

## Payments and subscriptions

### `subscriptions`

```text
subscription_id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
plan_code text
provider text
provider_subscription_id text
status text
current_period_start timestamptz
current_period_end timestamptz
created_at timestamptz
updated_at timestamptz
```

### `payments`

```text
payment_id uuid primary key
user_id uuid references auth.users(id)
gym_id uuid references gyms(gym_id)
provider text
provider_payment_id text
amount numeric
currency text
status text
metadata jsonb
created_at timestamptz
```

---

## Admin settings and audit logs

### `app_settings`

```text
key text primary key
scope platform_source
value jsonb
description text
updated_by uuid references auth.users(id)
updated_at timestamptz
```

### `admin_logs`

```text
log_id uuid primary key
actor_id uuid references auth.users(id)
action text
entity text
entity_id text
details jsonb
created_at timestamptz
```

---

## Supabase Storage buckets

```text
profile-avatars
progress-photos
community-media
ad-media
gym-assets
support-attachments
food-scan-images
```

Storage rules:

- Users can upload their own profile/progress/community/food-scan media.
- Gym owners can upload media scoped to their gym.
- Admin can upload and manage all media.
- Public read can be allowed for published ads/community media if necessary.
- Private media should use signed URLs.

---

## RLS policy direction

### Users

- Read/write own profile.
- Read own tracking, posts, memberships, support tickets, rewards, notifications.
- Read public/global challenges and ads.
- Read own gym-scoped data if member.

### Gym owners

- Read/write own gym.
- Read/write own gym members, leads, attendance, equipment, plans, ads, leaderboard prizes.
- Cannot see another gym's private data.

### Gym staff

- Same as owner only for assigned modules in `gym_staff.permissions`.

### Admin

- Full read/write through admin dashboard and backend service role.
- Sensitive admin changes should create `admin_logs` rows.

---

## Migration phases

### Migration 1: foundation

- Enums
- `profiles`
- `user_roles`
- helper functions
- `app_settings`
- `admin_logs`

### Migration 2: gyms and memberships

- `gyms`
- `gym_owners`
- `gym_staff`
- `gym_memberships`
- `gym_leads`
- `gym_attendance_logs`
- `gym_equipment`
- `gym_plans`

### Migration 3: app fitness data

- tracking tables
- workout/diet planning tables

### Migration 4: media, ads, community

- storage buckets
- `media_assets`
- community tables
- ad tables

### Migration 5: challenges, rewards, leaderboard

- challenge tables
- leaderboard tables
- reward tables

### Migration 6: support, notifications, payments

- extend existing support/notification tables
- `push_tokens`
- `subscriptions`
- `payments`

---

## Compatibility layer

Current app and some generated pages can keep using:

```text
/api/entities/:entity
public.entity_records
```

But typed tables must become the source of truth. During migration, backend can mirror writes from typed endpoints into `entity_records` only where old UI still expects them.

Final target:

```text
entity_records = legacy/import fallback only
Typed tables = production source of truth
```
