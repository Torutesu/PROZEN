// Audit Events API routes (M1)
// GET /api/v1/workspaces/:workspaceId/audit-events

import { apiError, createApp } from "./middleware.js";
import { listAuditEvents } from "../services/audit-events.js";

const app = createApp();

app.get("/api/v1/workspaces/:workspaceId/audit-events", async (c) => {
  const { workspaceId } = c.req.param();
  const productId = c.req.query("productId");
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  if (!Number.isFinite(limit) || !Number.isFinite(offset)) {
    return apiError(c, 422, "invalid_query", '"limit" and "offset" must be valid numbers.');
  }

  try {
    const items = await listAuditEvents({
      workspaceId,
      ...(typeof productId === "string" && productId.length > 0 ? { productId } : {}),
      limit,
      offset,
    });
    return c.json({ total: items.length, limit, offset, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit events.";
    return apiError(c, 500, "fetch_error", message);
  }
});

export default app;

