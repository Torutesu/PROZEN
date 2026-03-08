import { describe, expect, it, vi } from "vitest";

const { listAuditEventsMock } = vi.hoisted(() => ({
  listAuditEventsMock: vi.fn(),
}));

vi.mock("../services/audit-events.js", () => ({
  listAuditEvents: listAuditEventsMock,
}));

import app from "./audit-routes.js";

describe("audit routes", () => {
  it("returns 422 for invalid limit", async () => {
    const res = await app.request(
      "/api/v1/workspaces/ws_1/audit-events?limit=nan",
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("invalid_query");
  });

  it("returns total and items from service result", async () => {
    listAuditEventsMock.mockResolvedValueOnce({
      total: 7,
      items: [
        {
          id: "ae_1",
          workspaceId: "ws_1",
          actorId: "user_1",
          eventType: "context_pack.ingested",
          resourceType: "context_pack_version",
          resourceId: "cpv_1",
          metadata: {},
          createdAt: "2026-03-08T00:00:00.000Z",
        },
      ],
    });

    const res = await app.request(
      "/api/v1/workspaces/ws_1/audit-events?productId=p_1&limit=999&offset=2",
    );

    expect(res.status).toBe(200);
    expect(listAuditEventsMock).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      productId: "p_1",
      limit: 200,
      offset: 2,
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(7);
    expect(body["limit"]).toBe(200);
    expect(body["offset"]).toBe(2);
  });
});
