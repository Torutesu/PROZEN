import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  drainGitHubSyncQueue,
  getGitHubSyncQueueStats,
  resetGitHubSyncQueueStatsForTest,
} from "./github-sync-queue.js";

const {
  getDbMock,
  getSqlClientMock,
  sqlClaimRows,
  dbSelectRows,
  dbUpdates,
  fetchCommitDiffMock,
  fetchPRDiffMock,
  analyzeDiffAgainstBetSpecsMock,
  decryptSecretMock,
  getBetSpecsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getSqlClientMock: vi.fn(),
  sqlClaimRows: [] as Array<Array<{ id: string; previous_status: string }>>,
  dbSelectRows: [] as unknown[][],
  dbUpdates: [] as Array<Record<string, unknown>>,
  fetchCommitDiffMock: vi.fn(),
  fetchPRDiffMock: vi.fn(),
  analyzeDiffAgainstBetSpecsMock: vi.fn(),
  decryptSecretMock: vi.fn(),
  getBetSpecsMock: vi.fn(),
}));

vi.mock("../db/client.js", () => ({
  getDb: getDbMock,
  getSqlClient: getSqlClientMock,
}));

vi.mock("./github-sync.js", () => ({
  fetchCommitDiff: fetchCommitDiffMock,
  fetchPRDiff: fetchPRDiffMock,
  analyzeDiffAgainstBetSpecs: analyzeDiffAgainstBetSpecsMock,
}));

vi.mock("./secret-crypto.js", () => ({
  decryptSecret: decryptSecretMock,
}));

vi.mock("./spec-store.js", () => ({
  getBetSpecs: getBetSpecsMock,
}));

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "gse_1",
    connectionId: "ghc_1",
    workspaceId: "ws_1",
    eventType: "push",
    githubDeliveryId: "delivery_1",
    repository: "owner/repo",
    ref: "refs/heads/main",
    commitSha: "abc123456789",
    prNumber: null,
    prTitle: null,
    diffSummary: null,
    payload: {
      repository: { full_name: "owner/repo" },
      ref: "refs/heads/main",
      after: "abc123456789",
    },
    analysis: null,
    status: "processing",
    retryCount: 0,
    nextAttemptAt: new Date(),
    lastError: null,
    processingStartedAt: new Date(),
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: "ghc_1",
    workspaceId: "ws_1",
    productId: "prod_1",
    repository: "owner/repo",
    accessToken: "enc:pat_1",
    webhookId: "wh_1",
    webhookSecret: "secret_1",
    isActive: true,
    createdBy: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildDbMock() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => dbSelectRows.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          dbUpdates.push(values);
          return [];
        }),
      })),
    })),
  };
}

describe("github-sync-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlClaimRows.length = 0;
    dbSelectRows.length = 0;
    dbUpdates.length = 0;
    resetGitHubSyncQueueStatsForTest();

    getDbMock.mockReturnValue(buildDbMock());
    getSqlClientMock.mockReturnValue(
      vi.fn(async () => sqlClaimRows.shift() ?? []),
    );
    decryptSecretMock.mockReturnValue("pat_1");
    fetchPRDiffMock.mockResolvedValue("");
    analyzeDiffAgainstBetSpecsMock.mockResolvedValue({
      summary: "ok",
      affectedBets: [],
      confidence: "low",
    });
    getBetSpecsMock.mockResolvedValue({ total: 0, items: [] });
  });

  it("increments retry_count and schedules next_attempt_at on transient failure", async () => {
    sqlClaimRows.push([{ id: "gse_1", previous_status: "pending" }]);
    dbSelectRows.push([makeEvent({ retryCount: 0 })], [makeConnection()]);
    fetchCommitDiffMock.mockRejectedValueOnce(new Error("network timeout"));

    const processed = await drainGitHubSyncQueue(1);

    expect(processed).toBe(1);
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0]).toMatchObject({
      status: "failed",
      retryCount: 1,
      lastError: "network timeout",
      processingStartedAt: null,
    });
    expect(dbUpdates[0]?.["nextAttemptAt"]).toBeInstanceOf(Date);

    const stats = getGitHubSyncQueueStats();
    expect(stats.claimed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.retried).toBe(1);
    expect(stats.deadLettered).toBe(0);
  });

  it("reclaims stale processing event and marks unsupported event as skipped", async () => {
    sqlClaimRows.push([{ id: "gse_stale", previous_status: "processing" }]);
    dbSelectRows.push(
      [makeEvent({ id: "gse_stale", eventType: "fork", payload: {} })],
      [makeConnection()],
    );

    const processed = await drainGitHubSyncQueue(1);

    expect(processed).toBe(1);
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0]).toMatchObject({
      status: "skipped",
      processingStartedAt: null,
    });

    const stats = getGitHubSyncQueueStats();
    expect(stats.claimed).toBe(1);
    expect(stats.reclaimedStale).toBe(1);
    expect(stats.skipped).toBe(1);
  });
});
