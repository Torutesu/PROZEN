import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncStripeMetrics } from "./stripe-sync.js";

const {
  addReadingMock,
  findOrCreateMetricMock,
  getIntegrationConfigMock,
  markSyncErrorMock,
  markSyncSuccessMock,
} = vi.hoisted(() => ({
  addReadingMock: vi.fn(),
  findOrCreateMetricMock: vi.fn(),
  getIntegrationConfigMock: vi.fn(),
  markSyncErrorMock: vi.fn(),
  markSyncSuccessMock: vi.fn(),
}));

vi.mock("../metric-store.js", () => ({
  addReading: addReadingMock,
}));

vi.mock("../integration-store.js", () => ({
  findOrCreateMetric: findOrCreateMetricMock,
  getIntegrationConfig: getIntegrationConfigMock,
  markSyncSuccess: markSyncSuccessMock,
  markSyncError: markSyncErrorMock,
}));

describe("syncStripeMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntegrationConfigMock.mockResolvedValue({ restrictedKey: "rk_test_123" });
    findOrCreateMetricMock.mockResolvedValue("met_active_subs");
    markSyncSuccessMock.mockResolvedValue(undefined);
    markSyncErrorMock.mockResolvedValue(undefined);
    addReadingMock.mockResolvedValue({ reading: { id: "rdg_1" } });
  });

  it("records Active Subscriptions when Stripe returns total_count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{}], total_count: 42 }),
      }),
    );

    await syncStripeMetrics("ws1", "p1");

    expect(getIntegrationConfigMock).toHaveBeenCalledWith("ws1", "p1", "stripe");
    expect(findOrCreateMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws1",
        productId: "p1",
        name: "Active Subscriptions",
        source: "stripe",
      }),
    );
    expect(addReadingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws1",
        productId: "p1",
        metricId: "met_active_subs",
        value: 42,
        source: "stripe",
      }),
    );
    expect(markSyncSuccessMock).toHaveBeenCalledWith("ws1", "p1", "stripe");
    expect(markSyncErrorMock).not.toHaveBeenCalled();
  });

  it("marks sync error and throws when total_count is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{}] }),
      }),
    );

    await expect(syncStripeMetrics("ws1", "p1")).rejects.toThrow(/total_count/i);

    expect(addReadingMock).not.toHaveBeenCalled();
    expect(markSyncSuccessMock).not.toHaveBeenCalled();
    expect(markSyncErrorMock).toHaveBeenCalledWith(
      "ws1",
      "p1",
      "stripe",
      expect.stringMatching(/total_count/i),
    );
  });
});
