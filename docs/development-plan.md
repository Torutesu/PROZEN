# PROZEN Development Plan

Version: 1.0  
Planning horizon: Phase 1 (Web) build and launch readiness  
Reference date: March 2026

## 1. Planning Assumptions

1. Initial target is solo users only.
2. GitHub integration is mandatory in Phase 1.
3. External tools (Figma/Linear/Mixpanel/etc.) are not required for launch.
4. Product success depends on rapid loop quality, not document output quantity.
5. Phase gate for each phase must be validated before the next phase begins (see Roadmap section).

## 1.1 Phase Gate Conditions

| Phase | Gate Condition |
|---|---|
| Phase 1 → Phase 2 | — (Phase 1 is the starting point) |
| Phase 2 → Phase 3 | Traction validated: DAU trend and retention rate meet internal targets |
| Phase 3 → Phase 4 | Individual user base established; enterprise inbound demand present |
| Phase 4 scope | Team PM features, SSO, audit logs, SOC2 |

## 2. Delivery Strategy

### 2.1 Milestone Sequence

1. **M0 — Product Foundation**
2. **M1 — Context Layer MVP**
3. **M2 — Spec Agent MVP**
4. **M3 — Signal -> Decision Loop MVP**
5. **M4 — Integrated Beta**
6. **M5 — Launch Readiness**

### 2.2 Suggested Timeline (22 Weeks)

| Weeks | Milestone | Primary Deliverables |
|---|---|---|
| 1-2 | M0 | Architecture decisions, domain model, service contracts, analytics baseline |
| 3-5 | M1 | Context Pack ingestion, decision logs, versioning and restore |
| 6-8 | M2 | Conversation-as-Spec pipeline, Bet Spec schema, spec version history |
| 9-11 | M3 | Metric layer model, anomaly detection baseline, reconciliation engine, production compression rollout |
| 12-13 | M4 | GitHub diff integration, cross-module workflows, daily/weekly automation |
| 14-16 | M5 | Hardening, mobile UX validation, observability, launch checklist |
| 17-18 | M6 | **Gap closure — Backend**: Briefing generation (Claude call), scheduled job infrastructure, learning synthesis loop, anomaly-to-bet linkage API |
| 19-20 | M7 | **Gap closure — Frontend**: Context Pack, Metrics, GitHub, Decision Logs pages; product overview dashboard; briefing surface |
| 21-22 | M8 | **Gap closure — QA**: Frontend component tests, E2E tests, mobile regression, launch readiness re-check |

## 3. Workstreams

## 3.1 Product and UX

- Define first-session onboarding path (5-minute WOW target). ✅ Complete
- Design app-style mobile-first flows (not editor-like). ✅ Complete (Bets page)
- Build Bet Board and decision timeline views. ✅ Complete
- Implement notification surfaces for morning/evening/weekly loops. ✅ Complete
- **[GAP-006]** Context Pack page: natural language input, structured preview, version history, restore UI. ✅ Complete
- **[GAP-007]** Metrics dashboard: 3-layer view, anomaly highlights, anomaly-to-bet links. ✅ Complete
- **[GAP-008]** GitHub page: connection, sync events, Living Spec proposal actions. ✅ Complete
- **[GAP-009]** Decision Logs page: create form and chronological list. ✅ Complete
- **[GAP-010]** Product Overview page: summary cards + briefing/review surfaces. ✅ Complete
- **[GAP-011]** In-app briefing surface on first daily load. ✅ Complete
- **[GAP-012]** Living Spec proposal Accept/Dismiss UI on GitHub page. ✅ Complete

## 3.2 AI and Agent Systems

- Define confidence-scoring policy for clarification gating. ✅ Complete
- Implement Bet Spec generation and structured update prompts. ✅ Complete
- Add edge-case detection heuristics and assumption surfacing. ✅ Complete
- Build context compression and retrieval strategy. ⚠️ Schema exists; execution logic unclear
- **[GAP-001]** `getDailyBriefing()` Claude-grounded generation. ✅ Complete
- **[GAP-003]** Learning synthesis on bet completion + Context Pack ingest. ✅ Complete
- **[GAP-005]** Next-bet recommendation surfaced from completed bets. ✅ Complete

## 3.3 Backend and Data

- Build workspace/project isolation and versioned storage. ✅ Complete
- Implement decision log event schema. ✅ Complete
- Build metric ingestion pipeline for Activity/KPI/Bet layers. ✅ Complete
- Implement anomaly detection and impact propagation. ✅ Complete
- **[GAP-002]** Scheduled job infrastructure (in-process minute tick + retry + guards). ✅ Complete
- **[GAP-004]** `GET /anomalies/:anomalyId/affected-bets` endpoint with linkage rationale. ✅ Complete

## 3.4 Integrations

- Implement GitHub auth + repository connection. ✅ Complete
- Ingest commit/PR diffs and map to affected Bet Spec sections. ✅ Complete
- Add failure-safe sync and retry logic. ✅ Complete
- **[GAP-008]** Surface GitHub sync events and Living Spec proposals in frontend. ✅ Complete

## 3.5 Platform and Reliability

- Centralized observability (logs, metrics, traces). ⚠️ Partial (audit logs exist; traces/dashboards missing)
- Scheduled jobs for daily and weekly autonomous actions. ✅ Complete (in-process scheduler)
- Cost telemetry and user-facing usage limits. ❌ Not started → **[GAP-012 adjacent]**
- Security baseline (authentication, authorization, audit trail). ✅ Complete

## 3.6 Testing (Gap Closure)

- **[GAP-013]** React component tests for core pages. ✅ Complete
- **[GAP-014]** E2E scenarios: onboarding, lifecycle, anomaly resolve, GitHub sync. ✅ Complete

