# PROZEN Requirements Specification

Version: 1.0  
Source: PRD v1.3 (March 2026, Select KK)  
Document language: English

## 1. Purpose

This document defines implementation-ready product requirements for **PROZEN**, an AI-native Product Management OS designed for non-engineer solopreneurs.  
The system enables users to continuously convert product signals into better product bets, without relying on static PRD workflows.

## 2. Product Goals

1. Let PMs focus on **decision quality** instead of document maintenance.
2. Replace static requirements with a **living, versioned product brain**.
3. Close the loop between hypothesis, execution, metric signals, and next action.
4. Deliver first meaningful value (first Bet Spec draft) in under 5 minutes.

## 3. Target User and Scope

### 3.1 In-Scope User (Phase 1)

- Solo product owner with final decision authority
- No engineering background required
- Uses outsourced development and/or AI coding tools
- High willingness to pay for reduced decision friction

### 3.2 Out of Scope (Phase 1)

- Enterprise PM workflows with approval chains
- Team collaboration-first UX
- External tool dependency as a mandatory prerequisite

## 4. Functional Requirements

## 4.1 Module A: Context Layer

### FR-CL-001 Context Pack Creation
- The system shall accept natural language product context input.
- The system shall transform input into structured context entities.

### FR-CL-002 Persistent Long-Term Context
- The system shall store persistent context for each product workspace.
- The system shall support strict context isolation between products by default.

### FR-CL-003 Decision Log
- The system shall record decisions, rationale, alternatives considered, and evidence links.
- The system shall timestamp and attribute each decision action.

### FR-CL-004 Versioning and Restore
- The system shall maintain version history for Context Pack changes.
- The user shall be able to restore any previous saved context version.

### FR-CL-005 Context Compression
- The system shall summarize historical context for token/cost optimization.
- The system shall preserve retrieval quality for active decisions.
- Compression architecture shall support provider abstraction (internal and external providers).
- External provider usage shall remain optional and reversible via configuration.
- When external compression fails or times out, the system shall fall back to an internal deterministic compressor.
- Compression output shall preserve protected entities and IDs required for downstream retrieval and linking.

## 4.2 Module B: Spec Agent

### FR-SA-001 Conversation-as-Spec
- The system shall convert user conversations into structured spec artifacts.
- The conversion must preserve intent, constraints, and acceptance criteria.

### FR-SA-002 Bet Spec Format
- The system shall generate and update specs in a Bet Spec schema including:
  - Hypothesis
  - Expected impact and metric target
  - Scope and constraints
  - Acceptance criteria
  - Risks and assumptions

### FR-SA-003 Acceptance-First Workflow
- The system shall guide users to define acceptance criteria before implementation detail where feasible.

### FR-SA-004 Edge Case Assistance
- The system shall proactively propose overlooked edge cases and ambiguity warnings.

### FR-SA-005 Living Spec via GitHub
- The system shall detect commit/PR diffs from GitHub integration.
- The system shall suggest spec updates when implementation diverges from current spec.

### FR-SA-006 Spec Version Control
- The system shall version all spec revisions and allow rollback to prior versions.

## 4.3 Module C: Signal -> Decision Loop

### FR-SDL-001 Three-Layer Metric Model
- The system shall represent performance in three linked layers:
  - Bet (hypothesis-level)
  - KPI (product-level)
  - Activity (behavior-level)

### FR-SDL-002 Activity Ingestion
- The system shall ingest daily (or near real-time) activity metrics such as DAU, PV, session length, funnel conversion, error rate, and drop-off points.

### FR-SDL-003 Anomaly Detection
- The system shall detect significant layer-3 anomalies.
- The system shall estimate potential impact on layer-2 KPIs.

### FR-SDL-004 Hypothesis Reconciliation
- The system shall compare observed outcomes against original bet assumptions.
- The system shall present deviations and likely explanatory factors.

### FR-SDL-005 Next-Bet Suggestion
- The system shall propose next actions based on signal changes and historical decision context.

### FR-SDL-006 Reflection Loop
- The system shall provide:
  - Morning summary (previous day + today’s focus)
  - Evening review (decision recap + unresolved questions)
  - Weekly retrospectives on bet accuracy

## 4.4 AI Behavior Rules

