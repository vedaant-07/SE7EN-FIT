# Phase 5 production acceptance checklist

- [ ] Apply migration `020_member_product_reliability.sql` to the shared SE7EN-FIT Supabase project.
- [ ] Set backend-only `GEMINI_API_KEY` in Render.
- [ ] Confirm `MEMBER_AI_ENABLED=true` and the configured Gemini model is available.
- [ ] Verify unauthenticated member-product routes return 401 rather than 404.
- [ ] Verify Free, Trial, Basic and Premium entitlement limits with production-style accounts.
- [ ] Send an AI Coach request, refresh the app and confirm one user message and one assistant response persist.
- [ ] Verify urgent-symptom and unsafe weight-loss prompts use the safety response.
- [ ] Scan one JPEG/PNG/WebP meal, correct quantities/macros and confirm one atomic diary save.
- [ ] Generate a personalized workout, replace it and confirm only one plan stays active.
- [ ] Complete one workout day twice with the same request and confirm no duplicate workout log.
- [ ] Compare member overview totals against canonical step, cardio, workout, attendance and nutrition rows.
- [ ] Test loading, empty, retry, offline-cache, quota and plan-locked states on Android.
