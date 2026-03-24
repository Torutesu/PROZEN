# Database Migrations (M0-M15)

This folder contains additive SQL migrations for the full delivered milestone range.

- `0001_m0_foundation.sql`
  - tenancy base: `workspaces`, `products`
  - request safety: `api_idempotency_keys`
  - auditability: `audit_events`
- `0002_m1_context_layer.sql`
  - context layer: `context_packs`, `context_pack_versions`
  - decisions: `decision_logs`
  - compression async tracking: `compression_jobs`
- `0003_m1_context_pack_uniqueness.sql`
  - context pack uniqueness hardening
- `0004_m2_spec_agent.sql`
  - bet specs, spec versions, and conversation state
- `0005_m3_metrics.sql`
  - metrics, readings, anomalies
- `0006_m4_github.sql`
  - github connections and sync events
- `0007_m4_github_hardening.sql`
  - webhook hardening and sync resilience
- `0008_m8_bet_completion.sql`
  - bet completion outcomes
- `0009_m10_daily_briefing.sql`
  - daily briefing persistence
- `0010_m11_github_queue_retries.sql`
  - queue retry / backoff support
- `0011_m12_bet_next_hypothesis.sql`
  - next-bet hypothesis storage
- `0012_m13_sync_event_proposal_status.sql`
  - proposal status tracking (accept/dismiss)
- `0013_m14_product_reviews.sql`
  - evening review and weekly retro records
- `0014_m15_integrations.sql`
  - external integration connections and sync state

Migration order is filename order and must remain immutable once shared.

## Merge Safety Notes

To reduce conflicts with parallel implementation streams:

1. Keep migration files immutable once shared.
2. Add new migration numbers rather than editing previous files.
3. Never reorder migration filenames.
4. Treat these SQL files as source-of-truth contracts for storage shape.
