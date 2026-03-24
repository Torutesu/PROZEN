# PROZEN Gap Closure Implementation Plan

Version: 1.1
Date: March 2026
Status: Executed (current branch, updated 2026-03-10)
Reference: `docs/requirements-spec.md` Section 10 (Gap Register), `docs/development-plan.md` Section 9

This document defines task-level implementation plans for each identified gap.
Milestone owners: assign before starting each tier.

## Execution Update (2026-03-10)

- Tier 1 (GAP-001/002/003/006/007/008): Implemented
- Tier 2 (GAP-004/009/010/011/012): Implemented
- Tier 3 (GAP-005/013/014): Implemented
- Validation:
  - Backend tests: `npm run typecheck` and `npm test` passing
  - Frontend component tests: `pnpm test` in `web/` passing
  - E2E specs present in `web/e2e` for onboarding, bet lifecycle, anomaly resolve, GitHub sync

---

## Tier 1 — Launch Blockers

---

### GAP-001 · Complete Briefing Generation (Claude API call)

**File**: `src/services/briefing-store.ts`
**Requirement**: FR-AI-007

**Current state**: `getDailyBriefing()` exists but contains no Claude API call. Returns stub data.

**Tasks**:

1. Load current Context Pack (latest version) for the given `workspace_id` / `product_id`.
2. Load all active bets (status = `active`) with their hypothesis and metric target.
3. Load metric anomalies from the past 24h.
4. Construct a system prompt grounding Claude in the above context.
5. Call `claude-sonnet-4-6` with the prompt; parse the structured response.
6. Persist the generated briefing to `daily_briefings` table.
7. Return the persisted briefing via `GET .../daily-briefing`.

**Prompt contract** (output fields):
- `focus_bets`: list of bet IDs to prioritise today
- `yesterday_summary`: 2–3 sentence summary of the previous day
- `open_questions`: list of unresolved items to address
- `anomaly_highlights`: anomalies that need attention today

**Acceptance criteria**:
- Integration test confirms Claude is called and response is stored.
- Stale briefing (> 28h old) is returned with `is_stale: true` flag.
- If Claude call fails, previous briefing is returned with `is_stale: true`; no 500 surfaced to client.

---

### GAP-002 · Scheduled Job Infrastructure

**Files**: new `src/jobs/scheduler.ts`, `src/jobs/handlers/` directory
**Requirement**: FR-AI-006

**Current state**: No scheduler exists. Daily/weekly autonomous actions are completely absent.

**Tasks**:

1. Choose scheduler approach: lightweight in-process cron (e.g., `node-cron`) for Phase 1; upgrade to BullMQ in Phase 2 if scale demands it.
2. Create `src/jobs/scheduler.ts`: initialises cron schedule, maps triggers to handlers.
3. Implement handlers:
   - `morning-briefing.handler.ts` — calls briefing generation for each active workspace (07:00 local → UTC offset per workspace if available, else UTC)
   - `evening-review.handler.ts` — generates decision log recap + open questions for next day
   - `weekly-retro.handler.ts` — generates bet accuracy retrospective for bets closed in the past 7 days
4. Add `scheduled_jobs` table (or reuse existing job tracking) to persist: `job_type`, `workspace_id`, `product_id`, `status`, `last_run_at`, `next_run_at`, `failure_count`, `last_error`.
5. Implement retry with exponential backoff (max 3 attempts per job instance).
6. Add observability: log job start/end/failure with `workspace_id` and `product_id`.

**Acceptance criteria**:
- Morning briefing job runs in staging and generates a stored briefing for each workspace with active bets.
- Failed jobs are retried up to 3 times; final failure is persisted with `last_error` text.
- Job state is queryable via `GET /api/v1/admin/scheduled-jobs` (internal endpoint, auth-gated).

---

### GAP-003 · Learning Synthesis on Bet Completion

**Files**: `src/services/spec-agent.ts`, `src/services/spec-store.ts`, `src/services/context-layer.ts`
**Requirement**: FR-SDL-007

**Current state**: `POST .../bets/:betId/complete` records outcome but does not synthesize learning or update Context Pack.

**Tasks**:

1. After bet completion is persisted, call a new `synthesizeLearning()` function in `spec-agent.ts`.
2. `synthesizeLearning()` input: bet hypothesis, outcome data, conversation history, original metric target vs actual result.
3. Claude generates a structured learning object:
   - `what_we_learned`: 2–3 sentences
   - `primary_driver`: what actually drove the outcome (was hypothesis correct?)
   - `next_bet_hypothesis`: a proposed hypothesis for the follow-on bet
   - `context_update`: text to append to Context Pack
4. Persist learning to `bet_specs.learning_summary` (column already exists or add via migration).
5. Call `context-layer.ts` ingest with `context_update` text, tagged as `source: "bet_completion"`.
6. Return learning summary + next_bet_hypothesis in the completion API response.

