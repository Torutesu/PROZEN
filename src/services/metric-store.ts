// Metric Store — DB-backed CRUD for metrics, readings, and anomalies.

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, betSpecs, metricAnomalies, metricReadings, metrics } from "../db/schema.js";
import { detectAnomaly, generateImpactNarrative } from "./anomaly-detector.js";
import { getCurrentContext } from "./context-layer.js";

const newId = () => randomUUID().replace(/-/g, "");
const nowIso = () => new Date().toISOString();

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
// Types
// ---------------------------------------------------------------------------

export type MetricLayer = "bet" | "kpi" | "activity";
export type MetricDirection = "increase" | "decrease";

export interface MetricRecord {
  id: string;
  workspaceId: string;
  productId: string;
  name: string;
  description: string | null;
  layer: MetricLayer;
  unit: string | null;
  direction: MetricDirection;
  targetValue: number | null;
  baselineValue: number | null;
  betSpecId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadingRecord {
  id: string;
  metricId: string;
  value: number;
  recordedAt: Date;
  source: string;
  note: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface AnomalyRecord {
  id: string;
  metricId: string;
  metricName?: string | undefined;
  readingId: string | null;
  severity: string;
  direction: string;
  baselineValue: number | null;
  actualValue: number;
  deviationPct: number | null;
  impactNarrative: string | null;
  isResolved: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Create metric
// ---------------------------------------------------------------------------

export interface CreateMetricInput {
  workspaceId: string;
  productId: string;
  name: string;
  description?: string | undefined;
  layer: MetricLayer;
  unit?: string | undefined;
  direction?: MetricDirection | undefined;
  targetValue?: number | undefined;
  baselineValue?: number | undefined;
  betSpecId?: string | undefined;
  createdBy: string;
  requestId?: string | undefined;
}

export async function createMetric(
  input: CreateMetricInput,
): Promise<MetricRecord> {
  const db = getDb();
  const id = `met_${newId()}`;

  await db.insert(metrics).values({
    id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    name: input.name,
    description: input.description ?? null,
    layer: input.layer,
    unit: input.unit ?? null,
    direction: input.direction ?? "increase",
    targetValue: input.targetValue?.toString() ?? null,
    baselineValue: input.baselineValue?.toString() ?? null,
    betSpecId: input.betSpecId ?? null,
    createdBy: input.createdBy,
  });

  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "metric.created",
    resourceType: "metric",
    resourceId: id,
    requestId: input.requestId,
    metadata: { productId: input.productId, layer: input.layer, name: input.name },
  });

  return getMetricById(
    input.workspaceId,
    input.productId,
    id,
  ) as Promise<MetricRecord>;
}

// ---------------------------------------------------------------------------
// Read metrics
// ---------------------------------------------------------------------------

export async function getMetrics(
  workspaceId: string,
  productId: string,
  layer?: MetricLayer | undefined,
  limit = 100,
  offset = 0,
): Promise<{ total: number; items: MetricRecord[] }> {
  const db = getDb();

  const conditions = [
    eq(metrics.workspaceId, workspaceId),
    eq(metrics.productId, productId),
  ];
  if (layer) conditions.push(eq(metrics.layer, layer));

  const totalRow = (
    await db
      .select({ total: count() })
      .from(metrics)
      .where(and(...conditions))
  )[0];

  const rows = await db
    .select()
    .from(metrics)
    .where(and(...conditions))
    .orderBy(metrics.layer, desc(metrics.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map(toMetricRecord),
  };
}

export async function getMetricById(
  workspaceId: string,
  productId: string,
  metricId: string,
): Promise<MetricRecord | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(metrics)
      .where(
        and(
          eq(metrics.id, metricId),
          eq(metrics.workspaceId, workspaceId),
          eq(metrics.productId, productId),
        ),
      )
      .limit(1)
  )[0];
  return row ? toMetricRecord(row) : null;
}

