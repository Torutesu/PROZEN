import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncSentryMetrics } from "./sentry-sync.js";

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

describe("syncSentryMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntegrationConfigMock.mockResolvedValue({
      authToken: "sntrys_test",
      organizationSlug: "org",
      projectSlug: "project",
    });
    findOrCreateMetricMock
      .mockResolvedValueOnce("met_new_issues")
      .mockResolvedValueOnce("met_error_events");
    markSyncSuccessMock.mockResolvedValue(undefined);
    markSyncErrorMock.mockResolvedValue(undefined);
    addReadingMock.mockResolvedValue({ reading: { id: "rdg_1" } });
  });

  it("records New Issues and Error Events when Sentry polling succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: "1" }, { id: "2" }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [[0, [{ count: 3 }]], [1, [{ count: 2 }]]] }),
        }),
    );

    await syncSentryMetrics("ws1", "p1");

    expect(addReadingMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ metricId: "met_new_issues", value: 2, source: "sentry" }),
    );
    expect(addReadingMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ metricId: "met_error_events", value: 5, source: "sentry" }),
    );
    expect(markSyncSuccessMock).toHaveBeenCalledWith("ws1", "p1", "sentry");
    expect(markSyncErrorMock).not.toHaveBeenCalled();
  });

  it("marks sync error when Sentry issues request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );

    await expect(syncSentryMetrics("ws1", "p1")).rejects.toThrow(/Sentry API error/i);
    expect(markSyncSuccessMock).not.toHaveBeenCalled();
    expect(markSyncErrorMock).toHaveBeenCalledWith(
      "ws1",
      "p1",
      "sentry",
      expect.stringMatching(/Sentry API error/i),
    );
  });
});
