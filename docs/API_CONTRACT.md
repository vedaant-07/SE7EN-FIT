# SE7EN FIT API Contract

This is the production API contract for connecting the app, website/gym management tool, and admin dashboard to one Render backend and one Supabase database.

Base URL examples:

```text
Production: https://api.se7enfit.com/api
Temporary Render: https://se7en-fit-api.onrender.com/api
Local: http://localhost:8080/api
```

All authenticated requests use:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

---

## Response format

Successful list:

```json
{
  "items": []
}
```

Successful object:

```json
{
  "item": {}
}
```

Successful action:

```json
{
  "success": true,
  "message": "Done"
}
```

Error:

```json
{
  "error": "Readable error message"
}
```

---

## Auth

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Register user/gym owner/admin-created user |
| POST | `/auth/login` | Public | Login with email/password and issue OTP challenge |
| POST | `/auth/verify-otp` | Public | Verify OTP and return session |
| POST | `/auth/resend-otp` | Public | Resend active OTP challenge |
| POST | `/auth/google` | Public | Login with Google ID token |
| GET | `/auth/me` | Authenticated | Return current user + role + profile |
| POST | `/auth/logout` | Authenticated | Optional server-side logout/audit |

Role payloads:

```json
{
  "email": "owner@example.com",
  "password": "secret123",
  "role": "gym_owner"
}
```

Supported roles:

```text
super_admin, admin, staff, gym_owner, gym_staff, user
```

---

## Profiles and users

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/profiles/me` | User | Current user's full profile |
| PUT | `/profiles/me` | User | Update current user profile |
| GET | `/users/me/dashboard` | User | App dashboard aggregate |
| GET | `/admin/users` | Admin | List/search users |
| GET | `/admin/users/:id` | Admin | Full user detail |
| PATCH | `/admin/users/:id/status` | Admin | Block/unblock/pending |
| PATCH | `/admin/users/:id/role` | Super admin | Assign role |

---

## Gyms and gym owners

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/gym-owners/me` | Gym owner | Current owner profile + gyms |
| PUT | `/gym-owners/me` | Gym owner | Update owner profile |
| POST | `/gym-owners/onboarding` | Gym owner | Complete gym setup and create referral code |
| GET | `/gyms/me` | Gym owner/staff | Owner/staff gym list |
| POST | `/gyms` | Gym owner | Create gym |
| GET | `/gyms/:gymId` | Gym owner/staff/admin/user if member | Gym detail |
| PATCH | `/gyms/:gymId` | Gym owner/admin | Update gym info |
| PATCH | `/admin/gyms/:gymId/status` | Admin | Verify, suspend, or reject gym |

---

## Referral and memberships

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/gym-memberships/join` | User | Join gym by referral code |
| GET | `/gym-memberships/me` | User | Current user's gym membership |
| GET | `/gym-owner/members` | Gym owner/staff | Members for owner gym |
| PATCH | `/gym-owner/members/:membershipId` | Gym owner/staff | Approve, pause, remove member |
| GET | `/admin/memberships` | Admin | All memberships |

Join payload:

```json
{
  "referral_code": "BEFIT7-C9TE"
}
```

---

## Leads

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/gym-leads` | Public/user | Create lead for a gym |
| GET | `/gym-owner/leads` | Gym owner/staff | Leads for own gym |
| PATCH | `/gym-owner/leads/:leadId` | Gym owner/staff | Update lead status |
| GET | `/admin/leads` | Admin | All leads |

Lead statuses:

```text
new, contacted, trial_booked, converted, lost
```

---

## Attendance/check-ins

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/gym-attendance/check-in` | User | Check in to user's linked gym |
| POST | `/gym-attendance/check-out` | User | Check out |
| GET | `/gym-attendance/me` | User | User attendance logs |
| GET | `/gym-owner/attendance` | Gym owner/staff | Own gym attendance |
| GET | `/admin/attendance` | Admin | System attendance |

---

## Gym equipment

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/gym-owner/equipment` | Gym owner/staff | List own gym equipment |
| POST | `/gym-owner/equipment` | Gym owner/staff | Add equipment |
| PATCH | `/gym-owner/equipment/:id` | Gym owner/staff | Update availability/details |
| DELETE | `/gym-owner/equipment/:id` | Gym owner/staff | Delete equipment |
| GET | `/users/my-gym/equipment` | User | Equipment available in user's gym |

---

## Tracking

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/tracking/today` | User | Daily aggregate for dashboard |
| POST | `/tracking/water` | User | Add water log |
| POST | `/tracking/steps` | User | Add steps log |
| POST | `/tracking/sleep` | User | Add sleep log |
| POST | `/tracking/weight` | User | Add weight log |
| POST | `/tracking/body-measurement` | User | Add body measurement |
| POST | `/tracking/cardio` | User | Add cardio log |
| GET | `/tracking/history` | User | Historical tracking |

---

## Workouts and nutrition

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/workouts/logs` | User | User workout logs |
| POST | `/workouts/logs` | User | Create workout log |
| GET | `/workouts/plans` | User/gym owner | Workout plans |
| POST | `/gym-owner/workout-plans` | Gym owner/staff | Create plan for members |
| POST | `/gym-owner/workout-assignments` | Gym owner/staff | Assign workout plan |
| GET | `/nutrition/logs` | User | Nutrition logs |
| POST | `/nutrition/logs` | User | Add meal/nutrition log |
| POST | `/gym-owner/diet-plans` | Gym owner/staff | Create diet plan |
| POST | `/gym-owner/diet-assignments` | Gym owner/staff | Assign diet plan |

---

