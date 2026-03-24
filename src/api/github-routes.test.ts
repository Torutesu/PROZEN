import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware.js";
import githubRoutes from "./github-routes.js";

const {
  getWorkspaceByIdMock,
  getProductByIdMock,
  getDbMock,
  verifyWebhookSignatureMock,
  registerGitHubWebhookMock,
  deleteGitHubWebhookMock,
  encryptSecretMock,
  decryptSecretMock,
  drainGitHubSyncQueueMock,
} = vi.hoisted(() => ({
  getWorkspaceByIdMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getDbMock: vi.fn(),
  verifyWebhookSignatureMock: vi.fn(),
  registerGitHubWebhookMock: vi.fn(),
  deleteGitHubWebhookMock: vi.fn(),
  encryptSecretMock: vi.fn(),
  decryptSecretMock: vi.fn(),
  drainGitHubSyncQueueMock: vi.fn(),
}));

vi.mock("../services/workspace-store.js", () => ({
  getWorkspaceById: getWorkspaceByIdMock,
  getProductById: getProductByIdMock,
}));

vi.mock("../db/client.js", () => ({
  getDb: getDbMock,
}));

vi.mock("../services/github-sync.js", () => ({
  verifyWebhookSignature: verifyWebhookSignatureMock,
  registerGitHubWebhook: registerGitHubWebhookMock,
  deleteGitHubWebhook: deleteGitHubWebhookMock,
}));

vi.mock("../services/secret-crypto.js", () => ({
  encryptSecret: encryptSecretMock,
  decryptSecret: decryptSecretMock,
}));

vi.mock("../services/github-sync-queue.js", () => ({
  drainGitHubSyncQueue: drainGitHubSyncQueueMock,
}));

vi.mock("../services/context-layer.js", () => ({
  ingestContext: vi.fn().mockResolvedValue(undefined),
}));

interface DbState {
  selectQueue: unknown[][];
  insertQueue: unknown[][];
  insertedValues: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}

function createDbState(): DbState {
  return {
    selectQueue: [],
    insertQueue: [],
    insertedValues: [],
    updates: [],
  };
}

function createDbMock(state: DbState) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => state.selectQueue.shift() ?? []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        state.insertedValues.push(values);
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => state.insertQueue.shift() ?? []),
          })),
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(async () => state.insertQueue.shift() ?? []),
          })),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          state.updates.push(values);
          return [];
        }),
      })),
    })),
  };
}

function buildApp() {
  const app = new Hono();
  app.use("*", requestIdMiddleware);
  app.use("*", async (c, next) => {
    c.set("actorId" as never, "user_1");
    await next();
  });
  app.route("/", githubRoutes);
  return app;
}

