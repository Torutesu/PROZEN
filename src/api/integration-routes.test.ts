import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import integrationRoutes from "./integration-routes.js";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  listIntegrationsMock,
  createIntegrationMock,
  deleteIntegrationMock,
  getIntegrationConfigMock,
  handleStripeWebhookMock,
  verifyStripeSignatureMock,
} = vi.hoisted(() => ({
  listIntegrationsMock: vi.fn(),
  createIntegrationMock: vi.fn(),
  deleteIntegrationMock: vi.fn(),
  getIntegrationConfigMock: vi.fn(),
  handleStripeWebhookMock: vi.fn(),
  verifyStripeSignatureMock: vi.fn(),
}));

vi.mock("../services/integration-store.js", () => ({
  listIntegrations: listIntegrationsMock,
  createIntegration: createIntegrationMock,
  deleteIntegration: deleteIntegrationMock,
  getIntegrationConfig: getIntegrationConfigMock,
}));

vi.mock("../services/integrations/stripe-sync.js", () => ({
  verifyStripeSignature: verifyStripeSignatureMock,
  handleStripeWebhook: handleStripeWebhookMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = "/api/v1/workspaces/ws1/products/p1";

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  // Simulate actorId middleware (auth)
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "user1");
    await next();
  });
  app.route("/", integrationRoutes);
  return app;
}

