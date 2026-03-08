import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../db/client.js";
import { betSpecVersions, githubConnections, githubSyncEvents } from "../db/schema.js";
import {
  analyzeDiffAgainstBetSpecs,
  fetchCommitDiff,
  fetchPRDiff,
  type BetSpecSummary,
  type GitHubPRPayload,
  type GitHubPushPayload,
} from "./github-sync.js";
import { decryptSecret } from "./secret-crypto.js";
import { getBetSpecs } from "./spec-store.js";

const DEFAULT_BATCH_SIZE = Number(process.env["GITHUB_SYNC_WORKER_BATCH"] ?? 10);
const DEFAULT_INTERVAL_MS = Number(process.env["GITHUB_SYNC_WORKER_INTERVAL_MS"] ?? 5000);
const DEFAULT_MAX_RETRIES = Number(process.env["GITHUB_SYNC_MAX_RETRIES"] ?? 5);
const DEFAULT_BASE_RETRY_MS = Number(process.env["GITHUB_SYNC_BASE_RETRY_MS"] ?? 2000);
const DEFAULT_PROCESSING_STALE_MS = Number(process.env["GITHUB_SYNC_PROCESSING_STALE_MS"] ?? 300000);

let draining = false;

type QueueEvent = typeof githubSyncEvents.$inferSelect;

export interface GitHubSyncQueueStats {
  claimed: number;
  reclaimedStale: number;
  analyzed: number;
  skipped: number;
  failed: number;
  retried: number;
  deadLettered: number;
}

const queueStats: GitHubSyncQueueStats = {
  claimed: 0,
  reclaimedStale: 0,
  analyzed: 0,
  skipped: 0,
  failed: 0,
  retried: 0,
  deadLettered: 0,
};

function queueLog(event: string, meta: Record<string, unknown>): void {
  process.stdout.write(`[github-sync-queue] ${event} ${JSON.stringify(meta)}\n`);
}

function computeNextAttempt(failureCount: number, now: Date): Date {
  const exponent = Math.max(0, Math.min(failureCount - 1, 8));
  const delayMs = DEFAULT_BASE_RETRY_MS * (2 ** exponent);
  return new Date(now.getTime() + delayMs);
}

function extractCommitSha(
  event: QueueEvent,
  payload: Record<string, unknown> | null,
): string | null {
  if (event.commitSha) return event.commitSha;
  const pushPayload = payload as GitHubPushPayload | null;
  return typeof pushPayload?.after === "string" ? pushPayload.after : null;
}

async function loadEventById(id: string): Promise<QueueEvent | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(githubSyncEvents)
      .where(eq(githubSyncEvents.id, id))
      .limit(1)
  )[0];
  return row ?? null;
}

async function claimNextDueEvent(): Promise<QueueEvent | null> {
  const sql = getSqlClient();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - DEFAULT_PROCESSING_STALE_MS);

  const claimed = await sql<{ id: string; previous_status: string }[]>`
    WITH candidate AS (
      SELECT id, status AS previous_status
      FROM github_sync_events
      WHERE (
        (
          status IN ('pending', 'failed')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${now.toISOString()}::timestamptz)
        )
        OR (
          status = 'processing'
          AND processing_started_at IS NOT NULL
          AND processing_started_at <= ${staleBefore.toISOString()}::timestamptz
        )
      )
      ORDER BY next_attempt_at NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE github_sync_events AS e
    SET
      status = 'processing',
      processing_started_at = ${now.toISOString()}::timestamptz,
      last_error = CASE
        WHEN candidate.previous_status = 'processing'
          THEN COALESCE(e.last_error || '; ', '') || 'stale_processing_reclaimed'
        ELSE e.last_error
      END
    FROM candidate
    WHERE e.id = candidate.id
    RETURNING e.id, candidate.previous_status
  `;

  if (claimed.length === 0) {
    return null;
  }

  const first = claimed[0]!;
  const event = await loadEventById(first.id);
  if (!event) {
    return null;
  }

  queueStats.claimed += 1;
  if (first.previous_status === "processing") {
    queueStats.reclaimedStale += 1;
    queueLog("reclaimed_stale_processing", {
      event_id: first.id,
      stale_ms: DEFAULT_PROCESSING_STALE_MS,
    });
  }
  return event;
}

async function loadSpecsWithData(
  workspaceId: string,
  productId: string,
): Promise<BetSpecSummary[]> {
  const db = getDb();
  const betSpecsResult = await getBetSpecs(workspaceId, productId, 100, 0);
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

  return specsWithData;
}

async function markFailed(
  event: QueueEvent,
  error: unknown,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const retryCount = (event.retryCount ?? 0) + 1;
  const message = error instanceof Error ? error.message : String(error);
  queueStats.failed += 1;

  if (retryCount >= DEFAULT_MAX_RETRIES) {
    queueStats.deadLettered += 1;
    queueLog("failed_permanently", {
      event_id: event.id,
      retry_count: retryCount,
      error: message,
    });
    await db
      .update(githubSyncEvents)
      .set({
        status: "failed",
        retryCount,
        lastError: message,
        nextAttemptAt: null,
        processingStartedAt: null,
        processedAt: now,
      })
      .where(eq(githubSyncEvents.id, event.id));
    return;
  }

  const nextAttempt = computeNextAttempt(retryCount, now);
  queueStats.retried += 1;
  queueLog("scheduled_retry", {
    event_id: event.id,
    retry_count: retryCount,
    next_attempt_at: nextAttempt.toISOString(),
    error: message,
  });
  await db
    .update(githubSyncEvents)
    .set({
      status: "failed",
      retryCount,
      lastError: message,
      nextAttemptAt: nextAttempt,
      processingStartedAt: null,
    })
    .where(eq(githubSyncEvents.id, event.id));
}

