# PROZEN Technical Design (M0-M1)

Version: 1.0  
Scope: Milestone 0 (Product Foundation) and Milestone 1 (Context Layer MVP)  
Date: March 2026

## 1. Objective

This design defines the initial technical implementation for:

- **M0**: Foundation architecture, domain contracts, and platform baseline
- **M1**: Context Layer MVP (context ingestion, decision logs, versioning, restore)

It directly supports the following requirements:

- FR-CL-001, FR-CL-002, FR-CL-003, FR-CL-004, FR-CL-005
- NFR-002, NFR-003, NFR-005, NFR-007

## 2. Architecture Overview

## 2.1 Logical Components

1. **Web App (Client)**
   - Context Pack input UI
   - Decision log timeline UI
   - Version history and restore UI

2. **API Service**
   - Workspace/project isolation
   - Context ingestion endpoint
   - Decision log CRUD endpoints
   - Context version snapshot and restore operations

3. **AI Structuring Service**
   - Converts natural language context into structured entities (synchronous request path in M1)
   - Falls back to deterministic local structuring when AI key/API is unavailable

4. **Data Layer**
   - Relational DB (PostgreSQL) for authoritative metadata + JSONB snapshots
   - Versioned context and decision logs persisted transactionally

5. **Observability Stack**
   - Audit logs
   - Cost telemetry
   - Service metrics and traces

## 2.2 Deployment Shape (Phase 1)

- Single region to minimize complexity
- Stateless API service (dedicated worker introduced in later milestones)
- Synchronous API processing for context ingest and restore in M1
- Database with daily backups and point-in-time recovery enabled

## 3. Domain Model (M0-M1)

## 3.1 Core Entities

1. `workspace`
   - `id`, `name`, `owner_user_id`, `created_at`, `updated_at`

2. `product`
   - `id`, `workspace_id`, `name`, `status`, `created_at`, `updated_at`

3. `context_pack`
   - `id`, `workspace_id`, `product_id`, `current_version_id`, `created_at`, `updated_at`
   - Unique index on (`workspace_id`, `product_id`)

4. `context_pack_version`
   - `id`, `context_pack_id`, `version_number`, `summary`, `structured_payload`, `created_by`, `created_at`

5. `decision_log`
   - `id`, `workspace_id`, `product_id`, `title`, `decision`, `rationale`, `alternatives`, `evidence_links`, `created_by`, `created_at`

6. `compression_job`
   - `id`, `context_pack_id`, `source_version_range`, `status`, `output_payload_ref`, `started_at`, `finished_at`

7. `audit_event`
   - `id`, `workspace_id`, `actor_id`, `event_type`, `resource_type`, `resource_id`, `metadata`, `created_at`

## 3.2 Isolation Rules

- Every read/write path requires `workspace_id` scoping.
- `product_id` is unique only within a workspace boundary.
- Cross-product context reads are denied unless explicit linking rule is enabled (Phase 2+).

## 4. API Design (M0-M1)

## 4.1 Context Pack APIs

1. `POST /api/v1/workspaces/:workspaceId/products/:productId/context-pack/ingest`
   - Input: natural language context text and optional tags
   - Output: accepted job id + provisional version metadata

2. `GET /api/v1/workspaces/:workspaceId/products/:productId/context-pack`
   - Returns current structured context and active version metadata

3. `GET /api/v1/workspaces/:workspaceId/products/:productId/context-pack/versions`
   - Returns version history (paged)

4. `POST /api/v1/workspaces/:workspaceId/products/:productId/context-pack/restore`
   - Input: `version` (positive integer)
   - Output: new version created from restored snapshot

## 4.2 Decision Log APIs

1. `POST /api/v1/workspaces/:workspaceId/products/:productId/decision-logs`
2. `GET /api/v1/workspaces/:workspaceId/products/:productId/decision-logs`
3. `GET /api/v1/workspaces/:workspaceId/products/:productId/decision-logs/:decisionLogId`

## 4.3 API Contract Principles

- Idempotency key is optional but recommended for write endpoints.
- Structured error format: `code`, `message`, `request_id`, `details`.
- Audit event emitted for each mutating operation.

## 5. Context Ingestion Pipeline

1. API receives natural language context payload.
2. Input is structured synchronously via AI service.
3. If AI key/API fails, deterministic fallback parser is used.
4. `context_pack_version` snapshot saved in DB (`structured_payload` JSONB).
5. `context_pack.current_version_id` updated atomically in the same transaction.
6. Audit event is emitted after successful mutation.

Failure handling:
- Schema shape issues are rejected before persistence.
- AI errors degrade to fallback parser in M1 to preserve ingest availability.

## 6. Context Compression Strategy (FR-CL-005)

- Compression runs asynchronously on stale version ranges.
- Source versions are never deleted in M1.
- Compressed snapshots are tagged with source version lineage metadata.
- Retrieval policy:
  - Prefer current full version
  - Fall back to compressed context for older ranges

Forward-compatible provider plan:
- Compression is implemented behind a provider interface.
- Planned provider rollout uses The Token Company API in shadow mode first.
- On provider failure/timeout, fallback uses internal deterministic compression.
- Provider config and rollout details are tracked in `docs/compression-provider-token-company.md`.

## 7. Security and Compliance Baseline

1. AuthN/AuthZ
   - Session-based auth for web app
   - Workspace-role check at API boundary

2. Data Security
   - Encryption in transit (TLS) and at rest
   - Secrets managed via environment-secret manager

3. Auditability
   - Immutable append-only `audit_event`
   - Actor and request correlation IDs on every mutation

## 8. Observability and Cost Visibility

1. Metrics
   - API latency, error rate, ingestion queue depth, restore success rate
2. Logs
   - Structured JSON logs with `workspace_id`, `product_id`, `request_id`
3. Traces
   - End-to-end trace across API -> AI structurer -> DB
4. Cost telemetry
   - Token usage and estimated AI cost per workspace (daily aggregation)

## 9. Test Strategy (M0-M1)

1. Contract tests for API schemas and error shapes
2. Route tests:
   - Query validation for pagination (`limit`, `offset`)
   - List response contract (`total`, `limit`, `offset`, `items`)
3. Integration tests:
   - Ingestion pipeline happy path
   - Restore path (version N -> restore -> version N+1)
   - Workspace isolation constraints
4. Migration tests for schema evolution
5. Load sanity checks for ingestion burst handling

## 10. M0 and M1 Execution Plan

## M0 (Weeks 1-2)

1. Finalize service boundaries and event contracts
2. Provision repo structure, lint/type/test baseline
3. Define canonical schemas:
   - Bet Spec (`schemas/bet-spec.schema.json`)
   - Context Pack payload contracts
4. Implement observability scaffolding and audit event contract

## M1 (Weeks 3-5)

1. Implement context ingestion API and structuring pipeline
2. Implement context version persistence and listing
3. Implement restore endpoint and atomic current-version switch
4. Implement decision log create/read flows
5. Implement first compression job and metadata lineage

## 11. Risks and Technical Mitigations

1. AI structuring inconsistency
   - Mitigation: strict schema validation and fallback parser templates
2. Version restore race conditions
   - Mitigation: transaction + context-pack uniqueness + conflict-safe upsert/read flow
3. Cost spikes in early iterations
   - Mitigation: hard per-workspace daily budget and compression thresholds
4. Hidden coupling between modules
   - Mitigation: contract-first APIs and event schema versioning

## 12. Deliverables from This Design

1. Canonical Bet Spec schema (JSON + TypeScript types)
2. M0-M1 implementation blueprint with API/data/job contracts
3. Local runtime and validation workflow for developer onboarding
