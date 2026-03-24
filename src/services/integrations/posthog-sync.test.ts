import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncPostHogMetrics } from "./posthog-sync.js";

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

describe("syncPostHogMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntegrationConfigMock.mockResolvedValue({
      apiKey: "phx_test",
      projectId: "12345",
      host: "https://app.posthog.com",
    });
    findOrCreateMetricMock
      .mockResolvedValueOnce("met_dau")
      .mockResolvedValueOnce("met_mau");
    markSyncSuccessMock.mockResolvedValue(undefined);
    markSyncErrorMock.mockResolvedValue(undefined);
    addReadingMock.mockResolvedValue({ reading: { id: "rdg_1" } });
  });

  it("records DAU and MAU on successful polling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [{ data: [1, 2, 3] }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [{ aggregated_value: 50 }] }),
        }),
    );

    await syncPostHogMetrics("ws1", "p1");

    expect(addReadingMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ metricId: "met_dau", value: 3, source: "posthog" }),
    );
    expect(addReadingMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ metricId: "met_mau", value: 50, source: "posthog" }),
    );
    expect(markSyncSuccessMock).toHaveBeenCalledWith("ws1", "p1", "posthog");
    expect(markSyncErrorMock).not.toHaveBeenCalled();
  });

  it("marks sync error when PostHog API request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "forbidden",
      }),
    );

    await expect(syncPostHogMetrics("ws1", "p1")).rejects.toThrow(/PostHog API error/i);
    expect(markSyncSuccessMock).not.toHaveBeenCalled();
    expect(markSyncErrorMock).toHaveBeenCalledWith(
      "ws1",
      "p1",
      "posthog",
      expect.stringMatching(/PostHog API error/i),
    );
  });
});