**Acceptance criteria**:
- Completing a bet returns `learning_summary` and `next_bet_hypothesis` in the response body.
- Context Pack version count increments by 1 after completion.
- Next-bet hypothesis is pre-filled if the user opens a new bet form immediately after completion.

---

### GAP-006 · Context Pack Frontend Page

**File**: `web/src/app/workspaces/[workspaceId]/products/[productId]/context-pack/page.tsx`
**Requirement**: FR-UX-006

**Current state**: Renders a stub placeholder.

**Tasks**:

1. **Ingest section**: Textarea for natural language context input + "Update Context" button. Calls `POST .../context-pack/ingest`.
2. **Current context section**: Displays `structured_payload` from the current Context Pack version in a readable key-value or card layout (not a code editor).
3. **Version history section**: Chronological list of versions with `version_number`, `created_at`, `summary`. Each entry has a "Restore" button that calls `POST .../context-pack/restore`.
4. Handle loading, error, and empty states for all three sections.
5. Optimistic UI: after ingest, show a "Processing..." state and poll or invalidate the current context on success.

**Acceptance criteria**:
- User can submit context text and see the structured result without page reload.
- Restoring a version updates the current context display and adds a new version to the history list.
- Page is usable on mobile (tap-complete).

---

### GAP-007 · Metrics Dashboard Page

**File**: `web/src/app/workspaces/[workspaceId]/products/[productId]/metrics/page.tsx`
**Requirement**: FR-UX-008

**Current state**: Renders a stub placeholder.

**Tasks**:

1. **Layer tabs**: Toggle between Bet / KPI / Activity layers.
2. **Metric list**: For each layer, list registered metrics with their latest reading and trend indicator (up/down/flat).
3. **Add metric form**: Name, description, layer selection, unit. Calls `POST .../metrics`.
4. **Ingest reading form**: Select metric, enter value + timestamp. Calls `POST .../metrics/ingest`.
5. **Anomaly list**: Section for current anomalies — shows anomaly description, severity, estimated KPI impact, and list of affected bet links.
6. **Resolve anomaly**: Button to mark anomaly as resolved. Calls `POST .../anomalies/:anomalyId/resolve`.
7. Time-series chart per metric using a lightweight charting library (avoid heavyweight dependencies).

**Acceptance criteria**:
- All three layers are navigable.
- Adding a metric and ingesting a reading appears in the list without full reload.
- Anomaly with affected bets links to the corresponding bet detail.
- Resolving an anomaly removes it from the active list.

---

### GAP-008 · GitHub Connection and Living Spec Proposal Page

**File**: `web/src/app/workspaces/[workspaceId]/products/[productId]/github/page.tsx`
**Requirement**: FR-UX-009, FR-INT-001

**Current state**: Renders a stub placeholder.

**Tasks**:

1. **Connect repository section**: PAT input + repo URL field. Calls `POST .../github-connections`. Displays connected repo with sync status badge.
2. **Sync events log**: Paginated list of `github_sync_events` — timestamp, event type (commit/PR), summary, status.
3. **Living Spec proposals list**: List of pending spec update proposals from GitHub diffs. Each proposal shows: affected spec section, diff summary, proposed change. Actions: Accept (applies change to spec) / Dismiss.
4. **Connection management**: Disconnect button with confirmation.

**Acceptance criteria**:
- A user can connect a GitHub repo and see sync events populate on push.
- Living Spec proposals appear when a commit affects an active bet's implementation scope.
- Accept/Dismiss updates the proposal status and reflects in the list.

---

## Tier 2 — Core Loop Quality

---

### GAP-004 · Anomaly-to-Bet Impact API

**File**: `src/api/metric-routes.ts`, `src/services/metric-store.ts`
**Requirement**: FR-SDL-008

**Tasks**:

1. Add `GET /api/v1/workspaces/:workspaceId/products/:productId/anomalies/:anomalyId/affected-bets`.
2. Implementation logic:
   - Fetch anomaly → get affected KPI metric.
   - Find active bets whose `metric_target` references the same KPI metric ID.
   - Secondary match: semantic similarity between bet hypothesis text and anomaly description (can be rule-based in Phase 1; full embedding search in Phase 2).
3. Response shape: `{ anomaly_id, affected_bets: [{ bet_id, title, hypothesis, linkage_reason }] }`.

**Acceptance criteria**:
- Returns correct bets for a known test anomaly in integration tests.
- Returns empty array (not 404) when no bets are linked.

---

### GAP-009 · Decision Logs Page

**File**: `web/src/app/workspaces/[workspaceId]/products/[productId]/decision-logs/page.tsx`
**Requirement**: FR-UX-007

**Tasks**:

1. **Create form**: Fields — title, decision, rationale, alternatives (multi-line), evidence links (comma-separated). Calls `POST .../decision-logs`.
2. **Log list**: Reverse-chronological list; each entry shows title, decision, rationale, timestamp. Expandable for alternatives and evidence.
3. **Filter**: Date range picker + keyword search (client-side for Phase 1).