function defaultWorkspace() {
  return {
    id: "ws_1",
    name: "Workspace",
    ownerUserId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function defaultProduct() {
  return {
    id: "prod_1",
    workspaceId: "ws_1",
    name: "Product",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("github routes", () => {
  let dbState: DbState;

  beforeEach(() => {
    vi.clearAllMocks();
    dbState = createDbState();
    getDbMock.mockReturnValue(createDbMock(dbState));

    getWorkspaceByIdMock.mockResolvedValue(defaultWorkspace());
    getProductByIdMock.mockResolvedValue(defaultProduct());

    verifyWebhookSignatureMock.mockReturnValue(true);
    registerGitHubWebhookMock.mockResolvedValue("wh_12345");
    deleteGitHubWebhookMock.mockResolvedValue(undefined);
    encryptSecretMock.mockImplementation((v: string) => `enc:${v}`);
    decryptSecretMock.mockImplementation((v: string) => (v.startsWith("enc:") ? v.slice(4) : v));
    drainGitHubSyncQueueMock.mockResolvedValue(1);
  });

  it("returns 404 when workspace is not owned by actor", async () => {
    getWorkspaceByIdMock.mockResolvedValueOnce(null);
    const app = buildApp();

    const res = await app.request("/api/v1/workspaces/ws_other/products/prod_1/github-connections");

    expect(res.status).toBe(404);
    expect(getWorkspaceByIdMock).toHaveBeenCalledWith("ws_other", "user_1");
  });

  it("connects repository and cleans previous webhook when reconnecting", async () => {
    dbState.selectQueue.push([
      {
        id: "ghc_old",
        workspaceId: "ws_1",
        productId: "prod_1",
        repository: "owner/old-repo",
        accessToken: "enc:old_pat",
        webhookId: "wh_old",
        webhookSecret: "old_secret",
        isActive: true,
        createdBy: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    dbState.insertQueue.push([
      {
        id: "ghc_new",
        repository: "owner/new-repo",
        isActive: true,
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products/prod_1/github-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repository: "owner/new-repo",
        accessToken: "ghp_new",
        webhookUrl: "https://example.com/api/v1/github/webhook",
      }),
    });

    expect(res.status).toBe(201);
    expect(registerGitHubWebhookMock).toHaveBeenCalledWith(
      "owner/new-repo",
      "ghp_new",
      "https://example.com/api/v1/github/webhook",
      expect.any(String),
    );
    expect(deleteGitHubWebhookMock).toHaveBeenCalledWith(
      "owner/old-repo",
      "wh_old",
      "old_pat",
    );
    expect(dbState.insertedValues[0]?.["accessToken"]).toBe("enc:ghp_new");
  });

  it("disconnects repository and deletes webhook on GitHub", async () => {
    dbState.selectQueue.push([
      {
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
      },
    ]);

    const app = buildApp();
    const res = await app.request("/api/v1/workspaces/ws_1/products/prod_1/github-connections", {
      method: "DELETE",
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body["disconnected"]).toBe(true);
    expect(body["webhook_cleanup"]).toBe("deleted");
    expect(deleteGitHubWebhookMock).toHaveBeenCalledWith("owner/repo", "wh_1", "pat_1");
    expect(dbState.updates[0]).toMatchObject({ isActive: false, webhookId: null });
  });

  it("returns duplicate response for repeated webhook delivery", async () => {
    dbState.selectQueue.push([
      {
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
      },
    ]);
    dbState.insertQueue.push([]);

    const app = buildApp();
    const res = await app.request("/api/v1/github/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "push",
        "x-github-delivery": "delivery_1",
        "x-hub-signature-256": "sha256=valid",
      },
      body: JSON.stringify({
        repository: { full_name: "owner/repo" },
        ref: "refs/heads/main",
        after: "abc1234567890",
      }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body["duplicate"]).toBe(true);
    expect(drainGitHubSyncQueueMock).not.toHaveBeenCalled();
  });

  it("enqueues webhook event and triggers queue drain", async () => {
    dbState.selectQueue.push([
      {
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
      },
    ]);
    dbState.insertQueue.push([{ id: "gse_1" }]);

    const app = buildApp();
    const res = await app.request("/api/v1/github/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "push",
        "x-github-delivery": "delivery_2",
        "x-hub-signature-256": "sha256=valid",
      },
      body: JSON.stringify({
        repository: { full_name: "owner/repo" },
        ref: "refs/heads/main",
        after: "abc1234567890",
      }),
    });

    expect(res.status).toBe(200);
    expect(drainGitHubSyncQueueMock).toHaveBeenCalledTimes(1);
    expect(dbState.insertedValues[0]?.["status"]).toBe("pending");
    expect(dbState.insertedValues[0]?.["payload"]).toMatchObject({
      repository: { full_name: "owner/repo" },
    });
  });

  describe("proposal resolution (accept / dismiss)", () => {
    function defaultSyncEvent(overrides: Record<string, unknown> = {}) {
      return {
        id: "gse_1",
        workspaceId: "ws_1",
        productId: "prod_1",
        eventType: "push",
        status: "analyzed",
        proposalStatus: "pending",
        analysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    it("returns 422 when action is invalid", async () => {
      const app = buildApp();
      const res = await app.request(
        "/api/v1/workspaces/ws_1/products/prod_1/github-sync-events/gse_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unknown" }),
        },
      );
      expect(res.status).toBe(422);
    });

    it("returns 404 when event does not exist", async () => {
      dbState.selectQueue.push([]); // event not found
      const app = buildApp();
      const res = await app.request(
        "/api/v1/workspaces/ws_1/products/prod_1/github-sync-events/gse_missing",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        },
      );
      expect(res.status).toBe(404);
    });

    it("dismisses a proposal and sets status to dismissed", async () => {
      dbState.selectQueue.push([defaultSyncEvent()]);
      const app = buildApp();
      const res = await app.request(
        "/api/v1/workspaces/ws_1/products/prod_1/github-sync-events/gse_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        },
      );
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body["proposal_status"]).toBe("dismissed");
      expect(dbState.updates[0]).toMatchObject({ proposalStatus: "dismissed" });
    });

    it("accepts a proposal and sets status to accepted", async () => {
      dbState.selectQueue.push([defaultSyncEvent()]);
      const app = buildApp();
      const res = await app.request(
        "/api/v1/workspaces/ws_1/products/prod_1/github-sync-events/gse_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        },
      );
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body["proposal_status"]).toBe("accepted");
      expect(dbState.updates[0]).toMatchObject({ proposalStatus: "accepted" });
    });

    it("triggers context ingestion on accept when analysis has affected bets", async () => {
      const { ingestContext } = await import("../services/context-layer.js");
      const analysis = {
        summary: "Auth flow refactored",
        affectedBets: [
          { betSpecId: "bet_1", suggestedUpdate: "Update auth section", reason: "Refactor detected" },
        ],
      };
      dbState.selectQueue.push([defaultSyncEvent({ analysis })]);
      const app = buildApp();
      await app.request(
        "/api/v1/workspaces/ws_1/products/prod_1/github-sync-events/gse_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        },
      );
      // Allow the fire-and-forget ingestContext to settle
      await new Promise((r) => setTimeout(r, 10));
      expect(ingestContext).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_1",
          tags: expect.arrayContaining(["living_spec"]),
        }),
      );
    });
  });
});
