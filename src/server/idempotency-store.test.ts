import { describe, expect, it } from "vitest";

import { IdempotencyStore } from "./idempotency-store.js";

describe("IdempotencyStore", () => {
  it("replays when key and hash are identical", () => {
    const store = new IdempotencyStore();
    const hash = IdempotencyStore.buildRequestHash("POST", "/x", '{"a":1}');
    store.save("ws1", "k1", hash, 201, { ok: true });

    const checked = store.check("ws1", "k1", hash);
    expect(checked.type).toBe("replay");
    if (checked.type === "replay") {
      expect(checked.response.statusCode).toBe(201);
      expect(checked.response.body).toEqual({ ok: true });
    }
  });

  it("returns conflict for same key with different hash", () => {
    const store = new IdempotencyStore();
    const h1 = IdempotencyStore.buildRequestHash("POST", "/x", '{"a":1}');
    const h2 = IdempotencyStore.buildRequestHash("POST", "/x", '{"a":2}');
    store.save("ws1", "k1", h1, 201, { ok: true });

    const checked = store.check("ws1", "k1", h2);
    expect(checked.type).toBe("conflict");
  });
});

