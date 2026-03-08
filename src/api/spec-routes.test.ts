// Smoke tests for spec routes — verifies routing and validation
// without hitting the DB (spec-store is mocked).

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import specRoutes from "./spec-routes.js";

const {
  createBetSpecMock,
  getBetSpecsMock,
  getBetSpecByIdMock,
  getBetSpecVersionsMock,
  getConversationMock,
  updateBetSpecStatusMock,
  sendMessageMock,
  restoreBetSpecMock,
  completeBetSpecMock,
  getLatestNextBetHypothesisMock,
} = vi.hoisted(() => ({
  createBetSpecMock: vi.fn(),
  getBetSpecsMock: vi.fn(),
  getBetSpecByIdMock: vi.fn(),
  getBetSpecVersionsMock: vi.fn(),
  getConversationMock: vi.fn(),
  updateBetSpecStatusMock: vi.fn(),
  sendMessageMock: vi.fn(),
  restoreBetSpecMock: vi.fn(),
  completeBetSpecMock: vi.fn(),
  getLatestNextBetHypothesisMock: vi.fn(),
}));

// Stub out spec-store to avoid DB connections in unit tests.
vi.mock("../services/spec-store.js", () => ({
  createBetSpec: createBetSpecMock.mockResolvedValue({
    betSpecId: "bet_test123",
    conversationId: "conv_test123",
    agentReply: "Got it! Tell me more.",
    agentState: "clarifying",
  }),
  getBetSpecs: getBetSpecsMock.mockResolvedValue({ total: 0, items: [] }),
  getBetSpecById: getBetSpecByIdMock.mockResolvedValue(null),
  getBetSpecVersions: getBetSpecVersionsMock.mockResolvedValue({
    total: 0,
    items: [],
  }),
  getConversation: getConversationMock.mockResolvedValue(null),
  updateBetSpecStatus: updateBetSpecStatusMock.mockResolvedValue(false),
  sendMessage: sendMessageMock.mockResolvedValue(null),
  restoreBetSpec: restoreBetSpecMock.mockResolvedValue(null),
  completeBetSpec: completeBetSpecMock.mockResolvedValue({
    learningSummary: "Guest checkout mattered more than UI polish.",
    nextBetHypothesis: "We believe reducing checkout steps will improve conversion for mobile users.",
  }),
  getLatestNextBetHypothesis: getLatestNextBetHypothesisMock.mockResolvedValue(null),
}));

const BASE = "/api/v1/workspaces/ws1/products/p1";

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "test_user");
    await next();
  });
  app.route("/", specRoutes);
  return app;
}

describe("POST /bets validation", () => {
  it("returns 422 when title is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "I want to build a new feature" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when message is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New feature bet" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 201 with valid payload", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Improve onboarding flow",
        message: "I think we should simplify the signup to increase activation.",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["bet_spec_id"]).toBe("bet_test123");
    expect(body["agent_reply"]).toBeTruthy();
  });
});

describe("GET /bets", () => {
  it("returns 200 with empty list", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(0);
    expect(Array.isArray(body["items"])).toBe(true);
    expect(getBetSpecsMock).toHaveBeenCalledWith("ws1", "p1", 50, 0);
  });
});

describe("POST /bets/:betId/messages validation", () => {
  it("returns 422 when message is empty", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets/bet_abc/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 404 when bet not found", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets/bet_notfound/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What are the next steps?" }),
    });
    expect(res.status).toBe(404);
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws1",
        productId: "p1",
        betSpecId: "bet_notfound",
      }),
    );
  });
});

describe("POST /bets/:betId/complete", () => {
  it("returns 422 when outcomeNote is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets/bet_abc/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("returns 200 with learning summary", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/bets/bet_abc/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomeNote: "Conversion improved only for mobile cohort." }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    expect(body["learning_summary"]).toBeTruthy();
    expect(body["next_bet_hypothesis"]).toBeTruthy();
    expect(completeBetSpecMock).toHaveBeenCalledWith(
      "ws1",
      "p1",
      "bet_abc",
      "Conversion improved only for mobile cohort.",
      "test_user",
      expect.any(String),
    );
  });
});

describe("GET /bets/recommendation", () => {
  it("returns null when no recommendation exists", async () => {
    const app = buildApp();
    getLatestNextBetHypothesisMock.mockResolvedValueOnce(null);
    const res = await app.request(`${BASE}/bets/recommendation`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["recommendation"]).toBeNull();
    expect(getLatestNextBetHypothesisMock).toHaveBeenCalledWith("ws1", "p1");
  });

  it("returns latest recommendation when available", async () => {
    const app = buildApp();
    getLatestNextBetHypothesisMock.mockResolvedValueOnce({
      betSpecId: "bet_completed_1",
      title: "Improve checkout",
      nextBetHypothesis: "We believe one-page checkout will improve conversion for mobile users.",
      learningSummary: "Mobile users dropped during multi-step checkout.",
      updatedAt: "2026-03-08T07:00:00.000Z",
    });
    const res = await app.request(`${BASE}/bets/recommendation`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const recommendation = body["recommendation"] as Record<string, unknown>;
    expect(recommendation["betSpecId"]).toBe("bet_completed_1");
    expect(recommendation["nextBetHypothesis"]).toBeTruthy();
  });
});
