import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import reviewRoutes from "./review-routes.js";

const { getEveningReviewMock, getWeeklyRetroMock, getWorkspaceByIdMock, getProductByIdMock } =
  vi.hoisted(() => ({
    getEveningReviewMock: vi.fn().mockResolvedValue({
      id: "review_1",
      workspaceId: "ws1",
      productId: "p1",
      reviewType: "evening_review",
      reviewDate: "2026-03-08",
      content: "Today you logged 2 decisions. One open bet needs attention tomorrow.",
      metadata: { decisionsToday: 2, openBets: 1 },
      generatedAt: new Date().toISOString(),
    }),
    getWeeklyRetroMock: vi.fn().mockResolvedValue({
      id: "review_2",
      workspaceId: "ws1",
      productId: "p1",
      reviewType: "weekly_retro",
      reviewDate: "2026-03-08",
      content: "This week you completed 1 bet.",
      metadata: { betsCompleted: 1, betsActive: 2 },
      generatedAt: new Date().toISOString(),
    }),
    getWorkspaceByIdMock: vi.fn(),
    getProductByIdMock: vi.fn(),
  }));

vi.mock("../services/review-store.js", () => ({
  getEveningReview: getEveningReviewMock,
  getWeeklyRetro: getWeeklyRetroMock,
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
  app.route("/", reviewRoutes);
  return app;
}

describe("GET /reviews/:type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceByIdMock.mockResolvedValue({
      id: "ws1", name: "Workspace", ownerUserId: "user_1",
      createdAt: new Date(), updatedAt: new Date(),
    });
    getProductByIdMock.mockResolvedValue({
      id: "p1", workspaceId: "ws1", name: "Product", status: "active",
      createdAt: new Date(), updatedAt: new Date(),
    });
  });

  it("returns evening_review", async () => {
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p1/reviews/evening_review",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["reviewType"]).toBe("evening_review");
    expect(getEveningReviewMock).toHaveBeenCalledWith("ws1", "p1");
    expect(getWeeklyRetroMock).not.toHaveBeenCalled();
  });

  it("returns weekly_retro", async () => {
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p1/reviews/weekly_retro",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["reviewType"]).toBe("weekly_retro");
    expect(getWeeklyRetroMock).toHaveBeenCalledWith("ws1", "p1");
    expect(getEveningReviewMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid type", async () => {
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p1/reviews/bad_type",
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("invalid_type");
  });

  it("returns 404 when workspace is not found", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws_missing/products/p1/reviews/evening_review",
    );
    expect(res.status).toBe(404);
    expect(getEveningReviewMock).not.toHaveBeenCalled();
  });

  it("returns 404 when product is not found", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p_missing/reviews/evening_review",
    );
    expect(res.status).toBe(404);
    expect(getEveningReviewMock).not.toHaveBeenCalled();
  });

  it("returns 500 when review generation fails", async () => {
    getEveningReviewMock.mockRejectedValueOnce(new Error("Claude timeout"));
    const app = buildApp();
    const res = await app.request(
      "/api/v1/workspaces/ws1/products/p1/reviews/evening_review",
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("review_error");
  });
});
