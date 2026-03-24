import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncTypeformMetrics } from "./typeform-sync.js";

const {
  addReadingMock,
  findOrCreateMetricMock,
  getIntegrationConfigMock,
  getIntegrationMock,
  markSyncErrorMock,
  markSyncSuccessMock,
} = vi.hoisted(() => ({
  addReadingMock: vi.fn(),
  findOrCreateMetricMock: vi.fn(),
  getIntegrationConfigMock: vi.fn(),
  getIntegrationMock: vi.fn(),
  markSyncErrorMock: vi.fn(),
  markSyncSuccessMock: vi.fn(),
}));

vi.mock("../metric-store.js", () => ({
  addReading: addReadingMock,
}));

vi.mock("../integration-store.js", () => ({
  findOrCreateMetric: findOrCreateMetricMock,
  getIntegrationConfig: getIntegrationConfigMock,
  getIntegration: getIntegrationMock,
  markSyncSuccess: markSyncSuccessMock,
  markSyncError: markSyncErrorMock,
}));

describe("syncTypeformMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntegrationConfigMock.mockResolvedValue({
      accessToken: "tfp_test",
      formId: "form_123",
    });
    getIntegrationMock.mockResolvedValue(null);
    findOrCreateMetricMock
      .mockResolvedValueOnce("met_responses")
      .mockResolvedValueOnce("met_nps")
      .mockResolvedValueOnce("met_csat");
    markSyncSuccessMock.mockResolvedValue(undefined);
    markSyncErrorMock.mockResolvedValue(undefined);
    addReadingMock.mockResolvedValue({ reading: { id: "rdg_1" } });
  });

  it("marks success and records nothing when there are no new responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total_items: 0, items: [] }),
      }),
    );

    await syncTypeformMetrics("ws1", "p1");

    expect(addReadingMock).not.toHaveBeenCalled();
    expect(findOrCreateMetricMock).not.toHaveBeenCalled();
    expect(markSyncSuccessMock).toHaveBeenCalledWith("ws1", "p1", "typeform");
    expect(markSyncErrorMock).not.toHaveBeenCalled();
  });

  it("records response count, NPS, and CSAT when numeric answers are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_items: 3,
          items: [
            { submitted_at: "2026-03-10T00:00:00Z", answers: [{ type: "number", number: 10 }] },
            { submitted_at: "2026-03-10T00:01:00Z", answers: [{ type: "number", number: 8 }] },
            { submitted_at: "2026-03-10T00:02:00Z", answers: [{ type: "number", number: 6 }] },
          ],
        }),
      }),
    );

    await syncTypeformMetrics("ws1", "p1");

    expect(addReadingMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ metricId: "met_responses", value: 3, source: "typeform" }),
    );
    expect(addReadingMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ metricId: "met_nps", value: 0, source: "typeform" }),
    );
    expect(addReadingMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ metricId: "met_csat", value: 67, source: "typeform" }),
    );
    expect(markSyncSuccessMock).toHaveBeenCalledWith("ws1", "p1", "typeform");
    expect(markSyncErrorMock).not.toHaveBeenCalled();
  });
});