## 4. Milestone Exit Criteria

## M1 Exit
- Context Pack creation and updates are persistent.
- Version restore works across at least 3 revisions.
- Decision logs include rationale and alternatives.

## M2 Exit
- Conversation generates valid Bet Spec entities.
- Acceptance criteria and constraints are represented structurally.
- Spec history and rollback are available.

## M3 Exit
- Metrics are visible in all three layers.
- Layer-3 anomaly triggers layer-2 impact estimate.
- At least one automated next-bet recommendation is generated.
- Context compression provider rollout is validated with:
  - shadow mode quality checks
  - canary release
  - fallback reliability SLOs

## M4 Exit
- GitHub diff generates spec update suggestions.
- Daily and weekly autonomous summaries run in production-like environment.
- End-to-end flow from “new bet” to “post-result learning” is demoable.

## M5 Exit
- Mobile browser usability passes core journey tests.
- Alerting and operational dashboards are active.
- Launch checklist and incident playbook are complete.

## M6 Exit (Backend Gap Closure)
Status: ✅ Met (2026-03-10)
- `getDailyBriefing()` calls Claude and returns a grounded briefing (verified by integration test).
- Scheduled job infrastructure runs morning/evening/weekly jobs in staging; job state is persisted and visible.
- Bet completion triggers learning synthesis: Context Pack is updated, next-bet proposal is returned in API response.
- `GET /anomalies/:anomalyId/affected-bets` returns correct affected bets with linkage rationale.

## M7 Exit (Frontend Gap Closure)
Status: ✅ Met (2026-03-10)
- Context Pack page: input, structured preview, version list, restore — all interactive.
- Metrics dashboard: 3-layer metric view, time-series, anomaly list with affected bet links.
- GitHub page: connection flow, sync events, Living Spec proposals with Accept/Dismiss.
- Decision Logs page: create and list operational.
- Product overview page: briefing card, active bet count, recent anomalies visible.
- No stub pages remain at launch paths.

## M8 Exit (QA Gap Closure)
Status: ✅ Met (2026-03-10)
- Frontend component test coverage >= 80% for core pages.
- E2E test suite covers: onboarding → first bet, bet lifecycle (create → complete → learning → next), anomaly → resolve.
- Mobile browser regression passes on iOS Safari and Android Chrome for all core flows.

## 5. Quality and Testing Plan

1. **Contract Tests** for service boundaries and event schemas
2. **Integration Tests** for GitHub sync and cross-module flows
3. **Scenario Tests** for full bet lifecycle
4. **Mobile Web Regression** on primary iOS/Android browsers
5. **Prompt/Agent Evaluation** for spec quality and false clarification rate

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Over-questioning by AI increases friction | High | Strict confidence thresholds and progress-first defaults |
| Spec drift despite automation | High | Diff-triggered updates + unresolved drift alerts |
| Signal noise causes false decisions | Medium | Multi-layer validation before recommendation |
| API cost growth from long context | Medium | Compression, retrieval controls, user spending caps |
| Mobile UX degradation vs desktop | Medium | Mobile-first design reviews and dedicated regression suite |
| Scheduled job silently fails | High | Persist job state; alert on consecutive failure; surface staleness in UI |
| Briefing quality degrades over time | Medium | Prompt versioning; weekly manual briefing quality review in early launch |
| Learning synthesis diverges from user intent | Medium | User can edit/reject learning summary before it is committed to Context Pack |
| Frontend stubs visible at launch | High | M7 gate: zero stub pages pass E2E before launch sign-off |

## 7. Launch KPIs (Phase 1)

1. Time to first Bet Spec draft <= 5 minutes (p75)
2. Weekly active users creating/updating bets >= target baseline
3. % bets with linked outcomes and learning notes >= target baseline
4. Daily summary open rate and weekly retrospective completion rate
5. Clarification interruption rate below product threshold

## 8. Immediate Next Actions

1. Stabilize quality gates in CI (backend + frontend + e2e).
2. Add scheduled-job observability dashboard and failure alert routing.
3. Close remaining non-gap roadmap items (cost telemetry, trace dashboards).
4. Prepare launch sign-off artifacts (runbook, rollback checklist, release notes).

## 9. Gap Closure Priority Order

The following is the sequenced execution order for closing all identified gaps (GAP-001 to GAP-014).
See [`docs/implementation-plan-gaps.md`](implementation-plan-gaps.md) for per-gap task breakdowns.

**Tier 1 — Launch Blockers (must ship before Phase 1 goes live)**

| Order | Gap ID | Task |
|---|---|---|
| 1 | GAP-001 | Complete briefing generation with Claude API call |
| 2 | GAP-002 | Implement scheduled job infrastructure |
| 3 | GAP-003 | Implement learning synthesis on bet completion |
| 4 | GAP-006 | Build Context Pack frontend page |
| 5 | GAP-007 | Build Metrics dashboard page |
| 6 | GAP-008 | Build GitHub connection + Living Spec proposal page |

**Tier 2 — Required for core loop quality**

| Order | Gap ID | Task |
|---|---|---|
| 7 | GAP-004 | Add anomaly-to-bet impact API |
| 8 | GAP-009 | Build Decision Logs page |
| 9 | GAP-010 | Build Product Overview page |
| 10 | GAP-011 | Surface briefing in product overview |
| 11 | GAP-012 | Living Spec Accept/Dismiss UI |

**Tier 3 — Quality gates**

| Order | Gap ID | Task |
|---|---|---|
| 12 | GAP-005 | Next-bet recommendation engine |
| 13 | GAP-013 | Frontend component tests |
| 14 | GAP-014 | E2E test suite |
