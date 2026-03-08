// Audit Events API routes (M1)
// GET /api/v1/workspaces/:workspaceId/audit-events

import { apiError, createApp } from "./middleware.js";
import { listAuditEvents } from "../services/audit-events.js";
import { parsePaginationQuery } from "./pagination.js";

const app = createApp();

app.get("/api/v1/workspaces/:workspaceId/audit-events", async (c) => {
  const { workspaceId } = c.req.param();
  const productId = c.req.query("productId");
  const pagination = parsePaginationQuery(
    c.req.query("limit"),
    c.req.query("offset"),
  );
  if (!pagination.ok) {
    return apiError(c, 422, "invalid_query", pagination.message);
  }

  try {
    const { limit, offset } = pagination.value;
    const result = await listAuditEvents({
      workspaceId,
      ...(typeof productId === "string" && productId.length > 0 ? { productId } : {}),
      limit,
      offset,
    });
    return c.json({ total: result.total, limit, offset, items: result.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit events.";
    return apiError(c, 500, "fetch_error", message);
  }
});

export default app;
