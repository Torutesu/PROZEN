// Context Pack API routes (M1)
// POST /api/v1/workspaces/:workspaceId/products/:productId/context-pack/ingest
// GET  /api/v1/workspaces/:workspaceId/products/:productId/context-pack
// GET  /api/v1/workspaces/:workspaceId/products/:productId/context-pack/versions
// POST /api/v1/workspaces/:workspaceId/products/:productId/context-pack/restore
// POST /api/v1/workspaces/:workspaceId/products/:productId/context-pack/compress

import { apiError, createApp } from "./middleware.js";
import {
  compressContext,
  getCurrentContext,
  getContextVersions,
  ingestContext,
  restoreContext,
} from "../services/context-layer.js";
import {
  buildRequestHash,
  checkIdempotency,
  saveIdempotencyResponse,
} from "../services/idempotency.js";
import { parsePaginationQuery } from "./pagination.js";

const app = createApp();

const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

// POST .../context-pack/ingest
app.post(`${BASE}/context-pack/ingest`, async (c) => {
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

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>)["input"] !== "string" ||
    ((body as Record<string, unknown>)["input"] as string).trim().length === 0
  ) {
    return apiError(c, 422, "invalid_payload", 'Field "input" must be a non-empty string.');
  }

  const b = body as Record<string, unknown>;
  const rawInput = b["input"] as string;
  const tags = Array.isArray(b["tags"])
    ? b["tags"].filter((t): t is string => typeof t === "string")
    : undefined;

  try {
    const payload =
      tags !== undefined
        ? {
            workspaceId,
            productId,
            rawInput,
            createdBy: actorId,
            requestId,
            tags,
          }
        : {
            workspaceId,
            productId,
            rawInput,
            createdBy: actorId,
            requestId,
          };
    const result = await ingestContext(payload);
    const responseBody = {
      job_id: result.jobId,
      status: result.status,
      provisional_version: {
        context_pack_id: result.contextPackId,
        version: result.versionNumber,
        version_id: result.versionId,
        created_at: result.createdAt,
      },
    };
    if (idempotencyKey) {
      await saveIdempotencyResponse({
        workspaceId,
        idempotencyKey,
        requestHash: buildRequestHash(c.req.method, c.req.path, rawBody),
        statusCode: 202,
        responseBody,
      });
    }
    return c.json(responseBody, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed.";
    return apiError(c, 500, "ingest_error", message);
  }
});

// GET .../context-pack
app.get(`${BASE}/context-pack`, async (c) => {
  const { workspaceId, productId } = c.req.param();

  try {
    const current = await getCurrentContext(workspaceId, productId);
    if (!current) {
      return apiError(c, 404, "context_pack_not_found", "No context pack found.", { workspaceId, productId });
    }
    return c.json({ context_pack_id: current.contextPackId, current_version: current.version, data: current });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch context pack.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// GET .../context-pack/versions
app.get(`${BASE}/context-pack/versions`, async (c) => {
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
    const versions = await getContextVersions(workspaceId, productId, limit, offset);
    return c.json({ total: versions.total, limit, offset, items: versions.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list versions.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// POST .../context-pack/restore
app.post(`${BASE}/context-pack/restore`, async (c) => {
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
  const version = b["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return apiError(c, 422, "invalid_payload", '"version" must be a positive integer.');
  }

  try {
    const result = await restoreContext({ workspaceId, productId, restoreToVersion: version, createdBy: actorId, requestId });
    if (!result) {
      return apiError(c, 404, "version_not_found", `Version ${version} not found.`, { workspaceId, productId, version });
    }
    const responseBody = {
      restored_from_version: result.restoredFromVersion,
      new_version: result.newVersionNumber,
      version_id: result.versionId,
      context_pack_id: result.contextPackId,
      created_at: result.createdAt,
    };
    if (idempotencyKey) {
      await saveIdempotencyResponse({
        workspaceId,
        idempotencyKey,
        requestHash: buildRequestHash(c.req.method, c.req.path, rawBody),
        statusCode: 200,
        responseBody,
      });
    }
    return c.json(responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed.";
    return apiError(c, 500, "restore_error", message);
  }
});

// POST .../context-pack/compress
app.post(`${BASE}/context-pack/compress`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const requestId = c.get("requestId");

  let body: unknown = {};
  try {
    const raw = await c.req.text();
    if (raw.length > 0) body = JSON.parse(raw) as unknown;
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  const aggressiveness = b["aggressiveness"];
  if (
    aggressiveness !== undefined &&
    (typeof aggressiveness !== "number" || aggressiveness < 0 || aggressiveness > 1)
  ) {
    return apiError(c, 422, "invalid_payload", '"aggressiveness" must be a number between 0 and 1.');
  }

  try {
    const result = await compressContext({
      workspaceId,
      productId,
      createdBy: actorId,
      requestId,
      ...(typeof aggressiveness === "number" ? { aggressiveness } : {}),
    });
    if (!result) {
      return apiError(c, 404, "context_pack_not_found", "No context pack found to compress.", { workspaceId, productId });
    }
    return c.json({
      version_id: result.versionId,
      version: result.versionNumber,
      context_pack_id: result.contextPackId,
      compression_ratio: result.compressionRatio,
      provider: result.provider,
      model: result.model,
      latency_ms: result.latencyMs,
      fallback_used: result.fallbackUsed,
      created_at: result.createdAt,
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compression failed.";
    return apiError(c, 500, "compress_error", message);
  }
});

export default app;
