# Phase 5 API status expectations

- Unauthenticated: `401 auth_required`
- Expired session: `401 session_expired`
- Locked entitlement: `403 feature_locked`
- Exhausted quota: `429 quota_exceeded`
- Invalid input or upload: `400 validation_failed`
- Provider safety block: `422 ai_safety_block`
- Provider unavailable: `502 ai_provider_failed`
- Provider timeout: `504 ai_timeout`
