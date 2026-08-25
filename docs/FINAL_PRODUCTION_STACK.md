# SE7EN FIT Production Architecture

This document is the production architecture source of truth for SE7EN FIT.

## Platform shape

```txt
                    SE7EN FIT PLATFORM

                         │
          ┌──────────────┴──────────────┐
          │                             │
       MOBILE                         WEB
          │                             │
   ┌──────┴───────┐            ┌────────┴─────────┐
   │              │            │                  │
 USER        GYM OWNER      GYM OWNER         SUPER ADMIN
   │              │            │                  │
Fitness        Quick        Complete           Platform
tracking     operations     management         control
   │              │            │                  │
   └──────────────┴────────────┴──────────────────┘
                          │
                     ONE API
                          │
                 Node/Express Render
                          │
             Authentication + validation
                permissions + business
                          │
                          ▼
                       SUPABASE
                Postgres + Storage/Auth
```

## Services

- Mobile app: React/Vite application packaged with Capacitor for Android/iOS native shells.
- Main/gym-owner/admin web application: React/Vite/TypeScript frontend hosted as a static Render service.
- Backend API: Node.js/Express hosted on Render (`se7en-fit-api`).
- Database: Supabase Postgres.
- Identity provider: Supabase Auth.
- Media/file storage: Supabase Storage.
- Email/OTP/support email: Mailjet through controlled server-side code.
- AI/payment/notification providers: server-side integrations behind the API except for explicitly public client SDK values.

## Production request flow

```txt
Capacitor mobile app
Gym-owner web application
Super-admin web application
        ↓
Render Node.js API
        ↓
Supabase Auth + Postgres + Storage
        ↓
Mailjet / AI / payment / notification providers
```

The long-term rule is one application API/control plane. Existing Supabase Edge Functions used by the legacy super-admin surface are transitional and must be migrated into the shared Render API before that legacy function set is retired.

## Ownership rules

1. `server/` owns production business logic and privileged provider integrations.
2. `server/supabase/migrations/` is the canonical production database migration history.
3. Frontend repositories do not independently evolve production database schema.
4. Supabase service-role credentials never appear in a frontend bundle.
5. Mail, payment, AI, signing and admin secrets are backend-only.
6. Every gym/admin privileged write is authorized server-side; UI visibility is never treated as authorization.
7. Every persisted fitness measurement keeps its source/provenance.
8. No demo/local fallback data is allowed in production flows.
9. Production deploys require reviewed commits and passing security/quality gates.

## Mobile product structure

Primary user navigation is intentionally small:

```txt
Home
Track
Explore
History
Profile
```

- Home: today's activity and meaningful summary.
- Track: one focused activity recorder.
- Explore: trends, secondary health/activity metrics and analysis.
- History: saved activity/session history.
- Profile: account, settings, gym membership and personal configuration.

AI, nutrition, community, challenges, rewards and other secondary features may remain available, but they do not dominate the primary tracking experience.

## Mobile activity integrity

- Android hardware steps use the first-party `SE7ENHealth` Capacitor bridge and Android `TYPE_STEP_COUNTER` where available.
- Manual steps must never masquerade as sensor-measured steps.
- GPS sessions retain source metadata and accuracy filtering.
- Current GPS tracking is foreground-oriented until a native foreground location service is implemented and validated.
- Health Connect historical aggregation and iOS HealthKit are separate integrations and must not be claimed before implementation/testing.

## Authentication and authorization

- Supabase Auth establishes identity.
- The API verifies bearer tokens against Supabase.
- Database profile/role state is authoritative for application access.
- Admin/gym privileges are revalidated server-side.
- High-risk authentication flows use throttling, bounded OTP attempts, short expiry windows and secure cryptographic comparison.
- Browser/mobile cached user information is never authoritative for privilege decisions.

## Security baseline

- Explicit production CORS allowlist.
- Request IDs and server-side audit trails for privileged operations.
- Security headers and HSTS.
- Bounded JSON/upload request sizes.
- Rate limiting at the API edge plus auth-specific persistent rate protection.
- No environment/secret files committed.
- Weekly dependency monitoring and production dependency audits.
- CodeQL scanning on pull requests, main and schedule.
- All secrets stored in Render/Supabase/provider secret stores, not source control.

## Backend environment variables

Set sensitive values in Render, not Git:

```txt
NODE_ENV=production
PORT=8080
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=
AUTH_SECURITY_SECRET=
OTP_HASH_SECRET=
ADMIN_SESSION_SECRET=
PASSWORD_RESET_URL=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=SE7EN FIT
OTP_TTL_MINUTES=10
GEMINI_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PLAY_STORE_URL=
APP_STORE_URL=
```

Public frontend configuration may include only values intentionally exposed to browsers, for example:

```txt
VITE_API_BASE_URL=https://se7en-fit-api.onrender.com/api
VITE_API_TIMEOUT_MS=15000
VITE_GOOGLE_CLIENT_ID=
VITE_RAZORPAY_KEY_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Anything prefixed `VITE_` must be treated as public.

## Canonical migration workflow

1. Create schema changes under `server/supabase/migrations/` only.
2. Review migration SQL and RLS/privilege effects in pull request.
3. Apply to a staging Supabase project first.
4. Run API/web/mobile integration tests against staging.
5. Apply the exact reviewed migrations to production.
6. Record deployment/rollback notes.

The separate migration history inside the website repository is legacy/transitional and must not be used for new production schema changes.

## Launch gates

A release is not considered production-ready until all applicable gates are green:

1. Frontend typecheck/lint/build.
2. API syntax/tests and high-severity dependency audit.
3. CodeQL/security review.
4. Android APK/AAB native compile.
5. Auth register/login/OTP/password reset/session expiry tests.
6. Role-isolation tests for user, gym owner/staff, admin and super-admin.
7. Gym-owner member/attendance/payment/plan/staff workflows.
8. Super-admin request/gym/user/payment/audit workflows through the final shared API path.
9. Tracking tests on physical Android devices, including permissions, GPS loss, app pause/resume and step-counter behavior.
10. Secret rotation review for any historical credential exposure.
11. Backup/restore and migration rollback rehearsal.
12. Observability/alerting verified against production or production-like staging.

Do not label the platform fully production-ready simply because it builds. Production readiness requires the infrastructure, database, provider credentials, device behavior and authorization boundaries above to be verified end-to-end.
