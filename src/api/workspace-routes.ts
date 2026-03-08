// Workspace & Product routes (M5)
// GET    /api/v1/workspaces                         — list my workspaces
// POST   /api/v1/workspaces                         — create workspace
// POST   /api/v1/workspaces/onboarding/setup        — one-shot setup
// GET    /api/v1/workspaces/:wId                    — get workspace
// GET    /api/v1/workspaces/:wId/products           — list products
// POST   /api/v1/workspaces/:wId/products           — create product
// GET    /api/v1/workspaces/:wId/products/:pId      — get product
// PATCH  /api/v1/workspaces/:wId/products/:pId      — update product

import { apiError, createApp } from "./middleware.js";
import {
  createWorkspace,
  getWorkspacesByOwner,
  getWorkspaceById,
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  setupOnboarding,
} from "../services/workspace-store.js";

const app = createApp();

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces
// ---------------------------------------------------------------------------
app.get("/api/v1/workspaces", async (c) => {
  const actorId = c.get("actorId");
  try {
    const items = await getWorkspacesByOwner(actorId);
    return c.json({ total: items.length, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list workspaces.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces
// ---------------------------------------------------------------------------
app.post("/api/v1/workspaces", async (c) => {
  const actorId = c.get("actorId");

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

  try {
    const workspace = await createWorkspace(b["name"] as string, actorId);
    return c.json(workspace, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create workspace.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces/onboarding/setup
// ---------------------------------------------------------------------------
app.post("/api/v1/workspaces/onboarding/setup", async (c) => {
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
  if (typeof b["productName"] !== "string" || b["productName"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"productName" is required.');
  }
  if (typeof b["skipFirstBet"] !== "boolean") {
    return apiError(c, 422, "invalid_payload", '"skipFirstBet" must be boolean.');
  }
  if (b["firstBetIdea"] !== undefined && typeof b["firstBetIdea"] !== "string") {
    return apiError(c, 422, "invalid_payload", '"firstBetIdea" must be string when provided.');
  }

  try {
    const result = await setupOnboarding({
      workspaceName:
        typeof b["workspaceName"] === "string" ? b["workspaceName"] : b["productName"],
      productName: b["productName"] as string,
      productDescription:
        typeof b["productDescription"] === "string" ? b["productDescription"] : undefined,
      mainKpi: typeof b["mainKpi"] === "string" ? b["mainKpi"] : undefined,
      firstBetIdea:
        typeof b["firstBetIdea"] === "string" ? b["firstBetIdea"] : undefined,
      skipFirstBet: b["skipFirstBet"] as boolean,
      actorId,
      requestId,
    });

    return c.json(
      {
        workspace: result.workspace,
        product: result.product,
        bet_spec_id: result.betSpecId,
        warnings: result.warnings,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set up onboarding.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces/:workspaceId
// ---------------------------------------------------------------------------
app.get("/api/v1/workspaces/:workspaceId", async (c) => {
  const { workspaceId } = c.req.param();
  const actorId = c.get("actorId");

  try {
    const workspace = await getWorkspaceById(workspaceId, actorId);
    if (!workspace) {
      return apiError(c, 404, "not_found", "Workspace not found.");
    }
    return c.json(workspace);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch workspace.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces/:workspaceId/products
// ---------------------------------------------------------------------------
app.get("/api/v1/workspaces/:workspaceId/products", async (c) => {
  const { workspaceId } = c.req.param();
  const actorId = c.get("actorId");

  // Verify workspace ownership
  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return apiError(c, 404, "not_found", "Workspace not found.");
  }

  try {
    const items = await getProducts(workspaceId);
    return c.json({ total: items.length, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list products.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces/:workspaceId/products
// ---------------------------------------------------------------------------
app.post("/api/v1/workspaces/:workspaceId/products", async (c) => {
  const { workspaceId } = c.req.param();
  const actorId = c.get("actorId");

  // Verify workspace ownership
  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return apiError(c, 404, "not_found", "Workspace not found.");
  }

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

  try {
    const product = await createProduct(workspaceId, b["name"] as string);
    return c.json(product, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create product.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces/:workspaceId/products/:productId
// ---------------------------------------------------------------------------
app.get("/api/v1/workspaces/:workspaceId/products/:productId", async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");

  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return apiError(c, 404, "not_found", "Workspace not found.");
  }

  try {
    const product = await getProductById(workspaceId, productId);
    if (!product) {
      return apiError(c, 404, "not_found", "Product not found.");
    }
    return c.json(product);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch product.";
    return apiError(c, 500, "fetch_error", message);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/workspaces/:workspaceId/products/:productId
// ---------------------------------------------------------------------------
app.patch("/api/v1/workspaces/:workspaceId/products/:productId", async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");

  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return apiError(c, 404, "not_found", "Workspace not found.");
  }

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  const patch: { name?: string | undefined; status?: string | undefined } = {};

  if (b["name"] !== undefined) {
    if (typeof b["name"] !== "string" || b["name"].trim().length === 0) {
      return apiError(c, 422, "invalid_payload", '"name" must be a non-empty string.');
    }
    patch.name = b["name"];
  }
  if (b["status"] !== undefined) {
    if (!["active", "archived"].includes(b["status"] as string)) {
      return apiError(c, 422, "invalid_payload", '"status" must be "active" or "archived".');
    }
    patch.status = b["status"] as string;
  }

  try {
    const updated = await updateProduct(workspaceId, productId, patch);
    if (!updated) {
      return apiError(c, 404, "not_found", "Product not found.");
    }
    return c.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update product.";
    return apiError(c, 500, "update_error", message);
  }
});

export default app;
