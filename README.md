# PROZEN

> **Agentic PM OS** — The environment where PMs can focus on making bets.

**Etymology**: Profit × Kaizen

PROZEN removes the burden of writing specs from product managers — the same way Cursor removed the burden of writing code from engineers. What remains is the only thing that matters: deciding what to bet on.

## Positioning

| | |
|---|---|
| **Category** | AI-native Product Management Operating System |
| **Tagline** | The environment where PMs focus on bets, not documents |
| **Core analogy** | Cursor is for engineers. PROZEN is for PMs. |
| **Core user** | Non-engineer solopreneur (owner · PM · decision maker) |
| **Price (Solo Tier)** | `$99/month` |
| **Key differentiator** | No engineering background required. AI-native. All-in-one. |

## Product Thesis

```
Engineer:  What to code  →  Cursor solves this
PM:        What to build →  PROZEN solves this
```

Static PRDs go stale the moment they're written. Jira tracks task completion but accumulates no learning. Dashboards show numbers but never speak to your hypotheses. PROZEN closes that gap with one continuous decision loop.

## Core Modules (Phase 1)

### Module A — Context Layer
Long-term product memory. The equivalent of `@codebase` for product decisions.

- **Context Pack**: Natural language input → AI-structured product context
- **Decision Log**: Records decisions, rationale, and discarded alternatives
- **Versioning**: Full history of context changes with point-in-time restore
- **Context Compression**: Efficiently summarizes historical context to optimize AI inference cost while maintaining retrieval quality

### Module B — Spec Agent
A thinking partner that accelerates PM reasoning — not a document generator.

- **Conversation-as-Spec**: Chat logs become structured spec artifacts
- **Bet Spec Format**: AI-native format centered on intent + constraints + acceptance criteria
- **Acceptance-First Workflow**: Define “done” before defining implementation
- **Edge Case Assistance**: AI proactively surfaces overlooked boundary conditions
- **Living Spec**: GitHub-connected; detects commit/PR diffs and proposes spec updates
- **Spec Versioning**: Full revision history with rollback

### Module C — Signal → Decision Loop
From “looking at dashboards” to “dashboards that speak to your hypotheses.”

#### The Bet Structure
```
Hypothesis:  “Shortening onboarding will improve 7-day retention”
Bet:         2 weeks of effort, targeting +5% KPI improvement
Outcome:     +2.3% — the driver was Y, not X
Learning:    Informs the next bet
```

#### 3-Layer Metric Model

| Layer | Scope | Examples | Cadence |
|---|---|---|---|
| **Bet** | Hypothesis-level | Onboarding → 7-day retention +5% | Sprint to quarter |
| **KPI** | Product-level health | MRR, churn rate, NPS, retention | Weekly / monthly |
| **Activity** | User behavior detail | DAU, PV, session length, funnel steps, error rate | Daily / real-time |

Activity anomalies automatically trigger KPI impact estimation, which triggers hypothesis reconciliation against active Bets.

#### AI Autonomous Actions

| Trigger | Action |
|---|---|
| Every morning | Previous day summary + today's bet focus |
| Every evening | Decision log review + unresolved questions for tomorrow |
| Weekly | Auto-generated “bet accuracy” retrospective |
| Pre-release | Bet Spec completeness checklist |
| Post-release | Metric change detection → hypothesis diff notification |
| Activity anomaly | Layer 3 spike/drop → Layer 1 hypothesis impact alert |
| GitHub commit/PR | Diff detection → Living Spec update proposal |

## What “WOW” Means

> Within 5 minutes of first launch, the user has a first draft of a usable Bet Spec for their own product.

The onboarding trigger is **not** document generation. It is a demo — video or interactive walkthrough — of a real product with actual traction: revenue growing, retention improving, learning compounding. That experience is what converts.

## Design System

| Element | Spec |
|---|---|
| Spacing scale | Multiples of 4: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px |
| Font (Latin) | DM Sans |
| Font (Japanese) | Noto Sans JP |
| Brand color | `#1738BD` |
| UI form | Application UI — not editor UI |
| Mobile | Full functionality on iOS/Android browser |

## Repository Docs

| Document | Path |
|---|---|
| Requirements Specification | `docs/requirements-spec.md` |
| Development Plan | `docs/development-plan.md` |
| M0-M1 Technical Design | `docs/technical-design-m0-m1.md` |
| Compression Provider Plan | `docs/compression-provider-token-company.md` |
| Bet Spec JSON Schema | `schemas/bet-spec.schema.json` |
| Bet Spec TypeScript Model | `src/domain/bet-spec.ts` |

