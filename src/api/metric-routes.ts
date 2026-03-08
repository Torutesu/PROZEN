// Metric API routes (M3)
// POST   /api/v1/workspaces/:workspaceId/products/:productId/metrics
// GET    /api/v1/workspaces/:workspaceId/products/:productId/metrics?layer=
// GET    /api/v1/workspaces/:workspaceId/products/:productId/metrics/:metricId
// PATCH  /api/v1/workspaces/:workspaceId/products/:productId/metrics/:metricId
// POST   /api/v1/workspaces/:workspaceId/products/:productId/metrics/:metricId/readings
// GET    /api/v1/workspaces/:workspaceId/products/:productId/metrics/:metricId/readings
// GET    /api/v1/workspaces/:workspaceId/products/:productId/anomalies
// POST   /api/v1/workspaces/:workspaceId/products/:productId/anomalies/:anomalyId/resolve

import { apiError, createApp } from "./middleware.js";
import {
  addReading,
  createMetric,
  getAnomalies,
  getMetricById,
  getMetrics,
  getReadings,
  resolveAnomaly,
  updateMetric,
  type MetricLayer,
} from "../services/metric-store.js";

const app = createApp();
const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

const VALID_LAYERS: MetricLayer[] = ["bet", "kpi", "activity"];

// ---------------------------------------------------------------------------
// POST .../metrics
// ---------------------------------------------------------------------------
app.post(`${BASE}/metrics`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const requestId = c.get("requestId");

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;

  if (typeof b["name"] !== "string" || b["name"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"name" is required.');
  }
  if (!VALID_LAYERS.includes(b["layer"] as MetricLayer)) {
    return apiError(c, 422, "invalid_payload", `"layer" must be one of: ${VALID_LAYERS.join(", ")}.`);
  }
  if (b["direction"] !== undefined && b["direction"] !== "increase" && b["direction"] !== "decrease") {
    return apiError(c, 422, "invalid_payload", '"direction" must be "increase" or "decrease".');
  }

  const targetValue = b["targetValue"] !== undefined ? Number(b["targetValue"]) : undefined;
  const baselineValue = b["baselineValue"] !== undefined ? Number(b["baselineValue"]) : undefined;

  if (targetValue !== undefined && isNaN(targetValue)) {
    return apiError(c, 422, "invalid_payload", '"targetValue" must be a number.');
  }
  if (baselineValue !== undefined && isNaN(baselineValue)) {
    return apiError(c, 422, "invalid_payload", '"baselineValue" must be a number.');
  }

  try {
    const record = await createMetric({
      workspaceId,
      productId,
      name: (b["name"] as string).trim(),
      description: typeof b["description"] === "string" ? b["description"] : undefined,
      layer: b["layer"] as MetricLayer,
      unit: typeof b["unit"] === "string" ? b["unit"] : undefined,
      direction: (b["direction"] as "increase" | "decrease" | undefined) ?? "increase",
      ...(targetValue !== undefined ? { targetValue } : {}),
      ...(baselineValue !== undefined ? { baselineValue } : {}),
      betSpecId: typeof b["betSpecId"] === "string" ? b["betSpecId"] : undefined,
      createdBy: actorId,
      requestId,
    });
    return c.json(record, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create metric.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../metrics
// ---------------------------------------------------------------------------
app.get(`${BASE}/metrics`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const rawLayer = c.req.query("layer");
  const rawLimit = c.req.query("limit");
  const rawOffset = c.req.query("offset");

  if (rawLayer && !VALID_LAYERS.includes(rawLayer as MetricLayer)) {
    return apiError(c, 422, "invalid_query", `"layer" must be one of: ${VALID_LAYERS.join(", ")}.`);
  }

  const parsedLimit = rawLimit === undefined ? 100 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return apiError(c, 422, "invalid_query", '"limit" must be a positive integer.');
  }
  const limit = Math.min(parsedLimit, 200);

  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    return apiError(c, 422, "invalid_query", '"offset" must be a non-negative integer.');
  }

  try {
    const result = await getMetrics(
      workspaceId,
      productId,
      rawLayer as MetricLayer | undefined,
      limit,
      offset,
    );
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list metrics.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../metrics/:metricId
// ---------------------------------------------------------------------------
app.get(`${BASE}/metrics/:metricId`, async (c) => {
  const { workspaceId, productId, metricId } = c.req.param();

  try {
    const metric = await getMetricById(workspaceId, productId, metricId);
    if (!metric) {
      return apiError(c, 404, "metric_not_found", "Metric not found.", { workspaceId, metricId });
    }
    return c.json(metric);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch metric.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// PATCH .../metrics/:metricId
// ---------------------------------------------------------------------------
app.patch(`${BASE}/metrics/:metricId`, async (c) => {
  const { workspaceId, productId, metricId } = c.req.param();
  const actorId = c.get("actorId");

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateMetric>[3] = {};

  if (b["name"] !== undefined) {
    if (typeof b["name"] !== "string" || b["name"].trim().length === 0) {
      return apiError(c, 422, "invalid_payload", '"name" must be a non-empty string.');
    }
    patch.name = b["name"].trim();
  }
  if (b["description"] !== undefined) patch.description = String(b["description"]);
  if (b["targetValue"] !== undefined) {
    const v = Number(b["targetValue"]);
    if (isNaN(v)) return apiError(c, 422, "invalid_payload", '"targetValue" must be a number.');
    patch.targetValue = v;
  }
  if (b["baselineValue"] !== undefined) {
    const v = Number(b["baselineValue"]);
    if (isNaN(v)) return apiError(c, 422, "invalid_payload", '"baselineValue" must be a number.');
    patch.baselineValue = v;
  }
  if (b["isActive"] !== undefined) patch.isActive = Boolean(b["isActive"]);
  if (b["betSpecId"] !== undefined) patch.betSpecId = String(b["betSpecId"]);

  try {
    const updated = await updateMetric(
      workspaceId,
      productId,
      metricId,
      patch,
      actorId,
    );
    if (!updated) {
      return apiError(c, 404, "metric_not_found", "Metric not found.", { workspaceId, metricId });
    }
    return c.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update metric.";
    return apiError(c, 500, "update_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST .../metrics/:metricId/readings
// ---------------------------------------------------------------------------
app.post(`${BASE}/metrics/:metricId/readings`, async (c) => {
  const { workspaceId, productId, metricId } = c.req.param();
  const actorId = c.get("actorId");
  const requestId = c.get("requestId");

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  const value = Number(b["value"]);
  if (b["value"] === undefined || isNaN(value)) {
    return apiError(c, 422, "invalid_payload", '"value" must be a number.');
  }

  try {
    const result = await addReading({
      workspaceId,
      productId,
      metricId,
      value,
      recordedAt: typeof b["recordedAt"] === "string" ? b["recordedAt"] : undefined,
      source: typeof b["source"] === "string" ? b["source"] : "manual",
      note: typeof b["note"] === "string" ? b["note"] : undefined,
      createdBy: actorId,
      requestId,
    });

    if (!result) {
      return apiError(c, 404, "metric_not_found", "Metric not found.", { workspaceId, metricId });
    }

    return c.json(
      {
        reading: result.reading,
        ...(result.anomaly ? { anomaly: result.anomaly } : {}),
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add reading.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../metrics/:metricId/readings
// ---------------------------------------------------------------------------
app.get(`${BASE}/metrics/:metricId/readings`, async (c) => {
  const { workspaceId, productId, metricId } = c.req.param();
  const rawLimit = c.req.query("limit");
  const rawOffset = c.req.query("offset");

  const parsedLimit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return apiError(c, 422, "invalid_query", '"limit" must be a positive integer.');
  }
  const limit = Math.min(parsedLimit, 200);

  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    return apiError(c, 422, "invalid_query", '"offset" must be a non-negative integer.');
  }

  try {
    const result = await getReadings(
      workspaceId,
      productId,
      metricId,
      limit,
      offset,
    );
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list readings.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../anomalies
// ---------------------------------------------------------------------------
app.get(`${BASE}/anomalies`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const includeResolved = c.req.query("includeResolved") === "true";
  const rawLimit = c.req.query("limit");
  const rawOffset = c.req.query("offset");

  const parsedLimit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return apiError(c, 422, "invalid_query", '"limit" must be a positive integer.');
  }
  const limit = Math.min(parsedLimit, 200);

  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    return apiError(c, 422, "invalid_query", '"offset" must be a non-negative integer.');
  }

  try {
    const result = await getAnomalies(workspaceId, productId, includeResolved, limit, offset);
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list anomalies.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST .../anomalies/:anomalyId/resolve
// ---------------------------------------------------------------------------
app.post(`${BASE}/anomalies/:anomalyId/resolve`, async (c) => {
  const { workspaceId, productId, anomalyId } = c.req.param();
  const actorId = c.get("actorId");

  try {
    const resolved = await resolveAnomaly(
      workspaceId,
      productId,
      anomalyId,
      actorId,
    );
    if (!resolved) {
      return apiError(c, 404, "anomaly_not_found", "Anomaly not found.", { workspaceId, anomalyId });
    }
    return c.json({ anomaly_id: anomalyId, is_resolved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve anomaly.";
    return apiError(c, 500, "resolve_error", message);
  }
});

export default app;
