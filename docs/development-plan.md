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

### 2.2 Suggested Timeline (16 Weeks)

| Weeks | Milestone | Primary Deliverables |
|---|---|---|
| 1-2 | M0 | Architecture decisions, domain model, service contracts, analytics baseline |
| 3-5 | M1 | Context Pack ingestion, decision logs, versioning and restore |
| 6-8 | M2 | Conversation-as-Spec pipeline, Bet Spec schema, spec version history |
| 9-11 | M3 | Metric layer model, anomaly detection baseline, reconciliation engine, production compression rollout |
| 12-13 | M4 | GitHub diff integration, cross-module workflows, daily/weekly automation |
| 14-16 | M5 | Hardening, mobile UX validation, observability, launch checklist |

## 3. Workstreams

## 3.1 Product and UX

- Define first-session onboarding path (5-minute WOW target).
- Design app-style mobile-first flows (not editor-like).
- Build Bet Board and decision timeline views.
- Implement notification surfaces for morning/evening/weekly loops.

## 3.2 AI and Agent Systems

- Define confidence-scoring policy for clarification gating.
- Implement Bet Spec generation and structured update prompts.
- Add edge-case detection heuristics and assumption surfacing.
- Build context compression and retrieval strategy.

## 3.3 Backend and Data

- Build workspace/project isolation and versioned storage.
- Implement decision log event schema.
- Build metric ingestion pipeline for Activity/KPI/Bet layers.
- Implement anomaly detection and impact propagation.

## 3.4 Integrations

- Implement GitHub auth + repository connection.
- Ingest commit/PR diffs and map to affected Bet Spec sections.
- Add failure-safe sync and retry logic.

## 3.5 Platform and Reliability

- Centralized observability (logs, metrics, traces).
- Scheduled jobs for daily and weekly autonomous actions.
- Cost telemetry and user-facing usage limits.
- Security baseline (authentication, authorization, audit trail).

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

## 7. Launch KPIs (Phase 1)

1. Time to first Bet Spec draft <= 5 minutes (p75)
2. Weekly active users creating/updating bets >= target baseline
3. % bets with linked outcomes and learning notes >= target baseline
4. Daily summary open rate and weekly retrospective completion rate
5. Clarification interruption rate below product threshold

## 8. Immediate Next Actions

1. Lock Bet Spec canonical schema and event model.
2. Finalize data contracts between Context, Spec, and Signal modules.
3. Build clickable onboarding prototype and validate with target users.
4. Start M1 implementation with versioned context storage and decision logs.
