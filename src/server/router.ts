import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { AuditStore } from "./audit-store.js";
import { ContextLayerStore } from "./context-layer-store.js";
import { IdempotencyStore } from "./idempotency-store.js";
import {
  getRequestId,
  parseJsonBody,
  readRawBody,
  sendError,
  sendJson
} from "./http-utils.js";

const workspaceRoute = /^\/api\/v1\/workspaces\/([^/]+)\/products\/([^/]+)\/(.+)$/;
const decisionLogByIdRoute =
  /^\/api\/v1\/workspaces\/([^/]+)\/products\/([^/]+)\/decision-logs\/([^/]+)$/;
const workspaceAuditRoute = /^\/api\/v1\/workspaces\/([^/]+)\/audit-events$/;

const contextStore = new ContextLayerStore();
const idempotencyStore = new IdempotencyStore();
const auditStore = new AuditStore();

const readSchema = async (filename: string) => {
  const schemaPath = path.resolve(process.cwd(), "schemas", filename);
  const raw = await readFile(schemaPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const parseWorkspacePath = (pathname: string) => {
  const m = pathname.match(workspaceRoute);
  if (!m) {
    return null;
  }
  const workspaceId = m[1];
  const productId = m[2];
  const suffix = m[3];
  if (!workspaceId || !productId || !suffix) {
    return null;
  }
  return { workspaceId, productId, suffix };
};

const parseDecisionByIdPath = (pathname: string) => {
  const m = pathname.match(decisionLogByIdRoute);
  if (!m) {
    return null;
  }
  const workspaceId = m[1];
  const productId = m[2];
  const decisionLogId = m[3];
  if (!workspaceId || !productId || !decisionLogId) {
    return null;
  }
  return { workspaceId, productId, decisionLogId };
};

const parseWorkspaceAuditPath = (pathname: string) => {
  const m = pathname.match(workspaceAuditRoute);
  if (!m) {
    return null;
  }
  const workspaceId = m[1];
  if (!workspaceId) {
    return null;
  }
  return { workspaceId };
};

const getActorId = (req: IncomingMessage): string => {
  const actor = req.headers["x-actor-id"];
  if (typeof actor === "string" && actor.length > 0) {
    return actor;
  }
  return "system";
};

const getIdempotencyKey = (req: IncomingMessage): string | null => {
  const key = req.headers["idempotency-key"];
  if (typeof key === "string" && key.trim().length > 0) {
    return key.trim();
  }
  return null;
};

const checkIdempotency = (
  req: IncomingMessage,
  res: ServerResponse,
  workspaceId: string,
  requestId: string,
  method: string,
  pathname: string,
  rawBody: string
): { idempotencyKey: string; requestHash: string } | null => {
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return null;
  }

  const requestHash = IdempotencyStore.buildRequestHash(method, pathname, rawBody);
  const check = idempotencyStore.check(workspaceId, idempotencyKey, requestHash);
  if (check.type === "conflict") {
    sendError(res, 409, {
      code: "IDEMPOTENCY_CONFLICT",
      message: "Idempotency key already used with a different request payload.",
      request_id: requestId
    });
    return null;
  }
  if (check.type === "replay") {
    sendJson(res, check.response.statusCode, check.response.body, requestId, {
      "x-idempotent-replay": "true"
    });
    return null;
  }
  return { idempotencyKey, requestHash };
};

const saveIdempotentResponse = (
  workspaceId: string,
  context: { idempotencyKey: string; requestHash: string } | null,
  statusCode: number,
  body: unknown
) => {
  if (!context) {
    return;
  }
  idempotencyStore.save(
    workspaceId,
    context.idempotencyKey,
    context.requestHash,
    statusCode,
    body
  );
};

const parseBody = async (
  req: IncomingMessage,
  requestId: string,
  res: ServerResponse
): Promise<{ rawBody: string; body: unknown } | null> => {
  try {
    const rawBody = await readRawBody(req);
    const body = parseJsonBody(rawBody);
    return { rawBody, body };
  } catch {
    sendError(res, 400, {
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      request_id: requestId
    });
    return null;
  }
};

export const routeRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const requestId = getRequestId(req);
  const actorId = getActorId(req);
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

  if (pathname === "/healthz" && method === "GET") {
    sendJson(res, 200, { status: "ok", service: "prozen-docs-runtime" }, requestId);
    return;
  }

  if (pathname === "/schema/bet-spec" && method === "GET") {
    try {
      const schema = await readSchema("bet-spec.schema.json");
      sendJson(res, 200, schema, requestId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "failed_to_read_schema";
      sendError(res, 500, {
        code: "SCHEMA_READ_ERROR",
        message,
        request_id: requestId
      });
    }
    return;
  }

  if (pathname === "/schema/context-pack" && method === "GET") {
    try {
      const schema = await readSchema("context-pack.schema.json");
      sendJson(res, 200, schema, requestId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "failed_to_read_schema";
      sendError(res, 500, {
        code: "SCHEMA_READ_ERROR",
        message,
        request_id: requestId
      });
    }
    return;
  }

  const auditRoute = parseWorkspaceAuditPath(pathname);
  if (auditRoute && method === "GET") {
    const limitRaw = parsed.searchParams.get("limit");
    const productId = parsed.searchParams.get("productId") ?? undefined;
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
    const options =
      productId !== undefined
        ? { productId, limit: Number.isFinite(limit) ? limit : 50 }
        : { limit: Number.isFinite(limit) ? limit : 50 };
    const events = auditStore.listByWorkspace(auditRoute.workspaceId, options);
    sendJson(res, 200, { total: events.length, items: events }, requestId);
    return;
  }

  const decisionById = parseDecisionByIdPath(pathname);
  if (decisionById && method === "GET") {
    const { workspaceId, productId, decisionLogId } = decisionById;
    const item = contextStore.getDecisionLogById(workspaceId, productId, decisionLogId);
    if (!item) {
      sendError(res, 404, {
        code: "DECISION_LOG_NOT_FOUND",
        message: "Decision log not found.",
        request_id: requestId,
        details: { workspaceId, productId, decisionLogId }
      });
      return;
    }
    sendJson(res, 200, item, requestId);
    return;
  }

  const matched = parseWorkspacePath(pathname);
  if (!matched) {
    sendError(res, 404, {
      code: "NOT_FOUND",
      message: "Route not found.",
      request_id: requestId
    });
    return;
  }

  const { workspaceId, productId, suffix } = matched;

  if (suffix === "context-pack:ingest" && method === "POST") {
    const parsedBody = await parseBody(req, requestId, res);
    if (!parsedBody) {
      return;
    }
    const { rawBody, body } = parsedBody;
    const idem = checkIdempotency(req, res, workspaceId, requestId, method, pathname, rawBody);
    if (getIdempotencyKey(req) && !idem) {
      return;
    }
    if (!isObject(body) || typeof body.input !== "string" || body.input.trim().length === 0) {
      sendError(res, 400, {
        code: "INVALID_PAYLOAD",
        message: "Expected JSON body with non-empty string field `input`.",
        request_id: requestId
      });
      return;
    }

    const createdBy = typeof body.createdBy === "string" ? body.createdBy : actorId;
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((item): item is string => typeof item === "string")
      : undefined;
    const ingestPayload =
      tags && tags.length > 0
        ? { workspaceId, productId, input: body.input, tags, createdBy }
        : { workspaceId, productId, input: body.input, createdBy };
    const result = contextStore.ingestContext(ingestPayload);
    const responseBody = {
      job_id: result.jobId,
      status: result.status,
      provisional_version: {
        context_pack_id: result.version.contextPackId,
        version: result.version.version,
        created_at: result.version.createdAt
      }
    };
    saveIdempotentResponse(workspaceId, idem, 202, responseBody);
    auditStore.record({
      workspaceId,
      productId,
      actorId: createdBy,
      eventType: "context_pack.ingested",
      resourceType: "context_pack_version",
      resourceId: `${result.version.contextPackId}@${result.version.version}`,
      requestId,
      metadata: { source: result.version.source }
    });
    sendJson(res, 202, responseBody, requestId);
    return;
  }

  if (suffix === "context-pack" && method === "GET") {
    const current = contextStore.getCurrentContext(workspaceId, productId);
    if (!current) {
      sendError(res, 404, {
        code: "CONTEXT_PACK_NOT_FOUND",
        message: "Context pack does not exist for this workspace/product.",
        request_id: requestId,
        details: { workspaceId, productId }
      });
      return;
    }

    sendJson(
      res,
      200,
      {
        context_pack_id: current.contextPackId,
        current_version: current.version,
        data: current
      },
      requestId
    );
    return;
  }

  if (suffix === "context-pack/versions" && method === "GET") {
    const versions = contextStore.getContextVersions(workspaceId, productId);
    sendJson(
      res,
      200,
      {
        total: versions.length,
        items: versions
      },
      requestId
    );
    return;
  }

  if (suffix === "context-pack:restore" && method === "POST") {
    const parsedBody = await parseBody(req, requestId, res);
    if (!parsedBody) {
      return;
    }
    const { rawBody, body } = parsedBody;
    const idem = checkIdempotency(req, res, workspaceId, requestId, method, pathname, rawBody);
    if (getIdempotencyKey(req) && !idem) {
      return;
    }
    if (!isObject(body) || typeof body.version !== "number" || body.version < 1) {
      sendError(res, 400, {
        code: "INVALID_PAYLOAD",
        message: "Expected JSON body with numeric field `version` >= 1.",
        request_id: requestId
      });
      return;
    }

    const createdBy = typeof body.createdBy === "string" ? body.createdBy : actorId;
    const restored = contextStore.restoreContext(workspaceId, productId, body.version, createdBy);
    if (!restored) {
      sendError(res, 404, {
        code: "CONTEXT_VERSION_NOT_FOUND",
        message: "Requested version was not found.",
        request_id: requestId,
        details: { workspaceId, productId, version: body.version }
      });
      return;
    }

    const responseBody = {
      restored_from_version: body.version,
      new_version: restored.version,
      data: restored
    };
    saveIdempotentResponse(workspaceId, idem, 200, responseBody);
    auditStore.record({
      workspaceId,
      productId,
      actorId: createdBy,
      eventType: "context_pack.restored",
      resourceType: "context_pack_version",
      resourceId: `${restored.contextPackId}@${restored.version}`,
      requestId,
      metadata: { restoredFromVersion: body.version }
    });
    sendJson(res, 200, responseBody, requestId);
    return;
  }

  if (suffix === "decision-logs" && method === "POST") {
    const parsedBody = await parseBody(req, requestId, res);
    if (!parsedBody) {
      return;
    }
    const { rawBody, body } = parsedBody;
    const idem = checkIdempotency(req, res, workspaceId, requestId, method, pathname, rawBody);
    if (getIdempotencyKey(req) && !idem) {
      return;
    }
    if (
      !isObject(body) ||
      typeof body.title !== "string" ||
      typeof body.decision !== "string" ||
      typeof body.rationale !== "string"
    ) {
      sendError(res, 400, {
        code: "INVALID_PAYLOAD",
        message: "Expected JSON body with `title`, `decision`, and `rationale` as strings.",
        request_id: requestId
      });
      return;
    }

    const alternatives = Array.isArray(body.alternatives)
      ? body.alternatives.filter((x): x is string => typeof x === "string")
      : [];
    const evidenceLinks = Array.isArray(body.evidenceLinks)
      ? body.evidenceLinks.filter((x): x is string => typeof x === "string")
      : [];
    const createdBy = typeof body.createdBy === "string" ? body.createdBy : actorId;

    const item = contextStore.createDecisionLog({
      workspaceId,
      productId,
      title: body.title,
      decision: body.decision,
      rationale: body.rationale,
      alternatives,
      evidenceLinks,
      createdBy
    });
    saveIdempotentResponse(workspaceId, idem, 201, item);
    auditStore.record({
      workspaceId,
      productId,
      actorId: createdBy,
      eventType: "decision_log.created",
      resourceType: "decision_log",
      resourceId: item.id,
      requestId,
      metadata: { title: item.title }
    });
    sendJson(res, 201, item, requestId);
    return;
  }

  if (suffix === "decision-logs" && method === "GET") {
    const items = contextStore.getDecisionLogs(workspaceId, productId);
    sendJson(res, 200, { total: items.length, items }, requestId);
    return;
  }

  sendError(res, 404, {
    code: "NOT_FOUND",
    message: "Route not found.",
    request_id: requestId,
    details: { method, path: pathname }
  });
};
