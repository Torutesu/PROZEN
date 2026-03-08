// GitHub Living Spec routes (M4)
// POST   /api/v1/github/webhook                                        — receive GitHub events
// POST   /api/v1/workspaces/:wId/products/:pId/github-connections      — connect repo
// GET    /api/v1/workspaces/:wId/products/:pId/github-connections      — get connection status
// DELETE /api/v1/workspaces/:wId/products/:pId/github-connections      — disconnect
// GET    /api/v1/workspaces/:wId/products/:pId/github-sync-events      — list sync events

import { eq, and, count, desc } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { githubConnections, githubSyncEvents, betSpecVersions } from "../db/schema.js";
import { apiError, createApp } from "./middleware.js";
import {
  verifyWebhookSignature,
  fetchCommitDiff,
  fetchPRDiff,
  analyzeDiffAgainstBetSpecs,
  registerGitHubWebhook,
  type GitHubPushPayload,
  type GitHubPRPayload,
  type BetSpecSummary,
} from "../services/github-sync.js";
import { getBetSpecs } from "../services/spec-store.js";
import { getProductById, getWorkspaceById } from "../services/workspace-store.js";
import { randomUUID } from "node:crypto";

const app = createApp();
const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";

async function ensureWorkspaceProductAccess(
  actorId: string,
  workspaceId: string,
  productId: string,
): Promise<{ ok: true } | { ok: false; status: 404; code: "not_found"; message: string }> {
  const workspace = await getWorkspaceById(workspaceId, actorId);
  if (!workspace) {
    return { ok: false, status: 404, code: "not_found", message: "Workspace not found." };
  }

  const product = await getProductById(workspaceId, productId);
  if (!product) {
    return { ok: false, status: 404, code: "not_found", message: "Product not found." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// POST /api/v1/github/webhook — receive GitHub push/PR events
// ---------------------------------------------------------------------------
app.post("/api/v1/github/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-hub-signature-256") ?? null;
  const deliveryId = c.req.header("x-github-delivery") ?? randomUUID();
  const eventType = c.req.header("x-github-event") ?? "unknown";
  const hookId = c.req.header("x-github-hook-id") ?? null;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return apiError(c, 400, "invalid_json", "Webhook payload must be valid JSON.");
  }

  const db = getDb();

  // Determine repository from payload
  const rawPayload = payload as Record<string, unknown>;
  const repo = (rawPayload["repository"] as Record<string, unknown> | undefined)?.["full_name"];
  if (typeof repo !== "string") {
    return c.json({ received: true, skipped: true, reason: "no_repository" });
  }

  // Resolve active connection.
  // Prefer webhook ID when present; otherwise fall back to signature matching across repo connections.
  const candidates = hookId
    ? await db
        .select()
        .from(githubConnections)
        .where(
          and(
            eq(githubConnections.repository, repo),
            eq(githubConnections.webhookId, hookId),
            eq(githubConnections.isActive, true),
          ),
        )
        .limit(5)
    : await db
        .select()
        .from(githubConnections)
        .where(
          and(
            eq(githubConnections.repository, repo),
            eq(githubConnections.isActive, true),
          ),
        )
        .limit(50);

  if (candidates.length === 0) {
    return c.json({ received: true, skipped: true, reason: "no_connection" });
  }

  const connection = candidates.find((candidate) =>
    verifyWebhookSignature(rawBody, signature, candidate.webhookSecret),
  );

  // Verify HMAC signature.
  if (!connection) {
    return apiError(c, 401, "invalid_signature", "Webhook signature verification failed.");
  }

  const eventId = `gse_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const inserted = await db
    .insert(githubSyncEvents)
    .values({
      id: eventId,
      connectionId: connection.id,
      workspaceId: connection.workspaceId,
      eventType,
      githubDeliveryId: deliveryId,
      repository: repo,
      status: "pending",
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [githubSyncEvents.connectionId, githubSyncEvents.githubDeliveryId],
    })
    .returning({ id: githubSyncEvents.id });

  // Duplicate delivery for this connection (GitHub retry, etc.)
  if (inserted.length === 0) {
    return c.json({ received: true, duplicate: true }, 200);
  }

  // Process async — respond 200 immediately, process in background
  const processEvent = async () => {
    try {
      let diffText = "";
      let analysis = null;
      let ref: string | undefined;
      let commitSha: string | undefined;
      let prNumber: number | undefined;
      let prTitle: string | undefined;
      let eventDescription = "";

      if (eventType === "push") {
        const pushPayload = payload as GitHubPushPayload;
        ref = pushPayload.ref;
        commitSha = pushPayload.after;
        const shortSha = typeof pushPayload.after === "string"
          ? pushPayload.after.slice(0, 7)
          : "unknown";
        eventDescription = `Push to ${pushPayload.ref} (commit: ${shortSha})`;

        try {
          diffText = await fetchCommitDiff(repo, pushPayload.after, connection.accessToken);
        } catch {
          diffText = "";
        }
      } else if (eventType === "pull_request") {
        const prPayload = payload as GitHubPRPayload;
        if (!["opened", "synchronize", "reopened"].includes(prPayload.action)) {
          await db
            .update(githubSyncEvents)
            .set({
              status: "skipped",
              processedAt: new Date(),
            })
            .where(eq(githubSyncEvents.id, eventId));
          return;
        }
        prNumber = prPayload.number;
        prTitle = prPayload.pull_request.title;
        commitSha = prPayload.pull_request.head.sha;
        eventDescription = `PR #${prPayload.number}: ${prPayload.pull_request.title}`;

        try {
          diffText = await fetchPRDiff(prPayload.pull_request.diff_url, connection.accessToken);
        } catch {
          diffText = "";
        }
      } else {
        // Unsupported event type — mark skipped.
        await db
          .update(githubSyncEvents)
          .set({
            status: "skipped",
            processedAt: new Date(),
          })
          .where(eq(githubSyncEvents.id, eventId));
        return;
      }

      // Fetch active bet specs for this workspace+product
      const betSpecsResult = await getBetSpecs(
        connection.workspaceId,
        connection.productId,
        100,
        0,
      );

      // For each bet spec, fetch the latest version to get structured spec data
      const specsWithData: BetSpecSummary[] = [];
      for (const bet of betSpecsResult.items) {
        if (bet.status !== "active" && bet.status !== "validating") continue;
        if (!bet.currentVersionId) continue;

        const versionRow = (
          await db
            .select()
            .from(betSpecVersions)
            .where(eq(betSpecVersions.id, bet.currentVersionId))
            .limit(1)
        )[0];

        if (!versionRow) continue;

        const structured = versionRow.structuredPayload as Record<string, unknown> | null;
        specsWithData.push({
          id: bet.id,
          title: bet.title,
          hypothesis: (structured?.["hypothesis"] as string | undefined) ?? bet.title,
          acceptanceCriteria: Array.isArray(structured?.["acceptanceCriteria"])
            ? (structured["acceptanceCriteria"] as Array<{ id: string; statement: string }>)
            : [],
          scope: structured?.["scope"] as
            | { inScope: string[]; outOfScope: string[] }
            | undefined,
        });
      }

      // Analyze diff against active bet specs
      if (diffText) {
        try {
          analysis = await analyzeDiffAgainstBetSpecs(diffText, specsWithData, eventDescription);
        } catch {
          analysis = null;
        }
      }

      await db
        .update(githubSyncEvents)
        .set({
          ref,
          commitSha,
          prNumber,
          prTitle,
          diffSummary: diffText.slice(0, 500) || null,
          analysis,
          status: "analyzed",
          processedAt: new Date(),
        })
        .where(eq(githubSyncEvents.id, eventId));
    } catch {
      await db
        .update(githubSyncEvents)
        .set({
          status: "failed",
          processedAt: new Date(),
        })
        .where(eq(githubSyncEvents.id, eventId));
    }
  };

  // Fire-and-forget
  void processEvent();

  return c.json({ received: true, event_id: eventId }, 200);
});

