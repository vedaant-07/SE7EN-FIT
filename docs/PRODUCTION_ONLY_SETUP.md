# SE7EN FIT Production-Only Setup

SE7EN FIT will be built as a production system, not a demo system.

## Rule

The final setup must use:

- Render backend API
- Supabase PostgreSQL typed tables
- Supabase Storage permanent URLs
- Role-based access control
- Shared data between app, gym owner website, and admin dashboard

The final setup must not use:

- local-only data
- demo-only data
- placeholder APIs
- separate databases for app and website
- disconnected admin workflows

## Current production foundation

Production migration:

```text
server/supabase/migrations/002_production_schema.sql
```

Production API contract:

```text
docs/API_CONTRACT.md
```

Production audit:

```text
docs/PRODUCTION_AUDIT.md
```

## Next backend work

Build typed backend route modules for:

```text
auth
profiles
gyms
gym owners
memberships
leads
attendance
tracking
workouts
nutrition
ads
media uploads
community
challenges
leaderboard
rewards
support
notifications
admin
```

## App UI rule

The app UI must not be changed unless approved first. App work should connect existing screens to typed production APIs.
