# Phase 5 AI security controls

- Provider credentials are read only by the Render backend.
- Member context is assembled server-side from the authenticated identity.
- Subscription access and quotas are enforced before provider requests.
- Atomic usage reservation prevents concurrent quota bypass.
- Request identifiers make retries idempotent.
- Upload type and size are allowlisted before food-image processing.
- Raw food images are not persisted by this workflow.
- Structured provider output is validated before storage.
- AI Coach includes urgent-symptom, dangerous-content and extreme-diet safeguards.
- Database RPCs are executable by `service_role` only.
- Member-facing RLS policies are read-only for the new canonical records.
