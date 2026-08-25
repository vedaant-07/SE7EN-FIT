# SE7EN FIT Security Policy

SE7EN FIT handles authentication, fitness/activity data, gym operations, payments metadata, and administrative access. Security issues must be reported privately.

## Reporting a vulnerability

Do not open a public GitHub issue containing exploit details, credentials, private user data, or proof-of-concept payloads.

Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when available. Include:

- affected component and route,
- reproduction steps,
- impact,
- whether authentication is required,
- minimal proof of concept with secrets and personal data removed,
- suggested mitigation if known.

## Secrets

Never commit production credentials. Local `.env` files are ignored. Only `.env.example` files with empty/example values belong in source control.

Production secrets must live in the deployment provider's secret/environment store. Rotate any credential that is suspected to have been committed, logged, pasted into an issue, or otherwise exposed.

## Production security baseline

- Supabase service-role credentials are backend-only.
- Frontends use public/publishable values only.
- All privileged gym/admin writes require server-side authorization.
- Production CORS uses an explicit allowlist.
- Auth/admin responses are non-cacheable.
- High-risk public endpoints are rate limited.
- Request payload size is bounded.
- Security headers and HSTS are enabled in production.
- Dependency and CodeQL scans run continuously.
- Database migrations have one canonical production owner: `server/supabase/migrations`.

## Supported branch

Security fixes target `main`. Production deployments should only be made from reviewed commits that pass the production gate.