function toMetricRecord(row: typeof metrics.$inferSelect): MetricRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    productId: row.productId,
    name: row.name,
    description: row.description,
    layer: row.layer as MetricLayer,
    unit: row.unit,
    direction: row.direction as MetricDirection,
    targetValue: row.targetValue !== null ? Number(row.targetValue) : null,
    baselineValue: row.baselineValue !== null ? Number(row.baselineValue) : null,
    betSpecId: row.betSpecId,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Update metric
// ---------------------------------------------------------------------------

export interface UpdateMetricInput {
  name?: string | undefined;
  description?: string | undefined;
  targetValue?: number | undefined;
  baselineValue?: number | undefined;
  isActive?: boolean | undefined;
  betSpecId?: string | undefined;
}

export async function updateMetric(
  workspaceId: string,
  productId: string,
  metricId: string,
  input: UpdateMetricInput,
  actorId: string,
): Promise<MetricRecord | null> {
  const db = getDb();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.description !== undefined) patch["description"] = input.description;
  if (input.targetValue !== undefined) patch["targetValue"] = input.targetValue.toString();
  if (input.baselineValue !== undefined) patch["baselineValue"] = input.baselineValue.toString();
  if (input.isActive !== undefined) patch["isActive"] = input.isActive;
  if (input.betSpecId !== undefined) patch["betSpecId"] = input.betSpecId;

  await db
    .update(metrics)
    .set(patch)
    .where(
      and(
        eq(metrics.id, metricId),
        eq(metrics.workspaceId, workspaceId),
        eq(metrics.productId, productId),
      ),
    );

  await emitAuditEvent({
    workspaceId,
    actorId,
    eventType: "metric.updated",
    resourceType: "metric",
    resourceId: metricId,
    metadata: patch,
  });

  return getMetricById(workspaceId, productId, metricId);
}

// ---------------------------------------------------------------------------
// Add reading — triggers anomaly detection
// ---------------------------------------------------------------------------

export interface AddReadingInput {
  workspaceId: string;
  productId: string;
  metricId: string;
  value: number;
  recordedAt?: string | undefined;
  source?: string | undefined;
  note?: string | undefined;
  createdBy: string;
  requestId?: string | undefined;
}

export interface AddReadingResult {
  reading: ReadingRecord;
  anomaly?: AnomalyRecord | undefined;
}

