# Phase 5 — Member product reliability

## Canonical APIs

- `GET /api/member/overview`
- `GET /api/member/nutrition/summary`
- `POST /api/member/nutrition/logs`
- `DELETE /api/member/nutrition/logs/:logId`
- `GET /api/member/ai/history`
- `POST /api/member/ai/coach`
- `DELETE /api/member/ai/history`
- `PATCH /api/member/ai/messages/:messageId`
- `DELETE /api/member/ai/messages/:messageId`
- `POST /api/member/food-scan/analyze`
- `POST /api/member/food-scan/:scanId/confirm`
- `GET /api/member/workout-plan`
- `POST /api/member/workout-plan/generate`
- `POST /api/member/workout-plan/:planId/complete`

## Reliability rules

- The backend resolves the active subscription and feature entitlement.
- Usage is reserved atomically before an AI provider call and finalized after success or failure.
- Request IDs provide idempotency for AI messages, food scans, manual meals and workout completion.
- The client never creates paid entitlements, AI usage credits or server-verified activity.
- Food images are limited to JPEG, PNG or WebP under 8 MB. The raw image is not stored by this workflow.
- Food estimates must be reviewed and can be corrected before one atomic diary confirmation.
- Only one personalized workout plan is active for a member; replacing it archives the previous plan.
- Workout-day completion creates one canonical plan session and one linked workout log.
- Daily step summaries avoid adding cumulative health snapshots to the same live-tracking activity twice.
- Nutrition targets use profile inputs when complete and return a clearly marked safe default otherwise.

## Required Render configuration

```env
MEMBER_AI_ENABLED=true
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.6-flash
```

The Gemini key is backend-only and must never be exposed through a `VITE_` variable.
