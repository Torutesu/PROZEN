import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startScheduler } from "./scheduler.js";

const {
  getDbMock,
  getDailyBriefingMock,
  getEveningReviewMock,
  getWeeklyRetroMock,
  listAllActiveIntegrationsMock,
  syncStripeMetricsMock,
  syncPostHogMetricsMock,
  syncSentryMetricsMock,
  syncTypeformMetricsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getDailyBriefingMock: vi.fn(),
  getEveningReviewMock: vi.fn(),
  getWeeklyRetroMock: vi.fn(),
  listAllActiveIntegrationsMock: vi.fn(),
  syncStripeMetricsMock: vi.fn(),
  syncPostHogMetricsMock: vi.fn(),
  syncSentryMetricsMock: vi.fn(),
  syncTypeformMetricsMock: vi.fn(),
}));

vi.mock("../db/client.js", () => ({
  getDb: getDbMock,
}));

vi.mock("../services/briefing-store.js", () => ({
  getDailyBriefing: getDailyBriefingMock,
}));

vi.mock("../services/review-store.js", () => ({
  getEveningReview: getEveningReviewMock,
  getWeeklyRetro: getWeeklyRetroMock,
}));

vi.mock("../services/integration-store.js", () => ({
  listAllActiveIntegrations: listAllActiveIntegrationsMock,
}));

vi.mock("../services/integrations/stripe-sync.js", () => ({
  syncStripeMetrics: syncStripeMetricsMock,
}));

vi.mock("../services/integrations/posthog-sync.js", () => ({
  syncPostHogMetrics: syncPostHogMetricsMock,
}));

vi.mock("../services/integrations/sentry-sync.js", () => ({
  syncSentryMetrics: syncSentryMetricsMock,
}));

vi.mock("../services/integrations/typeform-sync.js", () => ({
  syncTypeformMetrics: syncTypeformMetricsMock,
}));

function createDbMock(
  pairs: Array<{ workspaceId: string; productId: string }> = [],
) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => pairs),
        })),
      })),
    })),
  };
}

describe("scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    getDbMock.mockReturnValue(createDbMock([]));
    getDailyBriefingMock.mockResolvedValue({ content: "ok" });
    getEveningReviewMock.mockResolvedValue({ content: "ok" });
    getWeeklyRetroMock.mockResolvedValue({ content: "ok" });
    listAllActiveIntegrationsMock.mockResolvedValue([]);
    syncStripeMetricsMock.mockResolvedValue(undefined);
    syncPostHogMetricsMock.mockResolvedValue(undefined);
    syncSentryMetricsMock.mockResolvedValue(undefined);
    syncTypeformMetricsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs morning briefing + integration polling at 07:00 UTC", async () => {
    vi.setSystemTime(new Date("2026-03-10T07:00:00.000Z"));
    getDbMock.mockReturnValue(createDbMock([{ workspaceId: "ws1", productId: "p1" }]));

    const stop = startScheduler();
    await vi.advanceTimersByTimeAsync(0);

    expect(getDailyBriefingMock).toHaveBeenCalledWith("ws1", "p1");
    expect(getEveningReviewMock).not.toHaveBeenCalled();
    expect(getWeeklyRetroMock).not.toHaveBeenCalled();
    expect(listAllActiveIntegrationsMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("retries morning briefing up to 3 attempts before succeeding", async () => {
    vi.setSystemTime(new Date("2026-03-11T07:00:00.000Z"));
    getDbMock.mockReturnValue(createDbMock([{ workspaceId: "ws1", productId: "p1" }]));
    getDailyBriefingMock
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(new Error("transient-2"))
      .mockResolvedValueOnce({ content: "ok" });

    const stop = startScheduler();
    await vi.advanceTimersByTimeAsync(0);

    expect(getDailyBriefingMock).toHaveBeenCalledTimes(3);
    stop();
  });

  it("runs weekly retro on Sunday at 08:00 UTC window", async () => {
    vi.setSystemTime(new Date("2026-03-08T08:03:00.000Z"));
    getDbMock.mockReturnValue(createDbMock([{ workspaceId: "ws1", productId: "p1" }]));

    const stop = startScheduler();
    await vi.advanceTimersByTimeAsync(0);

    expect(getWeeklyRetroMock).toHaveBeenCalledWith("ws1", "p1");
    expect(getDailyBriefingMock).not.toHaveBeenCalled();
    expect(getEveningReviewMock).not.toHaveBeenCalled();
    stop();
  });

  it("does not run scheduled jobs outside first 5 minutes of the hour", async () => {
    vi.setSystemTime(new Date("2026-03-10T14:10:00.000Z"));

    const stop = startScheduler();
    await vi.advanceTimersByTimeAsync(0);

    expect(getDailyBriefingMock).not.toHaveBeenCalled();
    expect(getEveningReviewMock).not.toHaveBeenCalled();
    expect(getWeeklyRetroMock).not.toHaveBeenCalled();
    expect(listAllActiveIntegrationsMock).not.toHaveBeenCalled();
    stop();
  });

  it("runs integration polling once per hour via hour-key guard", async () => {
    vi.setSystemTime(new Date("2026-03-10T09:00:00.000Z"));
    listAllActiveIntegrationsMock.mockResolvedValue([
      { workspaceId: "ws1", productId: "p1", provider: "stripe" },
    ]);

    const stop = startScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncStripeMetricsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(syncStripeMetricsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(55 * 60_000);
    expect(syncStripeMetricsMock).toHaveBeenCalledTimes(2);
    stop();
  });
});