async function processClaimedEvent(event: QueueEvent): Promise<void> {
  const db = getDb();
  const now = new Date();

  const connection = (
    await db
      .select()
      .from(githubConnections)
      .where(eq(githubConnections.id, event.connectionId))
      .limit(1)
  )[0];

  if (!connection || !connection.isActive) {
    queueStats.skipped += 1;
    await db
      .update(githubSyncEvents)
      .set({
        status: "skipped",
        lastError: "Connection is inactive or deleted.",
        processingStartedAt: null,
        processedAt: now,
      })
      .where(eq(githubSyncEvents.id, event.id));
    queueLog("skipped_inactive_connection", { event_id: event.id });
    return;
  }

  try {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const accessToken = decryptSecret(connection.accessToken);

    let diffText = "";
    let analysis: unknown = null;
    let eventDescription = "";

    if (event.eventType === "push") {
      const commitSha = extractCommitSha(event, payload);
      if (!commitSha) {
        throw new Error("Push event is missing commit SHA.");
      }
      const pushPayload = payload as unknown as GitHubPushPayload;
      const ref = event.ref ?? (typeof pushPayload.ref === "string" ? pushPayload.ref : "");
      eventDescription = `Push to ${ref} (commit: ${commitSha.slice(0, 7)})`;
      diffText = await fetchCommitDiff(event.repository, commitSha, accessToken);
    } else if (event.eventType === "pull_request") {
      const prPayload = payload as unknown as GitHubPRPayload;
      if (!["opened", "synchronize", "reopened"].includes(prPayload.action)) {
        queueStats.skipped += 1;
        await db
          .update(githubSyncEvents)
          .set({
            status: "skipped",
            processingStartedAt: null,
            processedAt: now,
          })
          .where(eq(githubSyncEvents.id, event.id));
        queueLog("skipped_pr_action", { event_id: event.id, action: prPayload.action });
        return;
      }

      const prNumber = event.prNumber ?? prPayload.number;
      if (!Number.isInteger(prNumber)) {
        throw new Error("PR event is missing PR number.");
      }
      const diffUrl =
        prPayload.pull_request?.diff_url ||
        `https://api.github.com/repos/${event.repository}/pulls/${prNumber}`;
      const prTitle = event.prTitle ?? prPayload.pull_request?.title ?? "";
      eventDescription = `PR #${prNumber}: ${prTitle}`;
      diffText = await fetchPRDiff(diffUrl, accessToken);
    } else {
      queueStats.skipped += 1;
      await db
        .update(githubSyncEvents)
        .set({
          status: "skipped",
          processingStartedAt: null,
          processedAt: now,
        })
        .where(eq(githubSyncEvents.id, event.id));
      queueLog("skipped_event_type", { event_id: event.id, event_type: event.eventType });
      return;
    }

    const specsWithData = await loadSpecsWithData(connection.workspaceId, connection.productId);
    if (diffText) {
      analysis = await analyzeDiffAgainstBetSpecs(diffText, specsWithData, eventDescription);
    }

    await db
      .update(githubSyncEvents)
      .set({
        status: "analyzed",
        diffSummary: diffText.slice(0, 500) || null,
        analysis,
        lastError: null,
        nextAttemptAt: null,
        processingStartedAt: null,
        processedAt: now,
      })
      .where(eq(githubSyncEvents.id, event.id));
    queueStats.analyzed += 1;
    queueLog("analyzed", {
      event_id: event.id,
      event_type: event.eventType,
      repository: event.repository,
      retry_count: event.retryCount ?? 0,
    });
  } catch (err) {
    await markFailed(event, err);
  }
}

export async function drainGitHubSyncQueue(maxEvents = DEFAULT_BATCH_SIZE): Promise<number> {
  if (draining) return 0;
  draining = true;
  let processed = 0;

  try {
    for (let i = 0; i < maxEvents; i += 1) {
      const event = await claimNextDueEvent();
      if (!event) break;
      await processClaimedEvent(event);
      processed += 1;
    }
    if (processed > 0) {
      queueLog("drain_complete", { processed });
    }
    return processed;
  } finally {
    draining = false;
  }
}

export function startGitHubSyncQueueWorker(): () => void {
  if (DEFAULT_INTERVAL_MS <= 0) {
    return () => {};
  }

  const timer = setInterval(() => {
    void drainGitHubSyncQueue();
  }, DEFAULT_INTERVAL_MS);

  timer.unref?.();
  void drainGitHubSyncQueue();

  return () => clearInterval(timer);
}

export function getGitHubSyncQueueStats(): GitHubSyncQueueStats {
  return { ...queueStats };
}

export function resetGitHubSyncQueueStatsForTest(): void {
  queueStats.claimed = 0;
  queueStats.reclaimedStale = 0;
  queueStats.analyzed = 0;
  queueStats.skipped = 0;
  queueStats.failed = 0;
  queueStats.retried = 0;
  queueStats.deadLettered = 0;
  draining = false;
}
