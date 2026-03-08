# PROZEN Collaboration Guardrails (Codex + Claude Code)

Version: 1.0  
Date: 2026-03-08

## 1. Goal

Prevent duplicated work, merge conflicts, and architectural drift while multiple coding agents implement in parallel.

## 2. Contract-First Rule

Before implementation, align on contracts in these files:

1. Bet Spec schema: `schemas/bet-spec.schema.json`
2. Context Pack schema: `schemas/context-pack.schema.json`
3. Domain types: `src/domain/*.ts`
4. DB structure: `db/migrations/*.sql`

No implementation should silently diverge from these contracts.

## 3. File Ownership Boundaries

Use additive ownership to minimize overlap:

1. **Codex lane (current)**
   - `schemas/*`
   - `src/domain/*`
   - `db/migrations/*`
   - architecture/design docs under `docs/*`

2. **Claude Code lane (recommended)**
   - app feature implementation (API handlers, UI, service wiring)
   - tests around runtime behavior
   - integration glue based on stable contracts

If both lanes need the same file, do schema/type updates first and app wiring second.

## 4. Safe Change Sequence

1. Update schema/type/migration contract first.
2. Announce contract change in PR description and commit message.
3. Implement runtime logic against new contract.
4. Run schema validation and typecheck.

## 5. Versioning Policy

1. Breaking changes in schema require `schemaVersion` bump.
2. Non-breaking additions keep major/minor stable.
3. Never repurpose an existing enum value with changed semantics.

## 6. Migration Policy

1. Do not edit historical migration files after sharing.
2. Add new migration numbers for every change.
3. Keep migration SQL backward-safe and additive where possible.

## 7. PR and Merge Policy

1. Small PRs with one responsibility:
   - contract PR
   - implementation PR
   - test PR
2. Rebase frequently on `main` to reduce long-lived drift.
3. Resolve conflicts by prioritizing contract file truth over implementation assumptions.

## 8. Conflict Escalation Checklist

When Codex and Claude touch the same concern:

1. Verify latest schema and migration files.
2. Decide canonical representation in one place only.
3. Regenerate or refactor dependent implementation.
4. Add a brief note to docs if semantics changed.

