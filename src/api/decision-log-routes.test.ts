import { describe, expect, it, vi } from "vitest";

const { getDecisionLogsMock } = vi.hoisted(() => ({
  getDecisionLogsMock: vi.fn(),
}));

vi.mock("../services/context-layer.js", () => ({
  createDecisionLog: vi.fn(),
  getDecisionLogById: vi.fn(),
  getDecisionLogs: getDecisionLogsMock,
}));

vi.mock("../services/idempotency.js", () => ({
  buildRequestHash: vi.fn(),
  checkIdempotency: vi.fn(),
  saveIdempotencyResponse: vi.fn(),
}));

import app from "./decision-log-routes.js";

describe("decision-log routes", () => {
  it("returns 422 for invalid offset", async () => {
    const res = await app.request(
      "/api/v1/workspaces/ws_1/products/p_1/decision-logs?offset=-1",
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("invalid_query");
  });

  it("returns total and items from service result", async () => {
    getDecisionLogsMock.mockResolvedValueOnce({
      total: 5,
      items: [
        {
          id: "dlog_1",
          workspaceId: "ws_1",
          productId: "p_1",
          title: "t",
          decision: "d",
          rationale: "r",
          alternatives: [],
          evidenceLinks: [],
          createdBy: "user_1",
          createdAt: "2026-03-08T00:00:00.000Z",
        },
      ],
    });

    const res = await app.request(
      "/api/v1/workspaces/ws_1/products/p_1/decision-logs?limit=20&offset=0",
    );

    expect(res.status).toBe(200);
    expect(getDecisionLogsMock).toHaveBeenCalledWith("ws_1", "p_1", 20, 0);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(5);
    expect(body["limit"]).toBe(20);
    expect(body["offset"]).toBe(0);
  });
});