## AI and food scan

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/ai/trainer` | User | AI trainer chat response |
| GET | `/ai/trainer/history` | User | Load saved AI chat |
| DELETE | `/ai/trainer/history` | User | Clear AI chat |
| PATCH | `/ai/trainer/messages/:id` | User | Edit user message only |
| DELETE | `/ai/trainer/messages/:id` | User | Delete user message only |
| POST | `/ai/food-scan` | User | Analyze uploaded food image |
| GET | `/admin/ai/settings` | Admin | AI config/status |
| PATCH | `/admin/ai/settings` | Admin | Update AI config/status |

---

## Community

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/community/posts` | User/admin | Feed |
| POST | `/community/posts` | User | Create post with text/image/video |
| PATCH | `/community/posts/:id` | Owner/admin | Edit own post or admin moderation |
| DELETE | `/community/posts/:id` | Owner/admin | Delete own post or remove as admin |
| POST | `/community/posts/:id/like` | User | Like/unlike post |
| GET | `/community/posts/:id/comments` | User | Comments |
| POST | `/community/posts/:id/comments` | User | Add comment |
| GET | `/admin/community/posts` | Admin | Moderation list |
| PATCH | `/admin/community/posts/:id/moderate` | Admin | Hide/restore/report action |

Media rule:

- Images: recommended 1080p or higher
- Videos: max 120 seconds
- Store in Supabase Storage bucket `community-media`

---

## Ads and offers

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/advertisements/feed` | User | User-visible ads, admin + own gym targeted |
| POST | `/gym-owner/advertisements` | Gym owner | Create gym ad for referred users |
| GET | `/gym-owner/advertisements` | Gym owner | Own ads |
| PATCH | `/gym-owner/advertisements/:id` | Gym owner | Update own ad |
| DELETE | `/gym-owner/advertisements/:id` | Gym owner | Delete own ad |
| POST | `/admin/advertisements` | Admin | Create all-user ad |
| GET | `/admin/advertisements` | Admin | All ads |
| PATCH | `/admin/advertisements/:id` | Admin | Update any ad |
| DELETE | `/admin/advertisements/:id` | Admin | Delete any ad |
| POST | `/advertisements/:id/impression` | User/public | Track impression |
| POST | `/advertisements/:id/click` | User/public | Track click |

Targeting:

```text
Admin ad: target_scope = all
Gym owner ad: target_scope = gym_members or referred_users, gym_id required
```

Media rule:

- Images: recommended 1080p or higher
- Videos: max 120 seconds
- Store in Supabase Storage bucket `ad-media`

---

## Challenges, leaderboard, rewards

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/challenges` | User | Visible challenges |
| GET | `/challenges/:id` | User | Challenge detail |
| POST | `/challenges/:id/join` | User | Join challenge |
| GET | `/challenges/me` | User | My challenges |
| PATCH | `/challenges/:id/progress` | User/system | Update progress |
| POST | `/admin/challenges` | Admin | Create global challenge |
| PATCH | `/admin/challenges/:id` | Admin | Update challenge |
| GET | `/leaderboard/my-gym` | User | User gym leaderboard |
| GET | `/gym-owner/leaderboard` | Gym owner/staff | Own gym leaderboard |
| POST | `/gym-owner/leaderboard/prizes` | Gym owner/staff | Manage own gym prizes |
| GET | `/admin/leaderboard` | Admin | System leaderboard |
| POST | `/admin/leaderboard/prizes` | Admin | Global prizes |
| GET | `/rewards/wallet` | User | Coins/wallet |
| GET | `/rewards/transactions` | User | Reward transactions |
| POST | `/admin/rewards/adjust` | Admin | Manual reward adjustment |

---

## Support

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/support/tickets` | Public/auth | Create support ticket from app/website/gym owner |
| GET | `/support/tickets/me` | Auth | User/owner tickets |
| POST | `/support/tickets/:id/messages` | Auth/admin | Reply to ticket |
| GET | `/admin/support/tickets` | Admin | All support tickets |
| PATCH | `/admin/support/tickets/:id` | Admin | Assign/status/priority |

Sources:

```text
app, website, gym_owner, admin
```

---

## Notifications

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/notifications/push-token` | User | Register mobile push token |
| GET | `/notifications/me` | User | User notifications |
| PATCH | `/notifications/:id/read` | User | Mark as read |
| POST | `/admin/notifications` | Admin | Create/send notification |
| GET | `/admin/notifications` | Admin | Notification campaigns |

Audience examples:

```json
{ "type": "all_users" }
{ "type": "gym_members", "gym_id": "uuid" }
{ "type": "role", "role": "gym_owner" }
{ "type": "specific_users", "user_ids": ["uuid"] }
```

---

## Uploads

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/uploads/media` | Auth | Upload image/video to Supabase Storage |
| DELETE | `/uploads/media/:assetId` | Owner/admin | Delete media asset |

Upload must return:

```json
{
  "asset": {
    "id": "uuid",
    "bucket": "ad-media",
    "path": "ad-media/gym-id/file.mp4",
    "public_url": "https://...",
    "media_type": "video",
    "width": 1920,
    "height": 1080,
    "duration_seconds": 90
  }
}
```

---

## Admin system settings

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin | System metrics |
| GET | `/admin/settings` | Admin | App/website settings |
| PATCH | `/admin/settings/:key` | Admin | Update setting |
| GET | `/admin/logs` | Admin | Admin audit logs |

---

## Migration strategy from current compatibility API

Current app screens can continue using `/api/entities/:entity` temporarily, but production modules should move to typed endpoints in this order:

1. Auth/profile/gym owner
2. Membership/referral
3. Tracking
4. Ads/media
5. Community
6. Challenges/leaderboard/rewards
7. Support/notifications
8. Admin modules

After all modules are typed, `entity_records` remains only as a legacy/import compatibility layer.
