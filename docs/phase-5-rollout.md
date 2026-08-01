# Phase 5 rollout order

1. Apply migration 020.
2. Configure backend Gemini secret and model.
3. Merge and deploy the Render backend and app bundle.
4. Confirm protected member routes return 401 when unauthenticated.
5. Run authenticated member tests for AI Coach, food scan, workout plan and nutrition.
6. Keep legacy AI paths out of active client navigation.
