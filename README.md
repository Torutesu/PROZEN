<div align="center">

<img src="assets/logo-banner.svg" alt="PROZEN — Agentic PM OS" width="480" />

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-1738BD.svg?style=flat-square)](LICENSE)
[![PRD Version](https://img.shields.io/badge/PRD-v1.3-3B5BDB.svg?style=flat-square)](docs/requirements-spec.md)
[![Status](https://img.shields.io/badge/Status-Active%20Development-10B981.svg?style=flat-square)](#status)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20Sonnet-EF4444.svg?style=flat-square)](https://anthropic.com)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-F59E0B.svg?style=flat-square)](#local-setup)

<br/>

**Cursor is for engineers. PROZEN is for PMs.**

*The environment where product managers stop writing documents and start making bets.*

</div>

---

## The Problem

Most product tools are built around **documents** — PRDs that go stale the moment they're written, Jira boards that measure completions instead of outcomes, dashboards that show numbers but never connect them to your hypotheses.

The result: PMs spend 80% of their time writing, tracking, and reporting — and 20% actually thinking about what to build.

**PROZEN inverts that ratio.**

---

## What PROZEN Does

> Within 5 minutes of first launch, you have a working Bet Spec for your own product — grounded in your actual metrics, with AI that surfaces risks you hadn't considered.

PROZEN is a single, integrated loop:

```
Context  →  Bet  →  Signal  →  Learning  →  Next Bet
```

No switching between Notion, Jira, Mixpanel, and Slack. One environment. One decision loop. Continuously improving.

---

## Core Architecture

<table>
<tr>
<td width="33%" valign="top">

### A · Context Layer
*The product memory*

AI-structured product knowledge base. The equivalent of `@codebase` for product decisions — always available to every Bet, every signal, every recommendation.

- Natural language → structured context
- Full versioning with point-in-time restore
- Context compression for cost efficiency

</td>
<td width="33%" valign="top">

### B · Spec Agent
*The thinking partner*

Not a document generator. A reasoning accelerator. You describe intent; the AI surfaces constraints, edge cases, and acceptance criteria you'd otherwise miss.

- Conversation-as-Spec workflow
- Acceptance-first: define "done" before "how"
- Living Spec: syncs with GitHub commits/PRs

</td>
<td width="33%" valign="top">

### C · Signal Loop
*The decision engine*

Dashboards that speak to your hypotheses. Three-layer metric model connects daily activity signals to KPIs to active Bets — automatically.

- Activity anomalies → KPI impact alerts
- Daily/weekly AI briefings
- Bet accuracy retrospectives

</td>
</tr>
</table>

---

## The Bet Structure

Every product decision in PROZEN follows one format:

```
Hypothesis:  "Shortening onboarding will improve 7-day retention"
Bet:         2 weeks · targeting +5% KPI improvement
Outcome:     +2.3% — the driver was Y, not X
Learning:    Informs the next bet automatically
```

This structure — not tasks, not tickets, not documents — becomes the atom of all product work.

### 3-Layer Metric Model

| Layer | What It Tracks | Cadence |
|---|---|---|
| **Bet** | Hypothesis-level KPI targets | Sprint → Quarter |
| **KPI** | Product health (MRR, churn, NPS) | Weekly / Monthly |
| **Activity** | User behavior signals (DAU, funnel, errors) | Daily / Real-time |

Layer 3 anomalies automatically trigger Layer 2 impact estimation, which triggers Layer 1 hypothesis reconciliation.

---

## AI Autonomous Actions

PROZEN's agent operates continuously — not just when you open the app.

| Trigger | Action |
|---|---|
| Every morning | Previous day summary + today's bet focus |
| Every evening | Decision log review + open questions |
| Weekly | Auto-generated bet accuracy retrospective |
| Pre-release | Bet Spec completeness checklist |
| Post-release | Metric change → hypothesis diff notification |
| Activity anomaly | Layer 3 spike/drop → Layer 1 impact alert |
| GitHub commit/PR | Diff detection → Living Spec update proposal |

---

## Why Now

| Signal | Implication |
|---|---|
| LLM inference cost is dropping 10x/year | Always-on PM agents become economically viable |
| Cursor proved AI-native dev tools | The same shift is coming for product |
| Solo founders scaling without PMs | The ICP exists and is underserved |
| PRD tooling hasn't changed in 10 years | Greenfield opportunity |

---

## Product Positioning

| | |
|---|---|
| **Category** | AI-native Product Management Operating System |
| **Core analogy** | Cursor is for engineers. PROZEN is for PMs. |
| **Target user** | Non-engineer solopreneur — owner, PM, decision maker |
| **Price (Solo Tier)** | `$99/month` |
| **Key differentiator** | No engineering background required. AI-native from day one. |
| **Etymology** | Profit × Kaizen |

---

## Roadmap

| Phase | Scope | Gate |
|---|---|---|
| **Phase 1 — Web** | Core 3 modules for solo users · GitHub integration | — |
| **Phase 2 — Native** | iOS/Android · Offline · Claude Code integration | DAU + retention validated |
| **Phase 3 — Integrations** | Figma, Linear, Mixpanel · Export flows | Individual user base established |
| **Phase 4 — Enterprise** | Team PM features · SSO · Audit logs · SOC2 | Enterprise inbound demand |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| AI | Anthropic Claude Sonnet (claude-sonnet-4-6) |
| State | Zustand |
| Database | PostgreSQL 14+ |
| Runtime | Node.js ≥ 20 |
| Package Manager | pnpm |

---

## Design Principles

- **Application UI, not editor UI** — drives adoption with non-engineers
- **4px spacing grid** — precision without overhead
- **CSS Variables only** — consistent theming at scale
- **Mobile-first** — full functionality on iOS/Android browser

---

## Repository

| Document | Path |
|---|---|
| Requirements Specification | [`docs/requirements-spec.md`](docs/requirements-spec.md) |
| Development Plan | [`docs/development-plan.md`](docs/development-plan.md) |
| M0-M1 Technical Design | [`docs/technical-design-m0-m1.md`](docs/technical-design-m0-m1.md) |
| Bet Spec JSON Schema | [`schemas/bet-spec.schema.json`](schemas/bet-spec.schema.json) |
| Bet Spec TypeScript Model | [`src/domain/bet-spec.ts`](src/domain/bet-spec.ts) |

---

## Local Setup

### Prerequisites

- Node.js `>= 20`
- pnpm `>= 9`
- PostgreSQL `>= 14`

### Install

```bash
pnpm install
```

### Configure Environment

```bash
# Required
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/prozen

# Claude AI (required for spec generation and signal analysis)
export ANTHROPIC_API_KEY=your-anthropic-api-key

# Required for GitHub PAT encryption at rest (M4 Living Spec)
export GITHUB_TOKEN_ENCRYPTION_KEY=replace-with-32-byte-random-string

# API auth for /api/* endpoints (optional locally)
export PROZEN_API_KEY=your-local-api-key
```

### Migrate & Run

```bash
pnpm run migrate
pnpm run dev
```

API base: `http://127.0.0.1:8787`

### Run Web App (Next.js)

```bash
cd web
pnpm install
pnpm dev
```

Web base: `http://127.0.0.1:3000`

| Endpoint | Description |
|---|---|
| `GET /healthz` | Service health |
| `GET /schema/bet-spec` | Canonical Bet Spec schema |
| `POST /api/v1/workspaces/:id/products/:id/context-pack/ingest` | Ingest product context |
| `POST /api/v1/workspaces/:id/products/:id/decision-logs` | Record decision |

### Validate Schemas

```bash
pnpm run validate:bet-spec
pnpm run validate:context-pack
```

---

## Status

**Active development** — PRD v1.3 · March 2026 · Select KK

---

<div align="center">

<img src="assets/logo.svg" width="32" height="32" alt="PROZEN" />

*Built for the PM who bets on outcomes, not the one who ships features.*

</div>
