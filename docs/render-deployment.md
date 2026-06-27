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
```

Set `FRONTEND_ORIGIN` to the real frontend Render URL after the frontend service is created.

## Supabase setup

Run this SQL before starting the backend:

```txt
server/supabase/migrations/001_initial_schema.sql
```
