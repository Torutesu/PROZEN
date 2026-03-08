import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import workspaceRoutes from "./workspace-routes.js";

const {
  getWorkspacesByOwnerMock,
  createWorkspaceMock,
  getWorkspaceByIdMock,
  createProductMock,
  getProductsMock,
  getProductByIdMock,
  updateProductMock,
  setupOnboardingMock,
} = vi.hoisted(() => ({
  getWorkspacesByOwnerMock: vi.fn(),
  createWorkspaceMock: vi.fn(),
  getWorkspaceByIdMock: vi.fn(),
  createProductMock: vi.fn(),
  getProductsMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  updateProductMock: vi.fn(),
  setupOnboardingMock: vi.fn(),
}));

vi.mock("../services/workspace-store.js", () => ({
  getWorkspacesByOwner: getWorkspacesByOwnerMock.mockResolvedValue([]),
  createWorkspace: createWorkspaceMock.mockResolvedValue({
    id: "ws_1",
    name: "Workspace 1",
    ownerUserId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getWorkspaceById: getWorkspaceByIdMock.mockResolvedValue({
    id: "ws_1",
    name: "Workspace 1",
    ownerUserId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createProduct: createProductMock.mockResolvedValue({
    id: "prod_1",
    workspaceId: "ws_1",
    name: "Product 1",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getProducts: getProductsMock.mockResolvedValue([]),
  getProductById: getProductByIdMock.mockResolvedValue(null),
  updateProduct: updateProductMock.mockResolvedValue(null),
  setupOnboarding: setupOnboardingMock.mockResolvedValue({
    workspace: {
      id: "ws_setup",
      name: "Setup WS",
      ownerUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    product: {
      id: "prod_setup",
      workspaceId: "ws_setup",
      name: "Setup Product",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    betSpecId: null,
    warnings: [],
  }),
}));

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "user_1");
    await next();
  });
  app.route("/", workspaceRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces
// ---------------------------------------------------------------------------
describe("GET /api/v1/workspaces", () => {
  it("lists workspaces for actor", async () => {
    getWorkspacesByOwnerMock.mockResolvedValueOnce([
      {
        id: "ws_1",
        name: "Workspace 1",
        ownerUserId: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.request("/api/v1/workspaces");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(1);
    expect(getWorkspacesByOwnerMock).toHaveBeenCalledWith("user_1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces
// ---------------------------------------------------------------------------
describe("POST /api/v1/workspaces", () => {
  it("returns 422 when name is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("returns 201 with valid name", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Workspace" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["id"]).toBe("ws_1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces/:workspaceId/products
// ---------------------------------------------------------------------------
describe("GET /api/v1/workspaces/:workspaceId/products", () => {
  it("returns 200 with product list", async () => {
    getProductsMock.mockResolvedValueOnce([
      {
        id: "prod_1",
        workspaceId: "ws_1",
        name: "Product 1",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(1);
  });

  it("returns 404 when workspace not found", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_missing/products");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces/:workspaceId/products
// ---------------------------------------------------------------------------
describe("POST /api/v1/workspaces/:workspaceId/products", () => {
  it("returns 422 when name is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("returns 201 with valid name", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Product" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["id"]).toBe("prod_1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces/onboarding/setup
// ---------------------------------------------------------------------------
describe("POST /api/v1/workspaces/onboarding/setup", () => {
  it("returns 422 when productName is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/onboarding/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipFirstBet: true }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when skipFirstBet is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/onboarding/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName: "My Product" }),
    });
    expect(res.status).toBe(422);
  });

  it("calls setupOnboarding with actor/request context", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/onboarding/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "req_setup_1",
      },
      body: JSON.stringify({
        workspaceName: "My WS",
        productName: "My Product",
        productDescription: "Test description",
        mainKpi: "Day-7 Retention",
        firstBetIdea: "Simplify onboarding flow",
        skipFirstBet: false,
      }),
    });

    expect(res.status).toBe(201);
    expect(setupOnboardingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceName: "My WS",
        productName: "My Product",
        skipFirstBet: false,
        actorId: "user_1",
        requestId: "req_setup_1",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/workspaces/:workspaceId/products/:productId
// ---------------------------------------------------------------------------
describe("PATCH /api/v1/workspaces/:workspaceId/products/:productId", () => {
  it("returns 422 for invalid status", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products/prod_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "deleted" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 200 with valid status update", async () => {
    updateProductMock.mockResolvedValueOnce({
      id: "prod_1",
      workspaceId: "ws_1",
      name: "Product 1",
      status: "archived",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products/prod_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 with valid name update", async () => {
    updateProductMock.mockResolvedValueOnce({
      id: "prod_1",
      workspaceId: "ws_1",
      name: "Renamed Product",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products/prod_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed Product" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["name"]).toBe("Renamed Product");
  });
});
