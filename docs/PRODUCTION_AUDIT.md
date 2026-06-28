# SE7EN FIT Production Audit

This document is the working audit for making the full SE7EN FIT ecosystem production-ready across:

- `vedaant-07/SE7EN-FIT` — user app, Capacitor native app, and current Render API
- `vedaant-07/GYM-OWNER` — public website + gym management tool
- `vedaant-07/super-admin-station` — super admin dashboard

## Non-negotiable rule

Do not change the user-facing app UI in `SE7EN-FIT` without explicit approval. App work should be limited to API integration, production wiring, bug fixes, native setup, and backend/server work unless UI approval is requested first.

The gym owner website and admin panel can be redesigned or extended where needed.

---

## Target production architecture

```text
SE7EN FIT Mobile App ─┐
SE7EN FIT Web App    ├── Render Backend API ─── Supabase PostgreSQL
Gym Owner Website    ┤                         Supabase Storage
Admin Dashboard      ┘                         Push/Email/AI providers
```

There must be one source of truth:

- One Supabase project
- One production backend API
- One auth/session model
- One role model
- Shared data between app, gym website, and admin panel

---

## Current repository findings

### 1. App repository: `SE7EN-FIT`

Current state:

- React/Vite app with Capacitor Android scripts already present.
- Render blueprint already defines a static frontend service and a Node backend service.
- Backend is currently inside `server/index.js`.
- Backend already supports Supabase Auth, OTP via Mailjet, `/api/auth/*`, `/api/gym-owners/*`, and generic `/api/entities/:entity` compatibility routes.
- Generic entity storage currently uses `public.entity_records` JSON-style records, which is useful as a compatibility bridge but not ideal as the final production schema.

Production gaps:

- Dedicated production tables are missing for most product modules.
- Generic entity API needs to be replaced or supplemented with typed module APIs.
- File/media upload must use permanent Supabase Storage URLs.
- AI Trainer and Food Scan need production AI endpoints.
- Support requests must write into shared `support_tickets`.
- Notifications and push tokens need production backend routes.
- Admin controls should not depend on local compatibility entities.
- Native app needs final API URL, Android permissions verification, release signing, Play Store AAB workflow, and crash testing.

Risk level: high until data model is unified.

### 2. Gym owner repository: `GYM-OWNER`

Current state:

- Vite React website.
- Has many dashboard routes already: dashboard, members, referred users, attendance, leads, payments, plans, campaigns, WhatsApp, email notifications, automations, challenges, staff, classes, equipment, reviews, referrals, reports, profile, settings, and admin.
- Current adapter uses Supabase directly through `supabaseBase44Adapter.js`.
- It maps some Base44 entities to physical tables such as `gyms`, `members`, `profiles`, and `email_messages`.
- `src/lib/api-client.js` has an API client but the current default backend URL is `https://se7enfit-original.onrender.com`.

Production gaps:

- Must standardize to the same final backend used by the app.
- Must stop mixing direct Supabase entity access and backend API access for privileged actions.
- Needs route-level role checks for gym owners and gym staff.
- Needs full connection for referred users, active members, attendance, leads, ads/offers, leaderboard, support, and gym plans.
- Needs a production public website section with app download buttons for Play Store/App Store.
- Needs clear difference between public marketing website and authenticated gym management tool.

Risk level: medium-high until it is moved to the shared API contract.

### 3. Admin repository: `super-admin-station`

Current state:

- React/TanStack app using Supabase client.
- Has an admin-focused migration that creates `profiles`, `user_roles`, `support_tickets`, `ticket_messages`, `notifications`, `app_settings`, and `admin_logs`.
- Already has the correct idea for admin roles and support-ticket integration.

Production gaps:

- Migration is admin/support-focused, not a complete SE7EN FIT production schema.
- Needs modules for gyms, gym owners, gym verification, memberships, ads, challenges, rewards, community moderation, subscriptions, payments, leaderboard prizes, and media assets.
- Needs integration with the central backend for service-role operations.
- Needs system-wide audit logs for admin changes.
- Page metadata still contains generic Lovable titles and should be branded.

Risk level: medium until full admin modules and schema are added.

---

## Required role model