const STUB_CONNECTION = {
  id: "int_abc",
  workspaceId: "ws1",
  productId: "p1",
  provider: "stripe",
  syncConfig: {},
  isActive: true,
  lastSyncedAt: null,
  lastSyncError: null,
  createdBy: "user1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// GET /integrations
// ---------------------------------------------------------------------------

describe("GET .../integrations", () => {
  beforeEach(() => {
    listIntegrationsMock.mockResolvedValue([STUB_CONNECTION]);
  });

  it("returns 200 with items", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations`);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect(listIntegrationsMock).toHaveBeenCalledWith("ws1", "p1");
  });
});

// ---------------------------------------------------------------------------
// POST /integrations/:provider — Stripe
// ---------------------------------------------------------------------------

describe("POST .../integrations/stripe", () => {
  beforeEach(() => {
    createIntegrationMock.mockClear();
    createIntegrationMock.mockResolvedValue(STUB_CONNECTION);
  });

  it("returns 201 with valid payload", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restrictedKey: "rk_test_abc" }),
    });
    expect(res.status).toBe(201);
    expect(createIntegrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "stripe", workspaceId: "ws1", productId: "p1" }),
    );
  });

  it("returns 201 and includes webhookSecret when provided", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restrictedKey: "rk_test_abc", webhookSecret: "whsec_xyz" }),
    });
    expect(res.status).toBe(201);
    const call = createIntegrationMock.mock.calls[0]?.[0] as { config: { webhookSecret?: string } };
    expect(call.config.webhookSecret).toBe("whsec_xyz");
  });

  it("returns 422 when restrictedKey is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for unknown provider", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/unknown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restrictedKey: "x" }),
    });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /integrations/:provider — PostHog
// ---------------------------------------------------------------------------

describe("POST .../integrations/posthog", () => {
  beforeEach(() => {
    createIntegrationMock.mockClear();
    createIntegrationMock.mockResolvedValue({ ...STUB_CONNECTION, provider: "posthog" });
  });

  it("returns 201 with valid payload (no host)", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/posthog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "phx_abc", projectId: "12345" }),
    });
    expect(res.status).toBe(201);
    const call = createIntegrationMock.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    // host should NOT be set when not provided (exactOptionalPropertyTypes compliance)
    expect("host" in call.config).toBe(false);
  });

  it("returns 201 and includes host when provided", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/posthog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "phx_abc", projectId: "12345", host: "https://ph.example.com" }),
    });
    expect(res.status).toBe(201);
    const call = createIntegrationMock.mock.calls[0]?.[0] as { config: { host?: string } };
    expect(call.config.host).toBe("https://ph.example.com");
  });

  it("returns 422 when projectId is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/posthog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "phx_abc" }),
    });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// DELETE /integrations/:provider
// ---------------------------------------------------------------------------

describe("DELETE .../integrations/stripe", () => {
  it("returns 200 when integration exists", async () => {
    deleteIntegrationMock.mockResolvedValue(true);
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/stripe`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: boolean };
    expect(body.deleted).toBe(true);
  });

  it("returns 404 when integration not found", async () => {
    deleteIntegrationMock.mockResolvedValue(false);
    const app = buildApp();
    const res = await app.request(`${BASE}/integrations/stripe`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/stripe/:workspaceId/:productId
// ---------------------------------------------------------------------------

describe("POST /api/v1/webhooks/stripe/:wid/:pid", () => {
  const WEBHOOK_PATH = "/api/v1/webhooks/stripe/ws1/p1";

  it("returns 400 when Stripe webhook secret is not configured", async () => {
    getIntegrationConfigMock.mockResolvedValue(null);
    const app = buildApp();
    const res = await app.request(WEBHOOK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=123,v1=abc" },
      body: JSON.stringify({ type: "invoice.payment_succeeded", data: { object: {} } }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 when signature is invalid", async () => {
    getIntegrationConfigMock.mockResolvedValue({ restrictedKey: "rk_test", webhookSecret: "whsec_test" });
    verifyStripeSignatureMock.mockReturnValue(false);
    const app = buildApp();
    const res = await app.request(WEBHOOK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=123,v1=bad" },
      body: JSON.stringify({ type: "invoice.payment_succeeded", data: { object: {} } }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 when signature is valid and event is processed", async () => {
    getIntegrationConfigMock.mockResolvedValue({ restrictedKey: "rk_test", webhookSecret: "whsec_test" });
    verifyStripeSignatureMock.mockReturnValue(true);
    handleStripeWebhookMock.mockResolvedValue(undefined);
    const app = buildApp();
    const payload = JSON.stringify({
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_123", amount_paid: 9900 } },
    });
    const res = await app.request(WEBHOOK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=123,v1=valid" },
      body: payload,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { received: boolean };
    expect(body.received).toBe(true);
    expect(handleStripeWebhookMock).toHaveBeenCalledOnce();
  });

  it("returns 200 with warning when webhook processing throws", async () => {
    getIntegrationConfigMock.mockResolvedValue({ restrictedKey: "rk_test", webhookSecret: "whsec_test" });
    verifyStripeSignatureMock.mockReturnValue(true);
    handleStripeWebhookMock.mockRejectedValue(new Error("DB unavailable"));
    const app = buildApp();
    const payload = JSON.stringify({ type: "invoice.payment_succeeded", data: { object: {} } });
    const res = await app.request(WEBHOOK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=123,v1=valid" },
      body: payload,
    });
    // Must return 200 to prevent Stripe retries
    expect(res.status).toBe(200);
    const body = await res.json() as { received: boolean; warning?: string };
    expect(body.received).toBe(true);
    expect(body.warning).toBe("processing_error");
    expect(body.warning).not.toContain("DB unavailable");
  });
});

// ---------------------------------------------------------------------------
// verifyStripeSignature unit tests (uses importActual to bypass vi.mock)
// ---------------------------------------------------------------------------

// Helper: compute a real Stripe-format HMAC for a given timestamp + body + secret
function makeStripeHeader(timestamp: number, body: string, secret: string): string {
  const payload = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("verifyStripeSignature", () => {
  const SECRET = "test_webhook_secret";
  const BODY = '{"type":"test"}';

  it("accepts a valid signature within tolerance", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    const now = Math.floor(Date.now() / 1000);
    const header = makeStripeHeader(now, BODY, SECRET);
    expect(verifyStripeSignature(BODY, header, SECRET)).toBe(true);
  });

  it("rejects a valid HMAC with timestamp outside tolerance (replay attack)", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    // Compute a genuine HMAC for an old timestamp — should still fail due to age
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s > 300s tolerance
    const header = makeStripeHeader(oldTimestamp, BODY, SECRET);
    expect(verifyStripeSignature(BODY, header, SECRET)).toBe(false);
  });

  it("rejects a tampered body even with a valid timestamp", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    const now = Math.floor(Date.now() / 1000);
    const header = makeStripeHeader(now, BODY, SECRET);
    // Send a different body than what the HMAC was computed over
    expect(verifyStripeSignature('{"type":"tampered"}', header, SECRET)).toBe(false);
  });

  it("accepts when the second v1 matches (key rotation scenario)", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    const now = Math.floor(Date.now() / 1000);
    const newHeader = makeStripeHeader(now, BODY, SECRET);
    // Extract the valid v1 and prepend a stale v1 from a rotated key
    const validV1 = newHeader.split(",v1=")[1]!;
    const multiSigHeader = `t=${now},v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef,v1=${validV1}`;
    expect(verifyStripeSignature(BODY, multiSigHeader, SECRET)).toBe(true);
  });

  it("rejects when t is missing", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    expect(verifyStripeSignature(BODY, "v1=abc123", SECRET)).toBe(false);
  });

  it("rejects when v1 is missing", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    const now = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(BODY, `t=${now}`, SECRET)).toBe(false);
  });

  it("rejects non-numeric timestamp", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    expect(verifyStripeSignature(BODY, "t=notanumber,v1=abc123", SECRET)).toBe(false);
  });

  it("rejects partially numeric timestamp", async () => {
    const { verifyStripeSignature } = await vi.importActual<
      typeof import("../services/integrations/stripe-sync.js")
    >("../services/integrations/stripe-sync.js");
    const now = Math.floor(Date.now() / 1000);
    const header = makeStripeHeader(now, BODY, SECRET);
    const validV1 = header.split(",v1=")[1]!;
    expect(verifyStripeSignature(BODY, `t=${now}abc,v1=${validV1}`, SECRET)).toBe(false);
  });
});
