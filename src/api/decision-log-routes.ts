// Decision Log API routes (M1)
// POST /api/v1/workspaces/:workspaceId/products/:productId/decision-logs
// GET  /api/v1/workspaces/:workspaceId/products/:productId/decision-logs
// GET  /api/v1/workspaces/:workspaceId/products/:productId/decision-logs/:decisionLogId

import { apiError, createApp } from "./middleware.js";
import {
  createDecisionLog,
  getDecisionLogById,
  getDecisionLogs,
} from "../services/context-layer.js";
import {
  buildRequestHash,
  checkIdempotency,
  saveIdempotencyResponse,
} from "../services/idempotency.js";
import { parsePaginationQuery } from "./pagination.js";

const app = createApp();

const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

// POST .../decision-logs
app.post(`${BASE}/decision-logs`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const requestId = c.get("requestId");
  const idempotencyKey = c.req.header("idempotency-key");

  let rawBody = "";
  let body: unknown;
  try {
    rawBody = await c.req.text();
    body = rawBody.length > 0 ? (JSON.parse(rawBody) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  if (idempotencyKey) {
    const requestHash = buildRequestHash(c.req.method, c.req.path, rawBody);
    const idem = await checkIdempotency({
      workspaceId,
      idempotencyKey,
      requestHash,
    });
    if (idem.type === "conflict") {
      return apiError(c, 409, "idempotency_conflict", "Idempotency key reuse with different payload.");
    }
    if (idem.type === "replay") {
      c.header("x-idempotent-replay", "true");
      return c.json(idem.responseBody, idem.statusCode as 200 | 201 | 202);
    }
  }

  const b = body as Record<string, unknown>;
  if (typeof b["title"] !== "string" || typeof b["decision"] !== "string" || typeof b["rationale"] !== "string") {
    return apiError(c, 422, "invalid_payload", '"title", "decision", and "rationale" are required strings.');
  }

  const alternatives = Array.isArray(b["alternatives"])
    ? b["alternatives"].filter((x): x is string => typeof x === "string")
    : [];
  const evidenceLinks = Array.isArray(b["evidenceLinks"])
    ? b["evidenceLinks"].filter((x): x is string => typeof x === "string")
    : [];

  try {
    const record = await createDecisionLog({
      workspaceId,
      productId,
      title: b["title"],
      decision: b["decision"],
      rationale: b["rationale"],
      alternatives,
      evidenceLinks,
      createdBy: actorId,
      requestId,
    });
    if (idempotencyKey) {
      await saveIdempotencyResponse({
        workspaceId,
        idempotencyKey,
        requestHash: buildRequestHash(c.req.method, c.req.path, rawBody),
        statusCode: 201,
        responseBody: record,
      });
    }
    return c.json(record, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create decision log.";
    return apiError(c, 500, "create_error", message);
  }
});

// GET .../decision-logs
app.get(`${BASE}/decision-logs`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const pagination = parsePaginationQuery(
    c.req.query("limit"),
    c.req.query("offset"),
  );
  if (!pagination.ok) {
    return apiError(c, 422, "invalid_query", pagination.message);
  }

  try {
    const { limit, offset } = pagination.value;
    const result = await getDecisionLogs(workspaceId, productId, limit, offset);
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list decision logs.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// GET .../decision-logs/:decisionLogId
app.get(`${BASE}/decision-logs/:decisionLogId`, async (c) => {
  const { workspaceId, productId, decisionLogId } = c.req.param();

  try {
    const item = await getDecisionLogById(workspaceId, productId, decisionLogId);
    if (!item) {
      return apiError(c, 404, "decision_log_not_found", "Decision log not found.", { workspaceId, productId, decisionLogId });
    }
    return c.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch decision log.";
    return apiError(c, 500, "fetch_error", message);
  }
});

export default app;
