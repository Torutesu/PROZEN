// Spec Agent API routes (M2)
// POST   /api/v1/workspaces/:workspaceId/products/:productId/bets
// GET    /api/v1/workspaces/:workspaceId/products/:productId/bets
// GET    /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId
// PATCH  /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId
// POST   /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId/messages
// GET    /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId/conversation
// GET    /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId/versions
// POST   /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId/restore
// POST   /api/v1/workspaces/:workspaceId/products/:productId/bets/:betId/complete

import { apiError, createApp } from "./middleware.js";
import {
  completeBetSpec,
  createBetSpec,
  getBetSpecById,
  getBetSpecs,
  getBetSpecVersions,
  getConversation,
  restoreBetSpec,
  sendMessage,
  updateBetSpecStatus,
} from "../services/spec-store.js";
import { parsePaginationQuery } from "./pagination.js";

const app = createApp();
const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

// ---------------------------------------------------------------------------
// POST .../bets — create a new bet spec and start a conversation
// ---------------------------------------------------------------------------
app.post(`${BASE}/bets`, async (c) => {
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
  if (typeof b["title"] !== "string" || b["title"].trim().length < 3) {
    return apiError(c, 422, "invalid_payload", '"title" must be at least 3 characters.');
  }
  if (typeof b["message"] !== "string" || b["message"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"message" is required — describe your bet idea.');
  }

  try {
    const result = await createBetSpec({
      workspaceId,
      productId,
      title: b["title"].trim(),
      initialMessage: b["message"].trim(),
      createdBy: actorId,
      requestId,
    });

    return c.json(
      {
        bet_spec_id: result.betSpecId,
        conversation_id: result.conversationId,
        agent_reply: result.agentReply,
        agent_state: result.agentState,
        ...(result.spec ? { spec: result.spec } : {}),
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create bet spec.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../bets — list bet specs
// ---------------------------------------------------------------------------
app.get(`${BASE}/bets`, async (c) => {
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
    const result = await getBetSpecs(workspaceId, productId, limit, offset);
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list bet specs.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../bets/:betId — get a single bet spec with current version
// ---------------------------------------------------------------------------
app.get(`${BASE}/bets/:betId`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();

  try {
    const result = await getBetSpecById(workspaceId, productId, betId);
    if (!result) {
      return apiError(c, 404, "bet_spec_not_found", "Bet spec not found.", { workspaceId, betId });
    }
    return c.json({ meta: result.meta, spec: result.spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch bet spec.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// PATCH .../bets/:betId — update status
// ---------------------------------------------------------------------------
app.patch(`${BASE}/bets/:betId`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();
  const actorId = c.get("actorId");

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  const validStatuses = ["draft", "active", "completed", "cancelled"];
  if (typeof b["status"] !== "string" || !validStatuses.includes(b["status"])) {
    return apiError(c, 422, "invalid_payload", `"status" must be one of: ${validStatuses.join(", ")}.`);
  }

  try {
    const updated = await updateBetSpecStatus(
      workspaceId,
      productId,
      betId,
      b["status"],
      actorId,
    );
    if (!updated) {
      return apiError(c, 404, "bet_spec_not_found", "Bet spec not found.", { workspaceId, betId });
    }
    return c.json({ bet_spec_id: betId, status: b["status"] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update bet spec.";
    return apiError(c, 500, "update_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST .../bets/:betId/messages — send a conversation message
// ---------------------------------------------------------------------------
app.post(`${BASE}/bets/:betId/messages`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();
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
  if (typeof b["message"] !== "string" || b["message"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"message" must be a non-empty string.');
  }

  try {
    const result = await sendMessage({
      workspaceId,
      productId,
      betSpecId: betId,
      message: b["message"].trim(),
      actorId,
      requestId,
    });

    if (!result) {
      return apiError(c, 404, "bet_spec_not_found", "Bet spec not found.", { workspaceId, betId });
    }

    return c.json({
      agent_reply: result.agentReply,
      agent_state: result.agentState,
      ...(result.newVersionId ? { new_version_id: result.newVersionId, new_version_number: result.newVersionNumber } : {}),
      ...(result.spec ? { spec: result.spec } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process message.";
    return apiError(c, 500, "agent_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../bets/:betId/conversation — get full conversation history
// ---------------------------------------------------------------------------
app.get(`${BASE}/bets/:betId/conversation`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();

  try {
    const result = await getConversation(workspaceId, productId, betId);
    if (!result) {
      return apiError(c, 404, "conversation_not_found", "Conversation not found.", { workspaceId, betId });
    }
    return c.json({ messages: result.messages, agent_state: result.agentState });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch conversation.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../bets/:betId/versions — list spec versions
// ---------------------------------------------------------------------------
app.get(`${BASE}/bets/:betId/versions`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();
  const pagination = parsePaginationQuery(
    c.req.query("limit"),
    c.req.query("offset"),
  );
  if (!pagination.ok) {
    return apiError(c, 422, "invalid_query", pagination.message);
  }

  try {
    const { limit, offset } = pagination.value;
    const result = await getBetSpecVersions(
      workspaceId,
      productId,
      betId,
      limit,
      offset,
    );
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list versions.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST .../bets/:betId/restore — restore to a previous version
// ---------------------------------------------------------------------------
app.post(`${BASE}/bets/:betId/restore`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();
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
  const version = b["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return apiError(c, 422, "invalid_payload", '"version" must be a positive integer.');
  }

  try {
    const result = await restoreBetSpec(
      workspaceId,
      productId,
      betId,
      version,
      actorId,
      requestId,
    );
    if (!result) {
      return apiError(c, 404, "version_not_found", `Version ${version} not found.`, { workspaceId, betId, version });
    }
    return c.json({
      restored_from_version: result.restoredFromVersion,
      new_version: result.newVersionNumber,
      new_version_id: result.newVersionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed.";
    return apiError(c, 500, "restore_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST .../bets/:betId/complete — record outcome + AI learning summary
// ---------------------------------------------------------------------------
app.post(`${BASE}/bets/:betId/complete`, async (c) => {
  const { workspaceId, productId, betId } = c.req.param();
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
  if (typeof b["outcomeNote"] !== "string" || b["outcomeNote"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"outcomeNote" is required.');
  }

  try {
    const result = await completeBetSpec(
      workspaceId,
      productId,
      betId,
      (b["outcomeNote"] as string).trim(),
      actorId,
      requestId,
    );
    if (!result) {
      return apiError(c, 404, "bet_spec_not_found", "Bet spec not found.", { workspaceId, betId });
    }
    return c.json({
      ok: true,
      learning_summary: result.learningSummary,
      next_bet_hypothesis: result.nextBetHypothesis ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete bet.";
    return apiError(c, 500, "complete_error", message);
  }
});

export default app;
