// Unit tests for API middleware helpers.

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware, apiError } from "./middleware.js";

describe("requestIdMiddleware", () => {
  it("attaches x-request-id header to response", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("echoes x-request-id header if provided", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-request-id": "test-id-123" },
    });
    expect(res.headers.get("x-request-id")).toBe("test-id-123");
  });
});

describe("apiError", () => {
  it("returns structured error JSON", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.get("/err", (c) => apiError(c, 404, "not_found", "Resource missing."));

    const res = await app.request("/err");
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["code"]).toBe("not_found");
    expect(body["message"]).toBe("Resource missing.");
    expect(typeof body["request_id"]).toBe("string");
  });
});
