// Daily Briefing routes (M10)
// GET /api/v1/workspaces/:workspaceId/products/:productId/daily-briefing

import { apiError, createApp } from "./middleware.js";
import { getDailyBriefing } from "../services/briefing-store.js";
import { getProductById, getWorkspaceById } from "../services/workspace-store.js";

const app = createApp();
const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

app.get(`${BASE}/daily-briefing`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");

  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return apiError(c, 404, "not_found", "Workspace not found.");
  }

  const product = await getProductById(workspaceId, productId);
  if (!product) {
    return apiError(c, 404, "not_found", "Product not found.");
  }

  try {
    const briefing = await getDailyBriefing(workspaceId, productId);
    return c.json(briefing);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate briefing.";
    return apiError(c, 500, "briefing_error", message);
  }
});

export default app;