## Roadmap

| Phase | Scope | Gate |
|---|---|---|
| **Phase 1 — Web** | Core 3 modules for solo users. GitHub integration. | — |
| **Phase 2 — Native** | iOS/Android native. Offline support. Richer push notifications. Claude Code / IDE integration (optional). | Traction validated by DAU and retention |
| **Phase 3 — Integrations** | External tools (Figma, Linear, Mixpanel). Export flows. | Individual user base established |
| **Phase 4 — Team/Enterprise** | Team PM features. SSO, audit logs, SOC2. | Enterprise inbound demand |

## Anti-Patterns

| Prohibited | Reason |
|---|---|
| Editor-first UI | Drives away non-engineer users |
| Excessive AI clarification | The primary source of friction — use confidence-score gating |
| Static document generation as the goal | Recreates the limitations of PRDs |
| Metrics disconnected from hypotheses | Becomes an inferior version of a dashboard tool |
| External integrations in Phase 1 | Dilutes the all-in-one experience |
| Team features in Phase 1 | Individual UX optimization must come first |

## Status

Active planning phase — PRD v1.3 (March 2026) · Select KK

## Local Setup (Implementation Workspace)

### Prerequisites

- Node.js `>= 20`
- npm `>= 10`
- PostgreSQL `>= 14` (required for M1 APIs)

### Install

```bash
npm install
```

### Configure Environment

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/prozen
```

Optional variables:

```bash
# API auth for /api/* endpoints (if unset, local auth is skipped)
export PROZEN_API_KEY=your-local-api-key

# Claude structuring key (if unset, ingest uses deterministic fallback parser)
export ANTHROPIC_API_KEY=your-anthropic-api-key

# Compression provider (planned for FR-CL-005 rollout; optional)
export TOKEN_COMPANY_API_KEY=your-ttc-api-key
export TOKEN_COMPANY_MODEL=bear-1.2
export TOKEN_COMPANY_AGGRESSIVENESS=0.15
export TOKEN_COMPANY_TIMEOUT_MS=2500
export TOKEN_COMPANY_ENABLED=false
```

### Apply Migrations

```bash
npm run migrate
```

### Run Local Runtime

```bash
npm run dev
```

Local endpoints:

- `GET /healthz` -> service health
- `GET /schema/bet-spec` -> canonical Bet Spec schema

Default URL: `http://127.0.0.1:8787`

### Validate Bet Spec Against Schema

Validate default example:

```bash
npm run validate:bet-spec
```

Validate a custom file:

```bash
npm run validate:bet-spec -- path/to/your-bet-spec.json
```

### Validate Context Pack Against Schema

Validate default example:

```bash
npm run validate:context-pack
```

Validate a custom file:

```bash
npm run validate:context-pack -- path/to/your-context-pack.json
```

### Context Layer Prototype API (M1)

Base path:

`/api/v1/workspaces/:workspaceId/products/:productId`

Endpoints:

- `POST /context-pack/ingest`
- `GET /context-pack`
- `GET /context-pack/versions`
- `POST /context-pack/restore`
- `POST /decision-logs`
- `GET /decision-logs`
- `GET /decision-logs/:decisionLogId`
- `GET /api/v1/workspaces/:workspaceId/audit-events?productId=...&limit=...&offset=...`

Example ingest request:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workspaces/ws_select_001/products/prozen_web/context-pack/ingest \
  -H 'content-type: application/json' \
  -d '{"input":"PROZEN helps solo PMs focus on bets.\nMain KPI is day-7 retention.\nConstraint: no editor-first UI.","tags":["onboarding","retention"]}'
```

Idempotency for `POST` endpoints:

- Set `Idempotency-Key: <unique_key>`
- Repeated requests with the same key and same payload return replayed response
- Same key with different payload returns `409 IDEMPOTENCY_CONFLICT`

### Context Compression Provider (Planned)

For `FR-CL-005` (Context Compression), PROZEN is adopting **The Token Company** as an optional external compression provider behind a feature flag.  
Implementation details and rollout policy are documented in:

- `docs/compression-provider-token-company.md`

### Type Check and Build

```bash
npm run typecheck
npm run build
```
