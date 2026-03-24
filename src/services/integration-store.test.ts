import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIntegration,
  findOrCreateMetric,
  getIntegrationConfig,
  listAllActiveIntegrations,
  markSyncError,
  type StripeConfig,
} from "./integration-store.js";

const { getDbMock, encryptSecretMock, decryptSecretMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  encryptSecretMock: vi.fn(),
  decryptSecretMock: vi.fn(),
}));

vi.mock("../db/client.js", () => ({
  getDb: getDbMock,
}));

vi.mock("./secret-crypto.js", () => ({
  encryptSecret: encryptSecretMock,
  decryptSecret: decryptSecretMock,
}));

describe("integration-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    encryptSecretMock.mockImplementation((raw: string) => `enc:${raw}`);
    decryptSecretMock.mockImplementation((raw: string) =>
      raw.startsWith("enc:") ? raw.slice(4) : raw,
    );
  });

  it("createIntegration encrypts config and returns mapped record", async () => {
    let inserted: Record<string, unknown> | null = null;
    const now = new Date("2026-03-10T00:00:00.000Z");
    const returningRow = {
      id: "int_1",
      workspaceId: "ws1",
      productId: "p1",
      provider: "stripe",
      encryptedConfig: "enc:{}",
      syncConfig: { cadence: "hourly" },
      isActive: true,
      lastSyncedAt: null,
      lastSyncError: null,
      createdBy: "user_1",
      createdAt: now,
      updatedAt: now,
    };

    getDbMock.mockReturnValue({
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          inserted = values;
          return {
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(async () => [returningRow]),
            })),
          };
        }),
      })),
    });

    const config: StripeConfig = { restrictedKey: "rk_live", webhookSecret: "whsec_live" };
    const result = await createIntegration({
      workspaceId: "ws1",
      productId: "p1",
      provider: "stripe",
      config,
      syncConfig: { cadence: "hourly" },
      createdBy: "user_1",
    });

    expect(encryptSecretMock).toHaveBeenCalledWith(JSON.stringify(config));
    expect(inserted?.["provider"]).toBe("stripe");
    expect(inserted?.["workspaceId"]).toBe("ws1");
    expect(inserted?.["encryptedConfig"]).toBe(`enc:${JSON.stringify(config)}`);
    expect(result).toMatchObject({
      id: "int_1",
      workspaceId: "ws1",
      productId: "p1",
      provider: "stripe",
      isActive: true,
      createdBy: "user_1",
      syncConfig: { cadence: "hourly" },
    });
  });

  it("getIntegrationConfig decrypts and parses provider config", async () => {
    getDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              { encryptedConfig: 'enc:{"restrictedKey":"rk_test","webhookSecret":"whsec_test"}' },
            ]),
          })),
        })),
      })),
    });

    const config = await getIntegrationConfig<StripeConfig>("ws1", "p1", "stripe");
    expect(config).toEqual({
      restrictedKey: "rk_test",
      webhookSecret: "whsec_test",
    });
  });

  it("getIntegrationConfig returns null when no active connection exists", async () => {
    getDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    });

    const config = await getIntegrationConfig<StripeConfig>("ws1", "p1", "stripe");
    expect(config).toBeNull();
  });

  it("findOrCreateMetric returns existing metric id without inserting", async () => {
    const insertSpy = vi.fn();
    getDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: "met_existing" }]),
          })),
        })),
      })),
      insert: insertSpy,
    });

    const metricId = await findOrCreateMetric({
      workspaceId: "ws1",
      productId: "p1",
      name: "Active Subscriptions",
      layer: "kpi",
      source: "stripe",
    });

    expect(metricId).toBe("met_existing");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("findOrCreateMetric inserts with default direction when missing", async () => {
    let inserted: Record<string, unknown> | null = null;
    getDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (values: Record<string, unknown>) => {
          inserted = values;
          return [];
        }),
      })),
    });

    const metricId = await findOrCreateMetric({
      workspaceId: "ws1",
      productId: "p1",
      name: "NPS Score",
      layer: "kpi",
      source: "typeform",
    });

    expect(metricId.startsWith("met_")).toBe(true);
    expect(inserted?.["direction"]).toBe("increase");
    expect(inserted?.["createdBy"]).toBe("integration:typeform");
    expect(inserted?.["name"]).toBe("NPS Score");
  });

  it("markSyncError stores error message and updates timestamp", async () => {
    let updated: Record<string, unknown> | null = null;
    getDbMock.mockReturnValue({
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updated = values;
            return [];
          }),
        })),
      })),
    });

    await markSyncError("ws1", "p1", "sentry", "token expired");

    expect(updated?.["lastSyncError"]).toBe("token expired");
    expect(updated?.["updatedAt"]).toBeInstanceOf(Date);
  });

  it("listAllActiveIntegrations returns normalized provider rows", async () => {
    getDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { workspaceId: "ws1", productId: "p1", provider: "stripe" },
            { workspaceId: "ws1", productId: "p2", provider: "posthog" },
          ]),
        })),
      })),
    });

    const rows = await listAllActiveIntegrations();
    expect(rows).toEqual([
      { workspaceId: "ws1", productId: "p1", provider: "stripe" },
      { workspaceId: "ws1", productId: "p2", provider: "posthog" },
    ]);
  });
});
