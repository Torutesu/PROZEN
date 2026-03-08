// PROZEN Bet Spec Readiness Checker
// Pre-release completeness checklist for a bet spec.
// Checks each structural field of the spec and produces a scored readiness report.

import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { betSpecVersions, betSpecs, metrics } from "../db/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export interface ReadinessReport {
  betSpecId: string;
  title: string;
  score: number;       // 0–100
  readyToShip: boolean;
  checks: ReadinessCheck[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Spec payload shape (same as bet-spec.schema.json)
// ---------------------------------------------------------------------------

interface SpecPayload {
  hypothesis?: string;
  problemStatement?: string;
  userSegment?: string;
  acceptanceCriteria?: Array<{ criterion: string; metric?: string; target?: number }>;
  expectedImpact?: Array<{ metricName: string; expectedDelta: number; unit?: string }>;
  risks?: string[];
  constraints?: string[];
  timeboxWeeks?: number;
}

// ---------------------------------------------------------------------------
// Weights — must sum to 100
// ---------------------------------------------------------------------------

const CHECKS: Array<{
  id: string;
  label: string;
  weight: number;
  check: (spec: SpecPayload, hasLinkedMetric: boolean) => { status: CheckStatus; message: string };
}> = [
  {
    id: "hypothesis",
    label: "Hypothesis defined",
    weight: 25,
    check: (spec) => {
      if (!spec.hypothesis || spec.hypothesis.trim().length < 10) {
        return { status: "fail", message: "No hypothesis defined. A clear 'if X then Y' statement is required." };
      }
      if (spec.hypothesis.trim().length < 30) {
        return { status: "warn", message: "Hypothesis is very short — consider adding more specificity about the expected causal link." };
      }
      return { status: "pass", message: "Hypothesis is clearly stated." };
    },
  },
  {
    id: "acceptance_criteria",
    label: "Acceptance criteria set",
    weight: 20,
    check: (spec) => {
      const ac = spec.acceptanceCriteria;
      if (!ac || ac.length === 0) {
        return { status: "fail", message: "No acceptance criteria defined. You cannot ship without knowing what 'done' looks like." };
      }
      if (ac.length < 2) {
        return { status: "warn", message: "Only one acceptance criterion — consider adding a measurable metric target." };
      }
      const hasMetricTarget = ac.some((c) => c.metric !== undefined && c.target !== undefined);
      if (!hasMetricTarget) {
        return { status: "warn", message: "No acceptance criterion has a quantified metric target. Add a measurable threshold." };
      }
      return { status: "pass", message: `${ac.length} acceptance criteria defined with measurable targets.` };
    },
  },
  {
    id: "expected_impact",
    label: "Expected impact quantified",
    weight: 20,
    check: (spec) => {
      const impact = spec.expectedImpact;
      if (!impact || impact.length === 0) {
        return { status: "fail", message: "No expected impact defined. Quantify what metric(s) you expect to move and by how much." };
      }
      return { status: "pass", message: `${impact.length} metric impact(s) quantified.` };
    },
  },
  {
    id: "timebox",
    label: "Timebox defined",
    weight: 15,
    check: (spec) => {
      if (!spec.timeboxWeeks || spec.timeboxWeeks < 1) {
        return { status: "fail", message: "No timebox defined. Every bet must have a clear time limit to contain scope." };
      }
      if (spec.timeboxWeeks > 8) {
        return { status: "warn", message: `Timebox is ${spec.timeboxWeeks} weeks — this is long. Consider splitting into smaller bets.` };
      }
      return { status: "pass", message: `Timeboxed to ${spec.timeboxWeeks} week(s).` };
    },
  },
  {
    id: "risks",
    label: "Risks identified",
    weight: 10,
    check: (spec) => {
      const risks = spec.risks;
      if (!risks || risks.length === 0) {
        return { status: "warn", message: "No risks identified. Consider: what could invalidate this hypothesis?" };
      }
      return { status: "pass", message: `${risks.length} risk(s) identified.` };
    },
  },
  {
    id: "user_segment",
    label: "User segment specified",
    weight: 5,
    check: (spec) => {
      if (!spec.userSegment || spec.userSegment.trim().length < 5) {
        return { status: "warn", message: "User segment not specified. Who will be affected by this bet?" };
      }
      return { status: "pass", message: `Target segment: ${spec.userSegment}.` };
    },
  },
  {
    id: "linked_metric",
    label: "Linked to a metric",
    weight: 5,
    check: (_spec, hasLinkedMetric) => {
      if (!hasLinkedMetric) {
        return { status: "warn", message: "No metric is linked to this bet. Add a metric in the Metrics page and link it to track outcomes automatically." };
      }
      return { status: "pass", message: "Bet has a linked metric for outcome tracking." };
    },
  },
];

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function checkBetReadiness(
  workspaceId: string,
  productId: string,
  betId: string,
): Promise<ReadinessReport | null> {
  const db = getDb();

  // Load bet + current version
  const bet = (
    await db
      .select()
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.id, betId),
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!bet) return null;

  let spec: SpecPayload = {};
  if (bet.currentVersionId) {
    const versionRow = (
      await db
        .select({ structuredPayload: betSpecVersions.structuredPayload })
        .from(betSpecVersions)
        .where(eq(betSpecVersions.id, bet.currentVersionId))
        .limit(1)
    )[0];
    if (versionRow) {
      spec = versionRow.structuredPayload as SpecPayload;
    }
  }

  // Check if any metric is linked to this bet
  const linkedMetric = (
    await db
      .select({ id: metrics.id })
      .from(metrics)
      .where(
        and(
          eq(metrics.workspaceId, workspaceId),
          eq(metrics.productId, productId),
          eq(metrics.betSpecId, betId),
        ),
      )
      .limit(1)
  )[0];

  const hasLinkedMetric = !!linkedMetric;

  // Run all checks
  const checks: ReadinessCheck[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const checkDef of CHECKS) {
    const { status, message } = checkDef.check(spec, hasLinkedMetric);
    checks.push({ id: checkDef.id, label: checkDef.label, status, message });
    totalWeight += checkDef.weight;
    if (status === "pass") earnedWeight += checkDef.weight;
    else if (status === "warn") earnedWeight += checkDef.weight * 0.5;
    // fail = 0 points
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const readyToShip = checks.every((c) => c.status !== "fail") && score >= 70;

  return {
    betSpecId: betId,
    title: bet.title,
    score,
    readyToShip,
    checks,
    generatedAt: new Date().toISOString(),
  };
}
