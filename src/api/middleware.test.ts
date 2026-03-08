// Unit tests for API middleware helpers.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}));

vi.mock("@clerk/backend", () => ({
  verifyToken: verifyTokenMock,
}));

import {
  apiError,
  authMiddleware,
  requestIdMiddleware,
} from "./middleware.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

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

describe("authMiddleware", () => {
  it("uses local passthrough when no auth env is set", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.use("*", authMiddleware);
    app.get("/", (c) =>
      c.json({
        actorId: (c as { get: (key: string) => unknown }).get("actorId"),
      }),
    );

    const res = await app.request("/", {
      headers: { "x-actor-id": "local-user" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["actorId"]).toBe("local-user");
  });

  it("enforces legacy API key when PROZEN_API_KEY is set", async () => {
    vi.stubEnv("PROZEN_API_KEY", "secret-key");
    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.use("*", authMiddleware);
    app.get("/", (c) =>
      c.json({
        actorId: (c as { get: (key: string) => unknown }).get("actorId"),
      }),
    );

    const denied = await app.request("/");
    expect(denied.status).toBe(401);

    const ok = await app.request("/", {
      headers: {
        authorization: "Bearer secret-key",
        "x-actor-id": "api-user",
      },
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as Record<string, unknown>;
    expect(body["actorId"]).toBe("api-user");
  });

  it("enforces Clerk JWT when CLERK_SECRET_KEY is set", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "clerk-secret");
    verifyTokenMock.mockResolvedValueOnce({ sub: "user_clerk_123" });

    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.use("*", authMiddleware);
    app.get("/", (c) =>
      c.json({
        actorId: (c as { get: (key: string) => unknown }).get("actorId"),
      }),
    );

    const denied = await app.request("/");
    expect(denied.status).toBe(401);

    const ok = await app.request("/", {
      headers: { authorization: "Bearer valid-jwt" },
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as Record<string, unknown>;
    expect(body["actorId"]).toBe("user_clerk_123");
  });
});