// ---------------------------------------------------------------------------
// POST .../github-connections — connect a GitHub repo
// ---------------------------------------------------------------------------
app.post(`${BASE}/github-connections`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");

  const access = await ensureWorkspaceProductAccess(actorId, workspaceId, productId);
  if (!access.ok) {
    return apiError(c, access.status, access.code, access.message);
  }

  let body: unknown;
  try {
    const raw = await c.req.text();
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;

  if (typeof b["repository"] !== "string" || b["repository"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"repository" is required (e.g. "owner/repo").');
  }
  if (typeof b["accessToken"] !== "string" || b["accessToken"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"accessToken" (GitHub PAT) is required.');
  }
  if (typeof b["webhookUrl"] !== "string" || b["webhookUrl"].trim().length === 0) {
    return apiError(c, 422, "invalid_payload", '"webhookUrl" is required.');
  }

  const repository = b["repository"].trim();
  const accessToken = b["accessToken"].trim();
  const webhookUrl = b["webhookUrl"].trim();

  // Generate a webhook secret
  const webhookSecret = randomUUID().replace(/-/g, "");

  let webhookId: string;
  try {
    webhookId = await registerGitHubWebhook(repository, accessToken, webhookUrl, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register webhook.";
    return apiError(c, 502, "github_error", message);
  }

  const db = getDb();
  const connectionId = `ghc_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = new Date();

  try {
    const [row] = await db
      .insert(githubConnections)
      .values({
        id: connectionId,
        workspaceId,
        productId,
        repository,
        accessToken, // TODO M5: encrypt before storing
        webhookId,
        webhookSecret,
        isActive: true,
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [githubConnections.workspaceId, githubConnections.productId],
        set: {
          repository,
          accessToken,
          webhookId,
          webhookSecret,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning();

    return c.json(
      {
        connection_id: row!.id,
        repository: row!.repository,
        is_active: row!.isActive,
        created_at: row!.createdAt,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save connection.";
    return apiError(c, 500, "create_error", message);
  }
});

// ---------------------------------------------------------------------------
// GET .../github-connections — get current connection
// ---------------------------------------------------------------------------
app.get(`${BASE}/github-connections`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const access = await ensureWorkspaceProductAccess(actorId, workspaceId, productId);
  if (!access.ok) {
    return apiError(c, access.status, access.code, access.message);
  }
  const db = getDb();

  const connection = (
    await db
      .select()
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.workspaceId, workspaceId),
          eq(githubConnections.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!connection) {
    return c.json({ connected: false, connection: null });
  }

  return c.json({
    connected: connection.isActive,
    connection: {
      connection_id: connection.id,
      repository: connection.repository,
      webhook_id: connection.webhookId,
      is_active: connection.isActive,
      created_at: connection.createdAt,
      updated_at: connection.updatedAt,
    },
  });
});

// ---------------------------------------------------------------------------
// DELETE .../github-connections — disconnect
// ---------------------------------------------------------------------------
app.delete(`${BASE}/github-connections`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const access = await ensureWorkspaceProductAccess(actorId, workspaceId, productId);
  if (!access.ok) {
    return apiError(c, access.status, access.code, access.message);
  }
  const db = getDb();

  const connection = (
    await db
      .select()
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.workspaceId, workspaceId),
          eq(githubConnections.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!connection) {
    return apiError(c, 404, "not_found", "No GitHub connection found for this product.");
  }

  await db
    .update(githubConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(githubConnections.id, connection.id));

  return c.json({ disconnected: true, connection_id: connection.id });
});

// ---------------------------------------------------------------------------
// GET .../github-sync-events — list sync events
// ---------------------------------------------------------------------------
app.get(`${BASE}/github-sync-events`, async (c) => {
  const { workspaceId, productId } = c.req.param();
  const actorId = c.get("actorId");
  const rawLimit = c.req.query("limit");
  const rawOffset = c.req.query("offset");

  const access = await ensureWorkspaceProductAccess(actorId, workspaceId, productId);
  if (!access.ok) {
    return apiError(c, access.status, access.code, access.message);
  }

  const parsedLimit = rawLimit === undefined ? 20 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return apiError(c, 422, "invalid_query", '"limit" must be a positive integer.');
  }
  const limit = Math.min(parsedLimit, 100);

  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    return apiError(c, 422, "invalid_query", '"offset" must be a non-negative integer.');
  }

  const db = getDb();

  const connection = (
    await db
      .select()
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.workspaceId, workspaceId),
          eq(githubConnections.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!connection) {
    return c.json({ total: 0, limit, offset, items: [] });
  }

  const whereClause = and(
    eq(githubSyncEvents.connectionId, connection.id),
    eq(githubSyncEvents.workspaceId, workspaceId),
  );
  const totalRow = (
    await db
      .select({ total: count() })
      .from(githubSyncEvents)
      .where(whereClause)
  )[0];

  const rows = await db
    .select()
    .from(githubSyncEvents)
    .where(whereClause)
    .orderBy(desc(githubSyncEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    total: Number(totalRow?.total ?? 0),
    limit,
    offset,
    items: rows.map((r) => ({
      id: r.id,
      event_type: r.eventType,
      repository: r.repository,
      ref: r.ref,
      commit_sha: r.commitSha,
      pr_number: r.prNumber,
      pr_title: r.prTitle,
      diff_summary: r.diffSummary,
      analysis: r.analysis,
      status: r.status,
      created_at: r.createdAt,
      processed_at: r.processedAt,
    })),
  });
});

export default app;
