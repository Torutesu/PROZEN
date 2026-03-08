import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import briefingRoutes from "./briefing-routes.js";

const { getDailyBriefingMock, getWorkspaceByIdMock, getProductByIdMock } =
  vi.hoisted(() => ({
    getDailyBriefingMock: vi.fn(),
    getWorkspaceByIdMock: vi.fn(),
    getProductByIdMock: vi.fn(),
  }));

vi.mock("../services/briefing-store.js", () => ({
  getDailyBriefing: getDailyBriefingMock.mockResolvedValue({
    id: "brief_1",
    workspaceId: "ws1",
    productId: "p1",
    briefingDate: "2026-03-08",
    content: "Focus on activation and resolve anomaly.",
    activeBets: 2,
    openAnomalies: 1,
    generatedAt: new Date().toISOString(),
  }),
}));

vi.mock("../services/workspace-store.js", () => ({
  getWorkspaceById: getWorkspaceByIdMock.mockResolvedValue({
    id: "ws1",
    name: "Workspace",
    ownerUserId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getProductById: getProductByIdMock.mockResolvedValue({
    id: "p1",
    workspaceId: "ws1",
    name: "Product",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "user_1");
    await next();
  });
  app.route("/", briefingRoutes);
  return app;
}

describe("GET /daily-briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when workspace and product are accessible", async () => {
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p1/daily-briefing",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["id"]).toBe("brief_1");
    expect(getDailyBriefingMock).toHaveBeenCalledWith("ws1", "p1");
  });

  it("returns 404 when workspace is not found for actor", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws_missing/products/p1/daily-briefing",
    );
    expect(res.status).toBe(404);
    expect(getDailyBriefingMock).not.toHaveBeenCalled();
  });

  it("returns 404 when product does not exist", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p_missing/daily-briefing",
    );
    expect(res.status).toBe(404);
    expect(getDailyBriefingMock).not.toHaveBeenCalled();
  });
});
