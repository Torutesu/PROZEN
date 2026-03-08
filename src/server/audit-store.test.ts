import { describe, expect, it } from "vitest";

import { AuditStore } from "./audit-store.js";

describe("AuditStore", () => {
  it("stores and filters events by workspace and product", () => {
    const store = new AuditStore();
    store.record({
      workspaceId: "ws1",
      productId: "p1",
      actorId: "u1",
      eventType: "context_pack.ingested",
      resourceType: "context_pack_version",
      resourceId: "cp@1",
      requestId: "req1",
      metadata: {}
    });
    store.record({
      workspaceId: "ws1",
      productId: "p2",
      actorId: "u1",
      eventType: "decision_log.created",
      resourceType: "decision_log",
      resourceId: "d1",
      requestId: "req2",
      metadata: {}
    });

    const ws1 = store.listByWorkspace("ws1");
    expect(ws1).toHaveLength(2);

    const ws1p1 = store.listByWorkspace("ws1", { productId: "p1" });
    expect(ws1p1).toHaveLength(1);
    expect(ws1p1[0]?.resourceId).toBe("cp@1");
  });
});

