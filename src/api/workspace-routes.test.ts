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

describe("workspace routes", () => {
  it("returns 422 for onboarding setup when productName is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/onboarding/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipFirstBet: true }),
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