export async function addReading(
  input: AddReadingInput,
): Promise<AddReadingResult | null> {
  const db = getDb();

  const metric = await getMetricById(
    input.workspaceId,
    input.productId,
    input.metricId,
  );
  if (!metric) return null;

  const readingId = `mrd_${newId()}`;

  await db.insert(metricReadings).values({
    id: readingId,
    metricId: input.metricId,
    workspaceId: input.workspaceId,
    value: input.value.toString(),
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
    source: input.source ?? "manual",
    note: input.note ?? null,
    createdBy: input.createdBy,
  });

  const reading = await getReadingById(readingId);
  if (!reading) return null;

  // --- Anomaly detection ---
  let anomaly: AnomalyRecord | undefined;

  const detection = detectAnomaly(
    input.value,
    metric.baselineValue,
    metric.direction,
  );

  if (detection.isAnomaly && detection.severity && detection.direction && detection.deviationPct !== undefined) {
    // Generate AI impact narrative (best-effort, non-blocking).
    let impactNarrative: string | null = null;

    try {
      const contextPack = await getCurrentContext(input.workspaceId, input.productId).catch(() => null);

      // For activity-layer anomalies, also fetch related KPIs.
      let relatedKpis: Array<{ name: string; unit: string | null; currentValue: number }> | undefined;
      if (metric.layer === "activity") {
        const kpiResult = await getMetrics(input.workspaceId, input.productId, "kpi", 5, 0).catch(() => ({ items: [] }));
        if (kpiResult.items.length > 0) {
          const kpiIds = kpiResult.items.map((k) => k.id);
          const latestReadings = await db
            .select()
            .from(metricReadings)
            .where(inArray(metricReadings.metricId, kpiIds))
            .orderBy(desc(metricReadings.recordedAt))
            .limit(kpiIds.length * 3);

          // Pick the most recent reading per KPI.
          const seenKpi = new Set<string>();
          relatedKpis = latestReadings
            .filter((r) => {
              if (seenKpi.has(r.metricId)) return false;
              seenKpi.add(r.metricId);
              return true;
            })
            .map((r) => {
              const kpi = kpiResult.items.find((k) => k.id === r.metricId);
              return {
                name: kpi?.name ?? r.metricId,
                unit: kpi?.unit ?? null,
                currentValue: Number(r.value),
              };
            });
        }
      }

      impactNarrative = await generateImpactNarrative({
        metricName: metric.name,
        metricLayer: metric.layer,
        unit: metric.unit,
        baselineValue: metric.baselineValue ?? 0,
        actualValue: input.value,
        deviationPct: detection.deviationPct,
        direction: detection.direction,
        severity: detection.severity,
        ...(contextPack?.summary ? { productSummary: contextPack.summary } : {}),
        ...(relatedKpis ? { relatedKpis } : {}),
      });
    } catch {
      // AI narrative failure is non-fatal.
    }

    const anomalyId = `man_${newId()}`;
    await db.insert(metricAnomalies).values({
      id: anomalyId,
      metricId: input.metricId,
      workspaceId: input.workspaceId,
      readingId,
      severity: detection.severity,
      direction: detection.direction,
      baselineValue: metric.baselineValue?.toString() ?? null,
      actualValue: input.value.toString(),
      deviationPct: detection.deviationPct.toString(),
      impactNarrative,
      isResolved: false,
    });

    anomaly = {
      id: anomalyId,
      metricId: input.metricId,
      readingId,
      severity: detection.severity,
      direction: detection.direction,
      baselineValue: metric.baselineValue,
      actualValue: input.value,
      deviationPct: detection.deviationPct,
      impactNarrative,
      isResolved: false,
      createdAt: new Date(),
    };

    await emitAuditEvent({
      workspaceId: input.workspaceId,
      actorId: input.createdBy,
      eventType: "metric_anomaly.detected",
      resourceType: "metric_anomaly",
      resourceId: anomalyId,
      requestId: input.requestId,
      metadata: {
        metricId: input.metricId,
        severity: detection.severity,
        deviationPct: detection.deviationPct,
      },
    });
  }

  return { reading, ...(anomaly ? { anomaly } : {}) };
}