```text
super_admin  → full platform control
admin        → operational platform control
staff        → limited admin/support operations
gym_owner    → owns one or more gyms
gym_staff    → assigned to a gym by owner
user         → normal app user
```

Rules:

- Admin can see and control all gyms, users, ads, support, challenges, and settings.
- Gym owner can only see and manage their own gym data.
- Gym staff can only access assigned gym modules.
- User can only access their own personal data and public/shared content.

---

## Feature connection audit

| Feature | App | Gym owner website | Admin panel | Production status |
|---|---:|---:|---:|---|
| Email/password auth + OTP | Partial | Partial | Supabase auth | Needs unified backend contract |
| Google login | Partial config | Disabled | Not required now | Needs OAuth setup later |
| User profile/onboarding | Partial | Not primary | Partial | Needs shared profile schema |
| Gym onboarding | Partial | Partial | Missing verification | Needs `gyms` + `gym_owners` tables |
| Referral code | Partial | Partial | Missing control | Needs membership linkage |
| Gym members | Partial | Partial | Missing full view | Needs `gym_memberships` table |
| Leads | Partial | Partial | Missing full view | Needs `gym_leads` table/API |
| Attendance/check-ins | Partial | Partial | Missing full view | Needs `gym_attendance_logs` table/API |
| Gym equipment | Partial | Partial | Missing control | Needs typed table/API |
| Ads/offers | Partial | Partial | Partial | Needs permanent media + targeting rules |
| Community | Partial | Not primary | Missing moderation | Needs moderation + comments/likes |
| Challenges | Partial | Partial | Missing full control | Needs typed challenge tables |
| Leaderboard/prizes | Partial | Partial | Partial | Needs centralized scoring |
| Rewards/wallet | Partial | Not primary | Missing control | Needs rewards schema |
| AI Trainer | Frontend fallback | Not primary | Settings missing | Needs `/api/ai/trainer` |
| Food Scan | Partial | Not primary | Settings missing | Needs `/api/ai/food-scan` |
| Support | Partial | Missing/partial | Existing foundation | Needs all clients to same table/API |
| Notifications | Partial | Partial | Existing foundation | Needs push tokens and delivery workflow |
| Payments/subscriptions | Partial | Partial | Missing full control | Needs provider + tables |
| Media uploads | Temporary/fallback | Partial | Partial | Needs Supabase Storage upload API |
| Native Android | Partial | N/A | N/A | Needs final API env + release workflow |

---

## Production readiness checklist

### Foundation

- [ ] Finalize Supabase master schema.
- [ ] Add storage buckets and policies.
- [ ] Add typed backend modules instead of relying only on `entity_records`.
- [ ] Standardize API base URL in all repos.
- [ ] Standardize auth token/session handling.
- [ ] Add role middleware for admin, gym owner, gym staff, user.
- [ ] Add admin audit logs for sensitive changes.

### App

- [ ] Keep UI unchanged unless approved.
- [ ] Connect all data reads/writes to production API.
- [ ] Replace temporary upload URLs with permanent storage URLs.
- [ ] Add production support tickets.
- [ ] Add push token registration.
- [ ] Finalize native Android permission and AAB build.

### Gym owner website

- [ ] Connect all dashboard data to central backend.
- [ ] Add public website download-app section.
- [ ] Add gym owner support tickets.
- [ ] Add ad/media upload through backend.
- [ ] Add leaderboard/prize management for own gym.
- [ ] Add staff access if required.

### Admin dashboard

- [ ] Add full admin modules for users, gyms, ads, challenges, rewards, community, payments, notifications, and support.
- [ ] Add admin-only backend endpoints or secure RPCs.
- [ ] Brand metadata and remove generic Lovable labels.
- [ ] Add operational logs.

---

## Recommended build order

1. Supabase master schema and storage buckets.
2. Backend auth/role/middleware cleanup.
3. Backend typed APIs for core modules.
4. Gym owner website connection to typed APIs.
5. Admin panel full control modules.
6. App data integration without UI changes.
7. Native Android production build and testing.
8. Render deployment and environment validation.

---

## Next implementation files

- `docs/API_CONTRACT.md`
- `docs/SUPABASE_SCHEMA_PLAN.md`
- `server/routes/*` or a modular rewrite of `server/index.js`
- Supabase migrations for product schema
- Shared API adapters for app and gym owner website
