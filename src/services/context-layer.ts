// Context Layer service — DB-backed implementation of context pack and
// decision log operations. All writes are audited and versioned.

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, max } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  auditEvents,
  contextPackVersions,
  contextPacks,
  decisionLogs,
} from "../db/schema.js";
import type { ContextPackPayload } from "../domain/context-pack.js";
import {
  buildSectionsFromRawText,
  structureContextInput,
} from "./ai-structurer.js";
import { compress } from "./compression-provider.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();
const newId = () => randomUUID().replace(/-/g, "");

async function emitAuditEvent(params: {
  workspaceId: string;
  actorId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  requestId?: string | undefined;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(auditEvents).values({
    id: `ae_${newId()}`,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    eventType: params.eventType,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    requestId: params.requestId ?? null,
    metadata: params.metadata ?? {},
  });
}

// ---------------------------------------------------------------------------
// Context Pack Ingestion
// ---------------------------------------------------------------------------

export interface IngestInput {
  workspaceId: string;
  productId: string;
  rawInput: string;
  tags?: string[] | undefined;
  createdBy: string;
  requestId?: string | undefined;
  useAiStructuring?: boolean; // default true; set false for tests without API key
}

export interface IngestResult {
  jobId: string;
  status: "completed";
  versionId: string;
  versionNumber: number;
  contextPackId: string;
  createdAt: string;
}

export async function ingestContext(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const useAi = input.useAiStructuring !== false;

  // Structure input via AI (or fallback for non-AI environments).
  const structured = useAi
    ? await structureContextInput(input.rawInput)
    : buildSectionsFromRawText(input.rawInput);

  const result = await db.transaction(async (tx) => {
    // 1. Get or create the context pack for this workspace+product.
    let pack = (
      await tx
        .select()
        .from(contextPacks)
        .where(
          and(
            eq(contextPacks.workspaceId, input.workspaceId),
            eq(contextPacks.productId, input.productId),
          ),
        )
        .limit(1)
    )[0];

    if (!pack) {
      const proposedContextPackId = `cp_${input.workspaceId}_${input.productId}_${newId().slice(0, 8)}`;
      await tx.insert(contextPacks).values({
        id: proposedContextPackId,
        workspaceId: input.workspaceId,
        productId: input.productId,
        currentVersionId: null,
      }).onConflictDoNothing({
        target: [contextPacks.workspaceId, contextPacks.productId],
      });

      pack = (
        await tx
          .select()
          .from(contextPacks)
          .where(
            and(
              eq(contextPacks.workspaceId, input.workspaceId),
              eq(contextPacks.productId, input.productId),
            ),
          )
          .limit(1)
      )[0];
    }

    if (!pack) {
      throw new Error("Failed to resolve context pack after insert.");
    }

    const contextPackId = pack.id;

    // 2. Compute next version number.
    const maxRow = (
      await tx
        .select({ m: max(contextPackVersions.versionNumber) })
        .from(contextPackVersions)
        .where(eq(contextPackVersions.contextPackId, contextPackId))
    )[0];

    const nextVersion = (maxRow?.m ?? 0) + 1;

    // 3. Build the structured payload (must conform to context-pack.schema.json).
    const payload: ContextPackPayload = {
      schemaVersion: "1.0.0",
      contextPackId,
      workspaceId: input.workspaceId,
      productId: input.productId,
      version: nextVersion,
      source: useAi ? "ai_structured" : "manual_input",
      summary: structured.summary,
      sections: structured.sections,
      decisionReferences: [],
      tags: input.tags ?? [],
      compression: { isCompressed: false },
      createdAt: nowIso(),
      createdBy: input.createdBy,
    };

    // 4. Insert version row.
    const versionId = `cpv_${newId()}`;
    await tx.insert(contextPackVersions).values({
      id: versionId,
      contextPackId,
      versionNumber: nextVersion,
      summary: structured.summary,
      structuredPayload: payload as unknown as Record<string, unknown>,
      source: payload.source,
      createdBy: input.createdBy,
    });

    // 5. Atomically update current_version_id.
    await tx
      .update(contextPacks)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(contextPacks.id, contextPackId));

    return { contextPackId, versionId, nextVersion, createdAt: payload.createdAt };
  });

  // Audit (outside transaction — best-effort).
  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "context_pack.ingested",
    resourceType: "context_pack_version",
    resourceId: result.versionId,
    requestId: input.requestId,
    metadata: { productId: input.productId, version: result.nextVersion },
  });

  return {
    jobId: `job_${newId()}`,
    status: "completed",
    versionId: result.versionId,
    versionNumber: result.nextVersion,
    contextPackId: result.contextPackId,
    createdAt: result.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Context Pack Read
// ---------------------------------------------------------------------------

export async function getCurrentContext(
  workspaceId: string,
  productId: string,
): Promise<ContextPackPayload | null> {
  const db = getDb();

  const pack = (
    await db
      .select()
      .from(contextPacks)
      .where(
        and(
          eq(contextPacks.workspaceId, workspaceId),
          eq(contextPacks.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!pack?.currentVersionId) return null;

  const version = (
    await db
      .select()
      .from(contextPackVersions)
      .where(eq(contextPackVersions.id, pack.currentVersionId))
      .limit(1)
  )[0];

  return version
    ? (version.structuredPayload as unknown as ContextPackPayload)
    : null;
}

export interface VersionListItem {
  id: string;
  versionNumber: number;
  summary: string;
  source: string;
  createdBy: string;
  createdAt: Date;
}

export async function getContextVersions(
  workspaceId: string,
  productId: string,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: VersionListItem[] }> {
  const db = getDb();

  const pack = (
    await db
      .select({ id: contextPacks.id })
      .from(contextPacks)
      .where(
        and(
          eq(contextPacks.workspaceId, workspaceId),
          eq(contextPacks.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!pack) return { total: 0, items: [] };

  const totalRow = (
    await db
      .select({ total: count() })
      .from(contextPackVersions)
      .where(eq(contextPackVersions.contextPackId, pack.id))
  )[0];

  const items = await db
    .select({
      id: contextPackVersions.id,
      versionNumber: contextPackVersions.versionNumber,
      summary: contextPackVersions.summary,
      source: contextPackVersions.source,
      createdBy: contextPackVersions.createdBy,
      createdAt: contextPackVersions.createdAt,
    })
    .from(contextPackVersions)
    .where(eq(contextPackVersions.contextPackId, pack.id))
    .orderBy(desc(contextPackVersions.versionNumber))
    .limit(limit)
    .offset(offset);

  return { total: Number(totalRow?.total ?? 0), items };
}

// ---------------------------------------------------------------------------
// Context Pack Restore
// ---------------------------------------------------------------------------

export interface RestoreInput {
  workspaceId: string;
  productId: string;
  restoreToVersion: number;
  createdBy: string;
  requestId?: string | undefined;
}

export interface RestoreResult {
  restoredFromVersion: number;
  newVersionNumber: number;
  versionId: string;
  contextPackId: string;
  createdAt: string;
}

export async function restoreContext(
  input: RestoreInput,
): Promise<RestoreResult | null> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const pack = (
      await tx
        .select()
        .from(contextPacks)
        .where(
          and(
            eq(contextPacks.workspaceId, input.workspaceId),
            eq(contextPacks.productId, input.productId),
          ),
        )
        .limit(1)
    )[0];

    if (!pack) return null;

    // Find the target version snapshot.
    const snapshot = (
      await tx
        .select()
        .from(contextPackVersions)
        .where(
          and(
            eq(contextPackVersions.contextPackId, pack.id),
            eq(contextPackVersions.versionNumber, input.restoreToVersion),
          ),
        )
        .limit(1)
    )[0];

    if (!snapshot) return null;

    // Compute next version number.
    const maxRow = (
      await tx
        .select({ m: max(contextPackVersions.versionNumber) })
        .from(contextPackVersions)
        .where(eq(contextPackVersions.contextPackId, pack.id))
    )[0];

    const nextVersion = (maxRow?.m ?? 0) + 1;
    const createdAt = nowIso();

    // Build restored payload from snapshot.
    const sourcePayload =
      snapshot.structuredPayload as unknown as ContextPackPayload;
    const restoredPayload: ContextPackPayload = {
      ...sourcePayload,
      version: nextVersion,
      source: "restored",
      summary:
        `Restored from v${input.restoreToVersion}: ${sourcePayload.summary}`.slice(
          0,
          1200,
        ),
      compression: { isCompressed: false },
      createdAt,
      createdBy: input.createdBy,
    };

    const versionId = `cpv_${newId()}`;
    await tx.insert(contextPackVersions).values({
      id: versionId,
      contextPackId: pack.id,
      versionNumber: nextVersion,
      summary: restoredPayload.summary,
      structuredPayload: restoredPayload as unknown as Record<string, unknown>,
      source: "restored",
      sourceVersionFrom: input.restoreToVersion,
      sourceVersionTo: input.restoreToVersion,
      createdBy: input.createdBy,
    });

    await tx
      .update(contextPacks)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(contextPacks.id, pack.id));

    return {
      contextPackId: pack.id,
      versionId,
      nextVersion,
      createdAt,
    };
  });

  if (!result) return null;

  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "context_pack.restored",
    resourceType: "context_pack_version",
    resourceId: result.versionId,
    requestId: input.requestId,
    metadata: {
      productId: input.productId,
      restoredFromVersion: input.restoreToVersion,
      newVersion: result.nextVersion,
    },
  });

  return {
    restoredFromVersion: input.restoreToVersion,
    newVersionNumber: result.nextVersion,
    versionId: result.versionId,
    contextPackId: result.contextPackId,
    createdAt: result.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Decision Log
// ---------------------------------------------------------------------------

export interface DecisionLogInput {
  workspaceId: string;
  productId: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  evidenceLinks?: string[];
  createdBy: string;
  requestId?: string | undefined;
}

export interface DecisionLogRecord {
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

export async function createDecisionLog(
  input: DecisionLogInput,
): Promise<DecisionLogRecord> {
  const db = getDb();
  const id = `dlog_${newId()}`;
  const createdAt = nowIso();

  await db.insert(decisionLogs).values({
    id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    title: input.title,
    decision: input.decision,
    rationale: input.rationale,
    alternatives: input.alternatives ?? [],
    evidenceLinks: input.evidenceLinks ?? [],
    createdBy: input.createdBy,
  });

  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "decision_log.created",
    resourceType: "decision_log",
    resourceId: id,
    requestId: input.requestId,
    metadata: { productId: input.productId, title: input.title },
  });

  return {
    id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    title: input.title,
    decision: input.decision,
    rationale: input.rationale,
    alternatives: input.alternatives ?? [],
    evidenceLinks: input.evidenceLinks ?? [],
    createdBy: input.createdBy,
    createdAt,
  };
}

export async function getDecisionLogs(
  workspaceId: string,
  productId: string,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: DecisionLogRecord[] }> {
  const db = getDb();
  const totalRow = (
    await db
      .select({ total: count() })
      .from(decisionLogs)
      .where(
        and(
          eq(decisionLogs.workspaceId, workspaceId),
          eq(decisionLogs.productId, productId),
        ),
      )
  )[0];

  const rows = await db
    .select()
    .from(decisionLogs)
    .where(
      and(
        eq(decisionLogs.workspaceId, workspaceId),
        eq(decisionLogs.productId, productId),
      ),
    )
    .orderBy(desc(decisionLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      productId: r.productId,
      title: r.title,
      decision: r.decision,
      rationale: r.rationale,
      alternatives: (r.alternatives as string[]) ?? [],
      evidenceLinks: (r.evidenceLinks as string[]) ?? [],
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Context Pack Compression
// ---------------------------------------------------------------------------

export interface CompressContextInput {
  workspaceId: string;
  productId: string;
  createdBy: string;
  requestId?: string | undefined;
  aggressiveness?: number; // 0–1, default 0.15
}

export interface CompressContextResult {
  versionId: string;
  versionNumber: number;
  contextPackId: string;
  compressionRatio: number;
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  createdAt: string;
}

/** Serialize a ContextPackPayload to plain text for compression. */
function serializePayloadToText(payload: ContextPackPayload): string {
  const lines: string[] = [];

  lines.push(`Summary: ${payload.summary}`);

  const s = payload.sections;

  if (s.productVision.length > 0) {
    lines.push("\n## Product Vision");
    for (const v of s.productVision)
      lines.push(`[${v.id}] ${v.statement}`);
  }
  if (s.targetUsers.length > 0) {
    lines.push("\n## Target Users");
    for (const u of s.targetUsers) lines.push(`[${u.id}] ${u.statement}`);
  }
  if (s.goals.length > 0) {
    lines.push("\n## Goals");
    for (const g of s.goals) lines.push(`[${g.id}] ${g.statement}`);
  }
  if (s.constraints.length > 0) {
    lines.push("\n## Constraints");
    for (const c of s.constraints) lines.push(`[${c.id}] ${c.statement}`);
  }
  if (s.kpiDefinitions.length > 0) {
    lines.push("\n## KPI Definitions");
    for (const k of s.kpiDefinitions)
      lines.push(
        `[${k.metricId}] ${k.metricName}: ${k.definition} (cadence: ${k.cadence}${k.targetDirection ? `, direction: ${k.targetDirection}` : ""})`,
      );
  }
  if (s.glossary.length > 0) {
    lines.push("\n## Glossary");
    for (const g of s.glossary) lines.push(`${g.term}: ${g.definition}`);
  }
  if (s.openQuestions.length > 0) {
    lines.push("\n## Open Questions");
    for (const q of s.openQuestions) lines.push(`[${q.id}] ${q.statement}`);
  }

  return lines.join("\n");
}

/** Extract safe terms (IDs and names) to protect during compression. */
function extractSafeTerms(payload: ContextPackPayload): string[] {
  const terms: string[] = [];
  const s = payload.sections;

  for (const v of s.productVision) terms.push(v.id);
  for (const u of s.targetUsers) terms.push(u.id);
  for (const g of s.goals) terms.push(g.id);
  for (const c of s.constraints) terms.push(c.id);
  for (const q of s.openQuestions) terms.push(q.id);
  for (const k of s.kpiDefinitions) terms.push(k.metricId, k.metricName);
  for (const g of s.glossary) terms.push(g.term);

  return [...new Set(terms)];
}

export async function compressContext(
  input: CompressContextInput,
): Promise<CompressContextResult | null> {
  const db = getDb();

  // 1. Load current version.
  const currentPayload = await getCurrentContext(
    input.workspaceId,
    input.productId,
  );
  if (!currentPayload) return null;

  // 2. Serialize to text and run compression.
  const text = serializePayloadToText(currentPayload);
  const safeTerms = extractSafeTerms(currentPayload);

  const compressionResult = await compress({
    text,
    safeTerms,
    ...(input.aggressiveness !== undefined
      ? { aggressiveness: input.aggressiveness }
      : {}),
  });

  // 3. Re-structure the compressed text into typed sections.
  const structured = await structureContextInput(
    compressionResult.compressedText,
  );

  // 4. Persist the compressed version in a transaction.
  const result = await db.transaction(async (tx) => {
    const pack = (
      await tx
        .select()
        .from(contextPacks)
        .where(
          and(
            eq(contextPacks.workspaceId, input.workspaceId),
            eq(contextPacks.productId, input.productId),
          ),
        )
        .limit(1)
    )[0];

    if (!pack) return null;

    const maxRow = (
      await tx
        .select({ m: max(contextPackVersions.versionNumber) })
        .from(contextPackVersions)
        .where(eq(contextPackVersions.contextPackId, pack.id))
    )[0];

    const nextVersion = (maxRow?.m ?? 0) + 1;
    const createdAt = nowIso();

    const compressedPayload: ContextPackPayload = {
      schemaVersion: "1.0.0",
      contextPackId: pack.id,
      workspaceId: input.workspaceId,
      productId: input.productId,
      version: nextVersion,
      source: "compressed",
      summary: structured.summary,
      sections: structured.sections,
      decisionReferences: currentPayload.decisionReferences,
      tags: currentPayload.tags ?? [],
      compression: {
        isCompressed: true,
        compressionNotes: [
          `provider:${compressionResult.provider}`,
          `model:${compressionResult.model}`,
          `ratio:${compressionResult.compressionRatio.toFixed(3)}`,
          `fallback:${compressionResult.fallbackUsed}`,
        ].join(" "),
      },
      createdAt,
      createdBy: input.createdBy,
    };

    const versionId = `cpv_${newId()}`;
    await tx.insert(contextPackVersions).values({
      id: versionId,
      contextPackId: pack.id,
      versionNumber: nextVersion,
      summary: compressedPayload.summary,
      structuredPayload: compressedPayload as unknown as Record<string, unknown>,
      source: "compressed",
      createdBy: input.createdBy,
    });

    await tx
      .update(contextPacks)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(contextPacks.id, pack.id));

    return {
      contextPackId: pack.id,
      versionId,
      nextVersion,
      createdAt,
    };
  });

  if (!result) return null;

  // 5. Audit event.
  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "context_pack.compressed",
    resourceType: "context_pack_version",
    resourceId: result.versionId,
    requestId: input.requestId,
    metadata: {
      productId: input.productId,
      newVersion: result.nextVersion,
      compressionProvider: compressionResult.provider,
      compressionModel: compressionResult.model,
      compressionRatio: compressionResult.compressionRatio,
      fallbackUsed: compressionResult.fallbackUsed,
      latencyMs: compressionResult.latencyMs,
    },
  });

  return {
    versionId: result.versionId,
    versionNumber: result.nextVersion,
    contextPackId: result.contextPackId,
    compressionRatio: compressionResult.compressionRatio,
    provider: compressionResult.provider,
    model: compressionResult.model,
    latencyMs: compressionResult.latencyMs,
    fallbackUsed: compressionResult.fallbackUsed,
    createdAt: result.createdAt,
  };
}

export async function getDecisionLogById(
  workspaceId: string,
  productId: string,
  id: string,
): Promise<DecisionLogRecord | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(decisionLogs)
      .where(
        and(
          eq(decisionLogs.id, id),
          eq(decisionLogs.workspaceId, workspaceId),
          eq(decisionLogs.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!row) return null;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    productId: row.productId,
    title: row.title,
    decision: row.decision,
    rationale: row.rationale,
    alternatives: (row.alternatives as string[]) ?? [],
    evidenceLinks: (row.evidenceLinks as string[]) ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