async function getReadingById(readingId: string): Promise<ReadingRecord | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(metricReadings)
      .where(eq(metricReadings.id, readingId))
      .limit(1)
  )[0];
  if (!row) return null;
  return {
    id: row.id,
    metricId: row.metricId,
    value: Number(row.value),
    recordedAt: row.recordedAt,
    source: row.source,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Read readings
// ---------------------------------------------------------------------------

export async function getReadings(
  workspaceId: string,
  productId: string,
  metricId: string,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: ReadingRecord[] }> {
  const db = getDb();

  // Verify ownership.
  const metric = await getMetricById(workspaceId, productId, metricId);
  if (!metric) return { total: 0, items: [] };

  const totalRow = (
    await db
      .select({ total: count() })
      .from(metricReadings)
      .where(eq(metricReadings.metricId, metricId))
  )[0];

  const rows = await db
    .select()
    .from(metricReadings)
    .where(eq(metricReadings.metricId, metricId))
    .orderBy(desc(metricReadings.recordedAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      metricId: r.metricId,
      value: Number(r.value),
      recordedAt: r.recordedAt,
      source: r.source,
      note: r.note,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Read anomalies
// ---------------------------------------------------------------------------

export async function getAnomalies(
  workspaceId: string,
  productId?: string | undefined,
  includeResolved = false,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: AnomalyRecord[] }> {
  const db = getDb();

  // Get metric IDs for this workspace+product combo.
  const metricFilter = productId
    ? await db
        .select({ id: metrics.id, name: metrics.name })
        .from(metrics)
        .where(and(eq(metrics.workspaceId, workspaceId), eq(metrics.productId, productId)))
    : await db
        .select({ id: metrics.id, name: metrics.name })
        .from(metrics)
        .where(eq(metrics.workspaceId, workspaceId));

  if (metricFilter.length === 0) return { total: 0, items: [] };

  const metricIds = metricFilter.map((m) => m.id);
  const metricNameMap = new Map(metricFilter.map((m) => [m.id, m.name]));

  const conditions = [inArray(metricAnomalies.metricId, metricIds)];
  if (!includeResolved) {
    conditions.push(
      or(
        eq(metricAnomalies.isResolved, false),
        isNull(metricAnomalies.isResolved),
      )!,
    );
  }

  const totalRow = (
    await db
      .select({ total: count() })
      .from(metricAnomalies)
      .where(and(...conditions))
  )[0];

  const rows = await db
    .select()
    .from(metricAnomalies)
    .where(and(...conditions))
    .orderBy(desc(metricAnomalies.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      metricId: r.metricId,
      metricName: metricNameMap.get(r.metricId),
      readingId: r.readingId,
      severity: r.severity,
      direction: r.direction,
      baselineValue: r.baselineValue !== null ? Number(r.baselineValue) : null,
      actualValue: Number(r.actualValue),
      deviationPct: r.deviationPct !== null ? Number(r.deviationPct) : null,
      impactNarrative: r.impactNarrative,
      isResolved: r.isResolved,
      createdAt: r.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Anomaly → Bet impact linkage (GAP-004)
// ---------------------------------------------------------------------------

export interface AffectedBet {
  betId: string;
  title: string;
  status: string;
  linkageReason: string;
}

export interface AffectedBetsResult {
  anomalyId: string;
  metricId: string;
  metricName: string;
  affectedBets: AffectedBet[];
}

export async function getAffectedBets(
  workspaceId: string,
  productId: string,
  anomalyId: string,
): Promise<AffectedBetsResult | null> {
  const db = getDb();

  // Fetch anomaly scoped to workspace/product with metric details.
  const anomalyRow = (
    await db
      .select({
        id: metricAnomalies.id,
        metricId: metricAnomalies.metricId,
        direction: metricAnomalies.direction,
        severity: metricAnomalies.severity,
        deviationPct: metricAnomalies.deviationPct,
        metricName: metrics.name,
        metricBetSpecId: metrics.betSpecId,
      })
      .from(metricAnomalies)
      .innerJoin(metrics, eq(metricAnomalies.metricId, metrics.id))
      .where(
        and(
          eq(metricAnomalies.id, anomalyId),
          eq(metricAnomalies.workspaceId, workspaceId),
          eq(metrics.workspaceId, workspaceId),
          eq(metrics.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!anomalyRow) return null;

  const candidateBets = await db
    .select({ id: betSpecs.id, title: betSpecs.title, status: betSpecs.status })
    .from(betSpecs)
    .where(
      and(
        eq(betSpecs.workspaceId, workspaceId),
        eq(betSpecs.productId, productId),
        inArray(betSpecs.status, ["active", "draft"]),
      ),
    );

  if (candidateBets.length === 0) {
    return {
      anomalyId,
      metricId: anomalyRow.metricId,
      metricName: anomalyRow.metricName,
      affectedBets: [],
    };
  }

  const candidateBetIds = candidateBets.map((b) => b.id);
  const linkedMetrics = await db
    .select({ betSpecId: metrics.betSpecId, metricId: metrics.id, metricName: metrics.name })
    .from(metrics)
    .where(
      and(
        eq(metrics.workspaceId, workspaceId),
        eq(metrics.productId, productId),
        inArray(metrics.betSpecId, candidateBetIds),
      ),
    );

  const linkedMetricsByBet = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of linkedMetrics) {
    if (!row.betSpecId) continue;
    const current = linkedMetricsByBet.get(row.betSpecId) ?? [];
    current.push({ id: row.metricId, name: row.metricName });
    linkedMetricsByBet.set(row.betSpecId, current);
  }

  const affectedBets: AffectedBet[] = [];
  const seenBetIds = new Set<string>();
  const metricKeywords = anomalyRow.metricName
    .toLowerCase()
    .split(/\s+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw.length > 3);
  const directionText =
    anomalyRow.direction === "below_target"
      ? "below-target"
      : anomalyRow.direction === "above_target"
        ? "above-target"
        : anomalyRow.direction;

  // Layer 1: strict direct link.
  if (anomalyRow.metricBetSpecId) {
    const directBet = candidateBets.find((b) => b.id === anomalyRow.metricBetSpecId);
    if (directBet) {
      affectedBets.push({
        betId: directBet.id,
        title: directBet.title,
        status: directBet.status,
        linkageReason: `Metric "${anomalyRow.metricName}" is directly linked to this bet and showed a ${directionText} anomaly${anomalyRow.deviationPct !== null ? ` (${Math.abs(Number(anomalyRow.deviationPct))}% deviation)` : ""}.`,
      });
      seenBetIds.add(directBet.id);
    }
  }

  for (const bet of candidateBets) {
    if (seenBetIds.has(bet.id)) continue;
    const betTitleKeywords = bet.title.toLowerCase().split(/\s+/);
    const betLinkedMetrics = linkedMetricsByBet.get(bet.id) ?? [];
    const linkedMetricOverlap = metricKeywords.some((kw) =>
      betLinkedMetrics.some((m) => m.name.toLowerCase().includes(kw)),
    );
    if (linkedMetricOverlap) {
      affectedBets.push({
        betId: bet.id,
        title: bet.title,
        status: bet.status,
        linkageReason: `Metric "${anomalyRow.metricName}" overlaps with one of this bet's linked metrics, suggesting this hypothesis is affected by the ${anomalyRow.severity} severity anomaly.`,
      });
      continue;
    }

    const titleOverlap = metricKeywords.some((kw) =>
      betTitleKeywords.some((bkw) => bkw.includes(kw) || kw.includes(bkw)),
    );
    if (titleOverlap) {
      affectedBets.push({
        betId: bet.id,
        title: bet.title,
        status: bet.status,
        linkageReason: `Metric "${anomalyRow.metricName}" keyword overlap with bet title suggests this hypothesis may be affected by the ${anomalyRow.severity} severity anomaly.`,
      });
    }
  }

  return {
    anomalyId,
    metricId: anomalyRow.metricId,
    metricName: anomalyRow.metricName,
    affectedBets,
  };
}

export async function resolveAnomaly(
  workspaceId: string,
  productId: string,
  anomalyId: string,
  actorId: string,
): Promise<boolean> {
  const db = getDb();

  const row = (
    await db
      .select({ metricId: metricAnomalies.metricId })
      .from(metricAnomalies)
      .where(eq(metricAnomalies.id, anomalyId))
      .limit(1)
  )[0];

  if (!row) return false;

  // Verify workspace ownership via metric.
  const metric = await getMetricById(workspaceId, productId, row.metricId);
  if (!metric) return false;

  await db
    .update(metricAnomalies)
    .set({ isResolved: true, resolvedAt: new Date() })
    .where(eq(metricAnomalies.id, anomalyId));

  await emitAuditEvent({
    workspaceId,
    actorId,
    eventType: "metric_anomaly.resolved",
    resourceType: "metric_anomaly",
    resourceId: anomalyId,
  });

  return true;
}
