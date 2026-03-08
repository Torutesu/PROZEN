// Review routes (evening_review, weekly_retro)
// GET /api/v1/workspaces/:workspaceId/products/:productId/reviews/:type
//   type: "evening_review" | "weekly_retro"

import { apiError, createApp } from "./middleware.js";
import { getEveningReview, getWeeklyRetro } from "../services/review-store.js";
import { getProductById, getWorkspaceById } from "../services/workspace-store.js";

const app = createApp();
const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

const ALLOWED_TYPES = ["evening_review", "weekly_retro"] as const;
type ReviewType = (typeof ALLOWED_TYPES)[number];

app.get(`${BASE}/reviews/:type`, async (c) => {
  const { workspaceId, productId, type } = c.req.param();
  const actorId = c.get("actorId");

  if (!ALLOWED_TYPES.includes(type as ReviewType)) {
    return apiError(c, 400, "invalid_type", `type must be one of: ${ALLOWED_TYPES.join(", ")}`);
  }

  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) return apiError(c, 404, "not_found", "Workspace not found.");

  const product = await getProductById(workspaceId, productId);
  if (!product) return apiError(c, 404, "not_found", "Product not found.");

  try {
    const review =
      type === "evening_review"
        ? await getEveningReview(workspaceId, productId)
        : await getWeeklyRetro(workspaceId, productId);
    return c.json(review);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate review.";
    return apiError(c, 500, "review_error", message);
  }
});

export default app;
