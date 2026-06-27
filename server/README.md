# SE7EN FIT Backend

This backend is designed for a Render Web Service and a Supabase database. The root of this repository remains the Vite/React web app and Capacitor app shell.

## Render settings

Use these settings when creating the Render Web Service:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## Required Render environment variables

```env
PORT=8080
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

For local development, `FRONTEND_ORIGIN` can be `http://localhost:5173`.

## Frontend environment variable

The frontend must point to the API path, not only the Render domain:

```env
VITE_API_BASE_URL=https://your-render-backend.onrender.com/api
```

## Database

Run `server/supabase/migrations/001_initial_schema.sql` in your Supabase project before starting the backend.

The backend uses Supabase Auth for login/register/OTP/Google and stores app records in `entity_records` for compatibility with the existing Base44-style frontend entities.
