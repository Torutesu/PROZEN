# Database Migrations (M0-M1)

This folder contains additive SQL migration skeletons for the first two milestones.

- `0001_m0_foundation.sql`
  - tenancy base: `workspaces`, `products`
  - request safety: `api_idempotency_keys`
  - auditability: `audit_events`

- `0002_m1_context_layer.sql`
  - context layer: `context_packs`, `context_pack_versions`
  - decisions: `decision_logs`
  - compression async tracking: `compression_jobs`

## Merge Safety Notes

To reduce conflicts with parallel implementation streams:

1. Keep migration files immutable once shared.
2. Add new migration numbers rather than editing previous files.
3. Never reorder migration filenames.
4. Treat these SQL files as source-of-truth contracts for storage shape.