### FR-AI-001 Clarification Gating
- The system shall ask clarifying questions only when confidence is below threshold due to:
  - Conflicting assumptions
  - Undefined priorities
  - Ambiguous scope

### FR-AI-002 Confirmation UX
- Clarifications shall be presented in <=3 options plus free-text override.

### FR-AI-003 Progress-First Mode
- The system shall provide a “proceed without confirmation” mode.

### FR-AI-004 Default Operation
- The system shall propose a best-effort solution first, then request confirmation only for high-risk uncertainties.

### FR-AI-005 Autonomous Action Schedule
The system shall execute the following autonomous routines without user initiation:

| Trigger | Action |
|---|---|
| Every morning | Deliver previous day summary and surface today's active bets |
| Every evening | Deliver decision log recap and list unresolved questions for the next day |
| Weekly | Generate a "bet accuracy" retrospective covering all bets closed in the period |
| Pre-release | Present a Bet Spec completeness checklist for the upcoming release |
| Post-release | Detect metric changes and notify the user of hypothesis deviation |
| Activity anomaly | On Layer 3 anomaly, estimate Layer 2 KPI impact and link to relevant Layer 1 bets |
| GitHub commit/PR | Detect diff and propose Living Spec updates for affected spec sections |

## 5. UX and Design Requirements

### FR-UX-001 Application Form
- The product shall use application-style UX, not editor-first UX.

### FR-UX-002 Mobile Support
- The web app shall be fully usable on iOS/Android browsers.
- Core user journeys must be tap-complete.

### FR-UX-005 WOW Onboarding Design
- The onboarding experience shall deliver a first usable Bet Spec draft within 5 minutes of first launch (p75).
- The first-session trigger shall be a demo — video or interactive walkthrough — of a real product with observable traction (revenue growth, retention improvement, learning loop in action).
- Document generation alone does not constitute a WOW moment.
- The onboarding shall guide the user to connect their own product context before the session ends.

### FR-UX-003 Always-On Behavior
- The platform shall support autonomous background routines (daily/weekly jobs and notifications).

### FR-UX-004 Design System Baselines
- Spacing scale: multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64, 96 px)
- Font (Latin): DM Sans
- Font (Japanese): Noto Sans JP
- Brand color: `#1738BD`

## 6. Integration Requirements

### FR-INT-001 GitHub (Phase 1 Required)
- The system shall support GitHub auth and repository connection.
- The system shall ingest commit/PR metadata for Living Spec updates.

### FR-INT-002 Future Integrations (Phase 3+)
- External integrations (Figma, Linear, Mixpanel, export channels) must be optional and non-blocking for core value.

## 7. Non-Functional Requirements

### NFR-001 Availability
- Target: 24/365 service operation.

### NFR-002 Scalability
- Architecture shall scale to tens of thousands of solo users without major redesign.

### NFR-003 Modularity
- Services shall remain loosely coupled to allow model upgrades and module evolution.

### NFR-004 Model Evolution Compatibility
- Prompt/agent architecture shall be versioned for backward-compatible behavior changes where possible.

### NFR-005 Cost Transparency
- The system shall expose AI/API usage and cost dashboards per user.
- The system shall provide configurable spending limits.
- Compression provider usage, savings estimate, and fallback rate shall be observable per workspace.

### NFR-006 Data Portability
- Users shall be able to export Context Pack, specs, and decision logs.

### NFR-007 Auditability
- System actions shall be logged for future enterprise-readiness.

## 8. Anti-Patterns (Must Not Implement)

1. Editor-first interface as the default product shape
2. Excessive AI clarification loops
3. Static document generation as end-goal
4. Metrics presentation disconnected from hypotheses
5. Mandatory phase-1 dependency on external integrations
6. Team-first workflow in phase 1

## 9. Acceptance Criteria for Phase 1 Release

1. A new user can create first Bet Spec draft within 5 minutes.
2. Context Pack, Spec, and Decision Logs are versioned and restorable.
3. GitHub diff ingestion generates at least one actionable Living Spec update suggestion.
4. Daily summary and retrospective flows run successfully for active projects.
5. Activity anomaly is mapped to KPI and linked to at least one relevant Bet.
6. Mobile browser completion of primary flows is validated.
