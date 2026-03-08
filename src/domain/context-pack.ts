export const CONTEXT_PACK_SCHEMA_VERSION = "1.0.0" as const;

export const CONTEXT_VERSION_SOURCE = [
  "manual_input",
  "ai_structured",
  "restored",
  "compressed"
] as const;
export type ContextVersionSource = (typeof CONTEXT_VERSION_SOURCE)[number];

export const KPI_CADENCE = ["daily", "weekly", "monthly", "quarterly"] as const;
export type KpiCadence = (typeof KPI_CADENCE)[number];

export interface ContextStatement {
  id: string;
  statement: string;
  confidence?: number;
  evidenceLinks?: string[];
}

export interface KpiDefinition {
  metricId: string;
  metricName: string;
  definition: string;
  cadence: KpiCadence;
  targetDirection?: "increase" | "decrease";
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface ContextPackSections {
  productVision: ContextStatement[];
  targetUsers: ContextStatement[];
  goals: ContextStatement[];
  constraints: ContextStatement[];
  kpiDefinitions: KpiDefinition[];
  glossary: GlossaryTerm[];
  openQuestions: ContextStatement[];
}

export interface CompressionMetadata {
  isCompressed: boolean;
  sourceVersionRange?: {
    fromVersion: number;
    toVersion: number;
  };
  compressionNotes?: string;
}

export interface ContextPackVersion {
  schemaVersion: typeof CONTEXT_PACK_SCHEMA_VERSION;
  contextPackId: string;
  workspaceId: string;
  productId: string;
  version: number;
  source: ContextVersionSource;
  summary: string;
  sections: ContextPackSections;
  decisionReferences: string[];
  tags?: string[];
  compression: CompressionMetadata;
  createdAt: string;
  createdBy: string;
}

// Backward-compatible alias for service layer and existing route contracts.
export type ContextPackPayload = ContextPackVersion;
