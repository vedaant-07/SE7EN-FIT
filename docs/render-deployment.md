# Render deployment

This repository is configured to deploy both the frontend and backend on Render from `render.yaml`.

## Frontend service

Service name: `se7en-fit-web`

- Runtime: Static
- Root Directory: `.`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Rewrite: `/*` to `/index.html`

Frontend env vars:

```env
VITE_API_BASE_URL=https://se7en-fit-api.onrender.com/api
VITE_GOOGLE_CLIENT_ID=
```

Keep `/api` at the end of `VITE_API_BASE_URL`.

## Backend service

Service name: `se7en-fit-api`

- Runtime: Node
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Backend env vars:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=https://se7en-fit-web.onrender.com
GOOGLE_CLIENT_ID=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
MAILJET_FROM_NAME=SE7EN FIT
AUTH_SECURITY_SECRET=
PASSWORD_RESET_URL=https://se7en-fit-web.onrender.com/reset-password
OTP_TTL_MINUTES=10
PASSWORD_RESET_TTL_MINUTES=30
```

`AUTH_SECURITY_SECRET` must be a strong random secret stored only in Render. Do not commit it to GitHub. Mailjet variables are required for login OTP, account verification and password recovery delivery.

Set `FRONTEND_ORIGIN` and `PASSWORD_RESET_URL` to the real frontend Render URL after the frontend service is created.

## Phase 2 deployment verification

After Render deploys the latest `main` commit, verify:

1. `GET /health` returns the production service response.
2. `POST /api/auth/password-reset/request` returns a generic success response.
3. Member and gym-owner OTP delivery works.
4. Refresh-token rotation works after an access token expires.
5. Local logout invalidates the current session and global logout invalidates all sessions.
6. Blocked or deactivated profiles cannot refresh or access protected routes.

## Supabase setup

Apply every migration in `server/supabase/migrations` in numeric order before starting the backend. The Phase 2 authentication release requires migrations `009_auth_security.sql`, `010_auth_session_control.sql` and `011_fix_auth_rate_limit.sql`.