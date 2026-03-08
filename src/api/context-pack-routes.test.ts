import { describe, expect, it, vi } from "vitest";

const { getContextVersionsMock } = vi.hoisted(() => ({
  getContextVersionsMock: vi.fn(),
}));

vi.mock("../services/context-layer.js", () => ({
  getCurrentContext: vi.fn(),
  ingestContext: vi.fn(),
  restoreContext: vi.fn(),
  getContextVersions: getContextVersionsMock,
}));

vi.mock("../services/idempotency.js", () => ({
  buildRequestHash: vi.fn(),
  checkIdempotency: vi.fn(),
  saveIdempotencyResponse: vi.fn(),
}));

import app from "./context-pack-routes.js";

describe("context-pack routes", () => {
  it("returns 422 for invalid limit on versions endpoint", async () => {
    const res = await app.request(
      "/api/v1/workspaces/ws_1/products/p_1/context-pack/versions?limit=abc",
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("invalid_query");
  });

  it("returns total and items from service result", async () => {
    getContextVersionsMock.mockResolvedValueOnce({
      total: 12,
      items: [
        {
          id: "cpv_1",
          versionNumber: 3,
          summary: "s",
          source: "manual_input",
          createdBy: "user_1",
          createdAt: new Date("2026-03-08T00:00:00.000Z"),
        },
      ],
    });

    const res = await app.request(
      "/api/v1/workspaces/ws_1/products/p_1/context-pack/versions?limit=999&offset=2",
    );

    expect(res.status).toBe(200);
    expect(getContextVersionsMock).toHaveBeenCalledWith("ws_1", "p_1", 200, 2);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(12);
    expect(body["limit"]).toBe(200);
    expect(body["offset"]).toBe(2);
  });
});
