export const BET_SPEC_SCHEMA_VERSION = "1.0.0" as const;

export const BET_STATUS = ["draft", "active", "completed", "cancelled"] as const;
export type BetStatus = (typeof BET_STATUS)[number];

export const BET_PRIORITY = ["low", "medium", "high", "critical"] as const;
export type BetPriority = (typeof BET_PRIORITY)[number];

export const METRIC_LAYER = ["bet", "kpi", "activity"] as const;
export type MetricLayer = (typeof METRIC_LAYER)[number];

export const TARGET_TYPE = ["absolute", "relative"] as const;
export type TargetType = (typeof TARGET_TYPE)[number];

export const TARGET_DIRECTION = ["increase", "decrease"] as const;
export type TargetDirection = (typeof TARGET_DIRECTION)[number];

export const CRITERION_TYPE = [
  "functional",
  "non_functional",
  "analytics",
  "quality",
  "security",
  "ux"
] as const;
export type CriterionType = (typeof CRITERION_TYPE)[number];

export const CRITERION_PRIORITY = ["p0", "p1", "p2"] as const;
export type CriterionPriority = (typeof CRITERION_PRIORITY)[number];

export const VERIFICATION_METHOD = ["manual", "automated", "observational"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHOD)[number];

export const CRITERION_STATUS = ["pending", "pass", "fail", "n_a"] as const;
export type CriterionStatus = (typeof CRITERION_STATUS)[number];

export const RISK_SEVERITY = ["low", "medium", "high"] as const;
export type RiskSeverity = (typeof RISK_SEVERITY)[number];

export const CONFIDENCE_LEVEL = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVEL)[number];

export const REVIEW_CADENCE = ["daily", "weekly", "biweekly", "monthly"] as const;
export type ReviewCadence = (typeof REVIEW_CADENCE)[number];

export interface MetricTarget {
  metricId: string;
  metricName: string;
  layer: MetricLayer;
  targetType: TargetType;
  direction: TargetDirection;
  baselineValue: number;
  targetValue: number;
  unit?: string;
  confidence: number;
  evaluationWindowDays: number;
  notes?: string;
}

export interface AcceptanceCriterion {
  id: string;
  type: CriterionType;
  priority: CriterionPriority;
  statement: string;
  verificationMethod: VerificationMethod;
  status: CriterionStatus;
  owner?: string;
}

export interface RiskItem {
  id: string;
  statement: string;
  severity: RiskSeverity;
  mitigation?: string;
  owner?: string;
}

export interface AssumptionItem {
  id: string;
  statement: string;
  confidence: ConfidenceLevel;
  validationPlan?: string;
}

export interface DependencyItem {
  id: string;
  statement: string;
  kind: "team" | "tool" | "data" | "external";
  status: "pending" | "confirmed" | "blocked";
}

export interface InstrumentationPlan {
  eventName: string;
  description: string;
  layer: MetricLayer;
  owner?: string;
}

export interface BetOutcome {
  resultSummary: string;
  actualImpacts: MetricTarget[];
  learning: string;
  followUpBetIds?: string[];
}

export interface BetSpec {
  schemaVersion: typeof BET_SPEC_SCHEMA_VERSION;
  betId: string;
  workspaceId: string;
  productId: string;
  title: string;
  status: BetStatus;
  priority: BetPriority;
  owner: string;
  hypothesis: string;
  problemStatement: string;
  userSegment: string;
  intent: string[];
  constraints: string[];
  expectedImpacts: MetricTarget[];
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  acceptanceCriteria: AcceptanceCriterion[];
  risks: RiskItem[];
  assumptions: AssumptionItem[];
  dependencies: DependencyItem[];
  instrumentationPlan: InstrumentationPlan[];
  timeline: {
    createdDate: string;
    targetDecisionDate: string;
    targetReleaseDate?: string;
    reviewCadence: ReviewCadence;
  };
  links: {
    contextPackVersionId: string;
    decisionLogIds: string[];
    github?: {
      repository?: string;
      pullRequestNumbers?: number[];
      commitShas?: string[];
    };
  };
  outcomes?: BetOutcome;
  tags?: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

