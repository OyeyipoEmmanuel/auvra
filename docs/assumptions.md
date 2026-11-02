# Engineering assumptions

- PostgreSQL 17 is the local source of truth.
- Redis 7.4 and BullMQ will provide at-least-once task delivery; all side effects must be idempotent.
- MinIO is used only for local private object storage.
- Google is the sole MVP identity provider; the provider account ID is the stable external identity.
- Monetary values use integer minor units plus an explicit asset and decimal definition.
- Raw customer briefs are immutable input records. Normalized manager interpretation is stored separately.
- Provider descriptions and artifacts are untrusted data and cannot alter system policy.
- No balance, revenue, margin, supplier status, payment state, or receipt confirmation is displayed without supporting persisted evidence.
