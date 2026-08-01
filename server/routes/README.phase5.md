# Phase 5 route ownership

`memberProductPhase5Preload.js` owns the canonical member AI, food scan, nutrition, workout-plan and aggregated overview routes.

The legacy `/api/ai/trainer` and `/api/ai/food-scan` paths remain for compatibility only. New clients must use `/api/member/*` so subscription entitlements, atomic quotas, idempotency, structured outputs and canonical persistence are enforced consistently.
