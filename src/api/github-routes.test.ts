import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import githubRoutes from "./github-routes.js";

const { getWorkspaceByIdMock, getProductByIdMock } = vi.hoisted(() => ({
  getWorkspaceByIdMock: vi.fn(),
  getProductByIdMock: vi.fn(),
}));

vi.mock("../services/workspace-store.js", () => ({
  getWorkspaceById: getWorkspaceByIdMock,
  getProductById: getProductByIdMock,
}));

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "user_1");
    await next();
  });
  app.route("/", githubRoutes);
  return app;
}

describe("github routes authz", () => {
  it("returns 404 when workspace is not owned by actor", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce(null);

    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws_other/products/prod_1/github-connections",
    );

    expect(res.status).toBe(404);
    expect(getWorkspaceByIdMock).toHaveBeenCalledWith("ws_other", "user_1");
  });

  it("returns 404 when product does not exist in workspace", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce({
      id: "ws_1",
      name: "Workspace",
      ownerUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    getProductByIdMock.mockResolvedValueOnce(null);

    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws_1/products/prod_missing/github-sync-events",
    );

    expect(res.status).toBe(404);
    expect(getProductByIdMock).toHaveBeenCalledWith("ws_1", "prod_missing");
  });
});
