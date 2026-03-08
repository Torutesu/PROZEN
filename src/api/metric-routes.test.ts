import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import metricRoutes from "./metric-routes.js";

const {
  createMetricMock,
  getMetricsMock,
  getMetricByIdMock,
  updateMetricMock,
  addReadingMock,
  getReadingsMock,
  getAnomaliesMock,
  resolveAnomalyMock,
} = vi.hoisted(() => ({
  createMetricMock: vi.fn(),
  getMetricsMock: vi.fn(),
  getMetricByIdMock: vi.fn(),
  updateMetricMock: vi.fn(),
  addReadingMock: vi.fn(),
  getReadingsMock: vi.fn(),
  getAnomaliesMock: vi.fn(),
  resolveAnomalyMock: vi.fn(),
}));

vi.mock("../services/metric-store.js", () => ({
  createMetric: createMetricMock.mockResolvedValue({
    id: "met_abc",
    workspaceId: "ws1",
    productId: "p1",
    name: "Activation Rate",
    description: null,
    layer: "kpi",
    unit: "%",
    direction: "increase",
    targetValue: 40,
    baselineValue: 25,
    betSpecId: null,
    isActive: true,
    createdBy: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getMetrics: getMetricsMock.mockResolvedValue({ total: 0, items: [] }),
  getMetricById: getMetricByIdMock.mockResolvedValue(null),
  updateMetric: updateMetricMock.mockResolvedValue(null),
  addReading: addReadingMock.mockResolvedValue(null),
  getReadings: getReadingsMock.mockResolvedValue({ total: 0, items: [] }),
  getAnomalies: getAnomaliesMock.mockResolvedValue({ total: 0, items: [] }),
  resolveAnomaly: resolveAnomalyMock.mockResolvedValue(false),
}));

const BASE = "/api/v1/workspaces/ws1/products/p1";

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "test_user");
    await next();
  });
  app.route("/", metricRoutes);
  return app;
}

describe("POST /metrics validation", () => {
  it("returns 422 when name is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layer: "kpi" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when layer is invalid", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Revenue", layer: "invalid" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 201 with valid payload", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Activation Rate",
        layer: "kpi",
        unit: "%",
        baselineValue: 25,
        targetValue: 40,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["id"]).toBe("met_abc");
    expect(createMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws1", productId: "p1" }),
    );
  });
});

describe("GET /metrics", () => {
  it("returns 200 with empty list", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(0);
    expect(getMetricsMock).toHaveBeenCalledWith("ws1", "p1", undefined, 100, 0);
  });

  it("returns 422 on invalid layer query param", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics?layer=bad`);
    expect(res.status).toBe(422);
  });
});

describe("Product scope forwarding", () => {
  it("passes workspace+product to metric lookup", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics/met_cross`);
    expect(res.status).toBe(404);
    expect(getMetricByIdMock).toHaveBeenCalledWith("ws1", "p1", "met_cross");
  });

  it("passes workspace+product to reading list", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics/met_abc/readings`);
    expect(res.status).toBe(200);
    expect(getReadingsMock).toHaveBeenCalledWith("ws1", "p1", "met_abc", 50, 0);
  });

  it("passes workspace+product to anomaly resolution", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/anomalies/anom_1/resolve`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
    expect(resolveAnomalyMock).toHaveBeenCalledWith(
      "ws1",
      "p1",
      "anom_1",
      "test_user",
    );
  });
});

describe("POST /metrics/:metricId/readings validation", () => {
  it("returns 422 when value is missing", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics/met_abc/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("returns 404 when metric not found", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/metrics/met_unknown/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 42 }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /anomalies", () => {
  it("returns 200 with empty list", async () => {
    const app = buildApp();
    const res = await app.request(`${BASE}/anomalies`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["total"]).toBe(0);
  });
});