**Acceptance criteria**:
- User can create a decision log and see it immediately in the list.
- List displays correctly on mobile.

---

### GAP-010 · Product Overview Page

**File**: `web/src/app/workspaces/[workspaceId]/products/[productId]/page.tsx`
**Requirement**: FR-UX-010

**Tasks**:

1. **Briefing card**: Show latest daily briefing (yesterday summary, open questions, focus bets). Staleness indicator if > 28h old.
2. **Active bets summary**: Count + list of active bet titles with status chips.
3. **Recent anomalies**: Last 3 anomalies with severity and a link to the metrics page.
4. **Recent decision logs**: Last 3 entries.
5. **Quick actions**: "New Bet" button (opens bet create form), "Update Context" button (navigates to context-pack page).

**Acceptance criteria**:
- Overview page loads with real data from all three modules.
- Briefing card shows staleness state correctly.
- Quick actions are reachable in one tap on mobile.

---

### GAP-011 · In-App Briefing Surface

**Files**: `web/src/app/workspaces/[workspaceId]/products/[productId]/page.tsx`, shared notification component
**Requirement**: FR-AI-007

**Tasks**:

1. On product overview load, check if briefing was generated today and not yet read by this session.
2. If unread: show a dismissible banner or modal with the briefing content.
3. On dismiss, mark as read in localStorage (or via a lightweight API flag).
4. Briefing banner is skipped if no briefing exists (no blocking state).

**Acceptance criteria**:
- Briefing banner appears on first daily load and not on subsequent loads the same day.
- Dismissing the banner stores the read state and does not show again until next day.

---

### GAP-012 · Living Spec Accept/Dismiss UI

**Covered by GAP-008** (GitHub page). Tracked separately to ensure backend API for Accept/Dismiss is implemented before frontend.

**Backend task**: Add `PATCH /api/v1/.../github-sync-events/:eventId` with body `{ action: "accept" | "dismiss" }`.
- `accept`: applies the proposed spec change to the affected bet spec version (creates a new spec version).
- `dismiss`: marks event as dismissed; no spec change.

---

## Tier 3 — Quality Gates

---

### GAP-005 · Next-Bet Recommendation Engine

**Files**: `src/services/spec-agent.ts` (extend `synthesizeLearning()`), new `src/services/recommendation-store.ts`

**Tasks**:

1. After learning synthesis (GAP-003), persist `next_bet_hypothesis` as a `recommendation` entity.
2. Add `GET .../products/:productId/recommendations` endpoint returning pending recommendations.
3. Pre-fill the "New Bet" creation form with the recommended hypothesis when navigating from a completed bet.

---

### GAP-013 · Frontend Component Tests

**Target coverage**: ≥ 80% for core pages.

**Priority test files**:
- `bets/page.test.tsx` — conversation flow, completion modal
- `context-pack/page.test.tsx` — ingest form, version restore
- `metrics/page.test.tsx` — layer tabs, anomaly resolve
- `github/page.test.tsx` — connect flow, proposal accept/dismiss
- `onboarding/page.test.tsx` — 4-step wizard state transitions

**Tooling**: Vitest + React Testing Library (already in web stack or add as devDependency).

---

### GAP-014 · E2E Test Suite

**Priority scenarios**:

| Scenario | Steps |
|---|---|
| Onboarding → first bet | Sign up → onboarding → complete → bet created with spec draft |
| Full bet lifecycle | Create bet → converse → complete → learning generated → Context Pack updated |
| Anomaly → resolve | Ingest metric reading → anomaly detected → view affected bets → resolve |
| GitHub sync | Push commit → sync event created → Living Spec proposal appears → Accept |

**Tooling**: Playwright (add as devDependency in web/).

---

## Implementation Checklist

Use this as a launch readiness gate. All P0/P1 items must be checked before Phase 1 goes live.

### P0 — Must ship
- [x] GAP-001: Briefing generation calls Claude
- [x] GAP-002: Scheduled jobs running in staging
- [x] GAP-003: Learning synthesis on bet completion
- [x] GAP-006: Context Pack page interactive
- [x] GAP-007: Metrics dashboard page interactive
- [x] GAP-008: GitHub page interactive

### P1 — Required for core loop
- [x] GAP-004: Anomaly-to-bet impact API
- [x] GAP-009: Decision Logs page interactive
- [x] GAP-010: Product Overview page with real data
- [x] GAP-011: Briefing surface on first daily load
- [x] GAP-012: Living Spec Accept/Dismiss (backend + UI)

### P2 — Quality gate
- [x] GAP-005: Next-bet recommendation engine
- [x] GAP-013: Frontend component tests ≥ 80%
- [x] GAP-014: E2E suite passing for 4 core scenarios
