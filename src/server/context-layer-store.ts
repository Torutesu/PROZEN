import { randomUUID } from "node:crypto";

import {
  CONTEXT_PACK_SCHEMA_VERSION,
  type ContextPackVersion,
  type ContextPackSections
} from "../domain/context-pack.js";

export interface DecisionLog {
  id: string;
  workspaceId: string;
  productId: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  evidenceLinks: string[];
  createdBy: string;
  createdAt: string;
}

export interface ContextPackState {
  contextPackId: string;
  versions: ContextPackVersion[];
}

export interface IngestInput {
  workspaceId: string;
  productId: string;
  input: string;
  tags?: string[];
  createdBy?: string;
}

const nowIso = () => new Date().toISOString();
const keyOf = (workspaceId: string, productId: string) => `${workspaceId}::${productId}`;

export class ContextLayerStore {
  private readonly contextByKey = new Map<string, ContextPackState>();
  private readonly decisionLogsByKey = new Map<string, DecisionLog[]>();

  ingestContext(input: IngestInput) {
    const key = keyOf(input.workspaceId, input.productId);
    const existing = this.contextByKey.get(key);
    const contextPackId = existing?.contextPackId ?? `cp_${input.workspaceId}_${input.productId}`;
    const nextVersion = (existing?.versions.at(-1)?.version ?? 0) + 1;
    const createdAt = nowIso();
    const createdBy = input.createdBy ?? "system";
    const sections = this.buildSectionsFromInput(input.input);
    const summary = this.summarize(input.input);
    const versionBase: ContextPackVersion = {
      schemaVersion: CONTEXT_PACK_SCHEMA_VERSION,
      contextPackId,
      workspaceId: input.workspaceId,
      productId: input.productId,
      version: nextVersion,
      source: "ai_structured",
      summary,
      sections,
      decisionReferences: [],
      compression: { isCompressed: false },
      createdAt,
      createdBy
    };
    const version: ContextPackVersion =
      input.tags && input.tags.length > 0 ? { ...versionBase, tags: input.tags } : versionBase;

    if (!existing) {
      this.contextByKey.set(key, { contextPackId, versions: [version] });
    } else {
      existing.versions.push(version);
    }

    return {
      jobId: `job_${randomUUID()}`,
      status: "completed" as const,
      version
    };
  }

  getCurrentContext(workspaceId: string, productId: string): ContextPackVersion | null {
    const key = keyOf(workspaceId, productId);
    const existing = this.contextByKey.get(key);
    return existing?.versions.at(-1) ?? null;
  }

  getContextVersions(workspaceId: string, productId: string): ContextPackVersion[] {
    const key = keyOf(workspaceId, productId);
    const existing = this.contextByKey.get(key);
    return existing ? [...existing.versions] : [];
  }

  restoreContext(
    workspaceId: string,
    productId: string,
    restoreVersion: number,
    createdBy: string
  ): ContextPackVersion | null {
    const key = keyOf(workspaceId, productId);
    const existing = this.contextByKey.get(key);
    if (!existing) {
      return null;
    }

    const snapshot = existing.versions.find((v) => v.version === restoreVersion);
    if (!snapshot) {
      return null;
    }

    const nextVersion = (existing.versions.at(-1)?.version ?? 0) + 1;
    const restored: ContextPackVersion = {
      ...snapshot,
      version: nextVersion,
      source: "restored",
      summary: `Restored from version ${restoreVersion}: ${snapshot.summary}`.slice(0, 1200),
      compression: {
        ...snapshot.compression,
        isCompressed: false
      },
      createdAt: nowIso(),
      createdBy
    };

    existing.versions.push(restored);
    return restored;
  }

  createDecisionLog(input: Omit<DecisionLog, "id" | "createdAt">): DecisionLog {
    const key = keyOf(input.workspaceId, input.productId);
    const log: DecisionLog = {
      ...input,
      id: `dlog_${randomUUID()}`,
      createdAt: nowIso()
    };
    const list = this.decisionLogsByKey.get(key);
    if (!list) {
      this.decisionLogsByKey.set(key, [log]);
    } else {
      list.push(log);
    }
    return log;
  }

  getDecisionLogs(workspaceId: string, productId: string): DecisionLog[] {
    const key = keyOf(workspaceId, productId);
    const list = this.decisionLogsByKey.get(key) ?? [];
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  getDecisionLogById(
    workspaceId: string,
    productId: string,
    decisionLogId: string
  ): DecisionLog | null {
    return (
      this.getDecisionLogs(workspaceId, productId).find((item) => item.id === decisionLogId) ?? null
    );
  }

  private summarize(input: string): string {
    const oneLine = input.replace(/\s+/g, " ").trim();
    if (oneLine.length <= 200) {
      return oneLine;
    }
    return `${oneLine.slice(0, 197)}...`;
  }

  private buildSectionsFromInput(input: string): ContextPackSections {
    const lines = input
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const first = lines[0] ?? "No product vision provided.";
    const second = lines[1] ?? first;
    const third = lines[2] ?? second;

    return {
      productVision: [{ id: "VISION-1", statement: first }],
      targetUsers: [{ id: "USER-1", statement: second }],
      goals: [{ id: "GOAL-1", statement: third }],
      constraints: [{ id: "CONST-1", statement: "No explicit constraint provided yet." }],
      kpiDefinitions: [],
      glossary: [],
      openQuestions: [{ id: "QUES-1", statement: "What should be prioritized next?" }]
    };
  }
}
