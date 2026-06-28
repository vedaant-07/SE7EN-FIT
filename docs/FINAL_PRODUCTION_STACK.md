# SE7EN FIT Final Production Stack

This is the locked production architecture for SE7EN FIT.

## Services

- App: React Native mobile app.
- Main / gym-owner website: React frontend hosted on Render.
- Super admin website: React/TanStack frontend hosted on Render.
- Backend API: Node.js/Express backend hosted on Render.
- Database: Supabase Postgres.
- Auth/session data: Supabase Auth with backend-issued JWT sessions through the Render API.
- Media/file storage: Supabase Storage.
- Email/OTP/support email: Mailjet through the Render backend only.

## Request flow

```txt
React Native app
Main/gym-owner website on Render
Super admin website on Render
        ↓
Render Node.js API backend
        ↓
Supabase Auth + Supabase Postgres + Supabase Storage
        ↓
Mailjet / AI / payment / notification providers
```

## Rules

1. Frontends must never contain the Supabase service role key.
2. Frontends must never contain Mailjet secrets.
3. All admin, gym-owner, upload, OTP, AI, food-scan, payment, and notification logic goes through the Render backend.
4. Supabase is the single production database for app, website, and admin data.
5. Supabase Storage is the single production file/media storage layer.
6. Render backend remains the controlled API layer for validation, role checks, and provider integrations.
7. Render frontend services only serve static frontend builds.
8. No demo/local JSON data is allowed in production flows.

## Backend environment variables

Set these on the Render backend service:

```txt
NODE_ENV=production
PORT=8080
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=https://your-app-web-domain,https://your-gym-owner-domain,https://your-admin-domain
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=SE7EN FIT
OTP_HASH_SECRET=
OTP_TTL_MINUTES=10
GEMINI_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PLAY_STORE_URL=
APP_STORE_URL=
APK_URL=
```

## Frontend environment variables

Set these on app/main website/gym-owner/admin frontends as needed:

```txt
VITE_API_BASE_URL=https://se7en-fit-api.onrender.com/api
VITE_API_TIMEOUT_MS=15000
VITE_GOOGLE_CLIENT_ID=
VITE_RAZORPAY_KEY_ID=
```

Admin frontend additionally needs Supabase public client values for admin login/session:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Mailjet setup

Mailjet is shared by all products, but only the backend uses it:

- App OTP/login emails.
- Gym-owner website OTP/login emails.
- Admin website auth/support/admin emails.
- Support replies and system notifications.

Use one verified sending email such as `noreply@se7enfit.com` or a verified Mailjet sender until the custom domain is ready.

## Supabase setup

Run migrations in order:

```txt
001_initial_schema.sql
002_production_schema.sql
003_auth_otp_challenges.sql
004_gym_owner_management_extensions.sql
005_fix_existing_enum_values.sql
```

Verify storage buckets:

```txt
profile-avatars
progress-photos
community-media
ad-media
gym-assets
support-attachments
food-scan-images
```

## Render services

- `se7en-fit-api`: Node backend, root directory `server`, start command `npm start`.
- `se7en-fit-web`: static app/main website frontend.
- `se7enfit-gym-owner`: static gym-owner website frontend.
- `se7enfit-admin`: static/admin frontend.

## Launch checklist

1. Apply Supabase migrations.
2. Create/verify Supabase storage buckets.
3. Add Render backend env vars.
4. Add Render frontend env vars.
5. Add Mailjet verified sender/domain.
6. Deploy backend.
7. Deploy app/main website, gym-owner website, and admin website.
8. Create first super admin role in Supabase.
9. Test app register/login/tracking/AI/community/uploads.
10. Test gym owner register/login/onboarding/members/leads/plans/classes/ads.
11. Test admin login/users/gyms/settings/support/content/app/website/payments.
12. Build React Native app and update download links.
