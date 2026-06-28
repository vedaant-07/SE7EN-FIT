# SE7EN FIT API Contract

This is the production-only API contract for connecting the app, website/gym management tool, and admin dashboard to one Render backend and one Supabase database.

Base URL examples:

```text
Production: https://api.se7enfit.com/api
Render production service: https://se7en-fit-api.onrender.com/api
Local development: http://localhost:8080/api
```

All authenticated requests use:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

No production feature should depend on local storage data, demo data, placeholder APIs, or generic JSON entity storage. Production modules use typed API routes and typed Supabase tables.

---

## Response format

Successful list:

```json
{ "items": [] }
```

Successful object:

```json
{ "item": {} }
```

Successful action:

```json
{ "success": true, "message": "Done" }
```

Error:

```json
{ "error": "Readable error message" }
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
| POST | `/auth/logout` | Authenticated | Server-side logout/audit event |

Supported roles:

```text
super_admin, admin, staff, gym_owner, gym_staff, user
```

---

## Production route map

### Users and profiles

```text
GET    /profiles/me
PUT    /profiles/me
GET    /users/me/dashboard
GET    /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id/status
PATCH  /admin/users/:id/role
```

### Gyms, gym owners, staff

```text
GET    /gym-owners/me
PUT    /gym-owners/me
POST   /gym-owners/onboarding
GET    /gyms/me
POST   /gyms
GET    /gyms/:gymId
PATCH  /gyms/:gymId
GET    /gym-owner/staff
POST   /gym-owner/staff
PATCH  /gym-owner/staff/:staffId
DELETE /gym-owner/staff/:staffId
GET    /admin/gyms
PATCH  /admin/gyms/:gymId/status
GET    /admin/gym-owners
PATCH  /admin/gym-owners/:id/status
```

### Referral, members, leads, attendance

```text
POST   /gym-memberships/join
GET    /gym-memberships/me
GET    /gym-owner/members
PATCH  /gym-owner/members/:membershipId
GET    /admin/memberships
POST   /gym-leads
GET    /gym-owner/leads
PATCH  /gym-owner/leads/:leadId
GET    /admin/leads
POST   /gym-attendance/check-in
POST   /gym-attendance/check-out
GET    /gym-attendance/me
GET    /gym-owner/attendance
GET    /admin/attendance
```

### Gym equipment and plans

```text
GET    /gym-owner/equipment
POST   /gym-owner/equipment
PATCH  /gym-owner/equipment/:id
DELETE /gym-owner/equipment/:id
GET    /users/my-gym/equipment
GET    /gym-owner/plans
POST   /gym-owner/plans
PATCH  /gym-owner/plans/:planId
DELETE /gym-owner/plans/:planId
```

### Tracking, workouts, nutrition

```text
GET    /tracking/today
GET    /tracking/history
POST   /tracking/water
POST   /tracking/steps
POST   /tracking/sleep
POST   /tracking/weight
POST   /tracking/body-measurement
POST   /tracking/cardio
GET    /workouts/logs
POST   /workouts/logs
GET    /workouts/plans
POST   /gym-owner/workout-plans
POST   /gym-owner/workout-assignments
GET    /nutrition/logs
POST   /nutrition/logs
POST   /gym-owner/diet-plans
POST   /gym-owner/diet-assignments
```

### AI and food scan

```text
POST   /ai/trainer
GET    /ai/trainer/history
DELETE /ai/trainer/history
PATCH  /ai/trainer/messages/:id      -- user messages only
DELETE /ai/trainer/messages/:id      -- user messages only
POST   /ai/food-scan
GET    /admin/ai/settings
PATCH  /admin/ai/settings
```

### Community

```text
GET    /community/posts
POST   /community/posts
PATCH  /community/posts/:id
DELETE /community/posts/:id
POST   /community/posts/:id/like
GET    /community/posts/:id/comments
POST   /community/posts/:id/comments
GET    /admin/community/posts
PATCH  /admin/community/posts/:id/moderate
```

Rules:

- Users can edit/delete their own posts.
- Admin can moderate posts.
- Images must be production storage URLs.
- Videos must be 120 seconds or less.

### Ads and offers

```text
GET    /advertisements/feed
POST   /gym-owner/advertisements
GET    /gym-owner/advertisements
PATCH  /gym-owner/advertisements/:id
DELETE /gym-owner/advertisements/:id
POST   /admin/advertisements
GET    /admin/advertisements
PATCH  /admin/advertisements/:id
DELETE /admin/advertisements/:id
POST   /advertisements/:id/impression
POST   /advertisements/:id/click
```

Targeting:

```text
Admin ad: target_scope = all
Gym owner ad: target_scope = gym_members or referred_users, gym_id required
```

Rules:

- Images should be 1080p or higher.
- Videos must be 120 seconds or less.
- Media lives in Supabase Storage bucket `ad-media`.

### Challenges, leaderboard, rewards

```text
GET    /challenges
GET    /challenges/:id
POST   /challenges/:id/join
GET    /challenges/me
PATCH  /challenges/:id/progress
POST   /admin/challenges
PATCH  /admin/challenges/:id
DELETE /admin/challenges/:id
GET    /leaderboard/my-gym
GET    /gym-owner/leaderboard
POST   /gym-owner/leaderboard/prizes
GET    /admin/leaderboard
POST   /admin/leaderboard/prizes
GET    /rewards/wallet
GET    /rewards/transactions
POST   /admin/rewards/adjust
```

### Support

```text
POST   /support/tickets
GET    /support/tickets/me
POST   /support/tickets/:id/messages
GET    /admin/support/tickets
PATCH  /admin/support/tickets/:id
```

Sources:

```text
app, website, gym_owner, admin
```

### Notifications

```text
POST   /notifications/push-token
GET    /notifications/me
PATCH  /notifications/:id/read
POST   /admin/notifications
GET    /admin/notifications
```

Audience examples:

```json
{ "type": "all_users" }
{ "type": "gym_members", "gym_id": "uuid" }
{ "type": "role", "role": "gym_owner" }
{ "type": "specific_users", "user_ids": ["uuid"] }
```

### Uploads

```text
POST   /uploads/media
DELETE /uploads/media/:assetId
```

Upload must return a permanent media asset:

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

### Admin system settings and logs

```text
GET    /admin/dashboard
GET    /admin/settings
PATCH  /admin/settings/:key
GET    /admin/logs
```

---

## Production implementation rule

Every route in this contract must map to a typed Supabase table from `server/supabase/migrations/002_production_schema.sql` and must enforce role checks in the backend.
