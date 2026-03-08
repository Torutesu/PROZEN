import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "../db/client.js";
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

let draining = false;

function computeNextAttempt(failureCount: number, now: Date): Date {
  const exponent = Math.max(0, Math.min(failureCount - 1, 8));
  const delayMs = DEFAULT_BASE_RETRY_MS * (2 ** exponent);
  return new Date(now.getTime() + delayMs);
}

function extractCommitSha(
  event: typeof githubSyncEvents.$inferSelect,
  payload: Record<string, unknown> | null,
): string | null {
  if (event.commitSha) return event.commitSha;
  const pushPayload = payload as GitHubPushPayload | null;
  return typeof pushPayload?.after === "string" ? pushPayload.after : null;
}

async function claimNextDueEvent(): Promise<typeof githubSyncEvents.$inferSelect | null> {
  const db = getDb();
  const now = new Date();
  const candidateStatuses = ["pending", "failed"] as const;

  const due = await db
    .select()
    .from(githubSyncEvents)
    .where(
      and(
        inArray(githubSyncEvents.status, candidateStatuses),
        or(
          isNull(githubSyncEvents.nextAttemptAt),
          lte(githubSyncEvents.nextAttemptAt, now),
        ),
      ),
    )
    .orderBy(asc(githubSyncEvents.createdAt))
    .limit(Math.max(1, DEFAULT_BATCH_SIZE));

  for (const row of due) {
    const claimed = await db
      .update(githubSyncEvents)
      .set({
        status: "processing",
        processingStartedAt: now,
        lastError: null,
      })
      .where(
        and(
          eq(githubSyncEvents.id, row.id),
          inArray(githubSyncEvents.status, candidateStatuses),
        ),
      )
      .returning();
    if (claimed.length > 0) return claimed[0]!;
  }

  return null;
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
  event: typeof githubSyncEvents.$inferSelect,
  error: unknown,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const retryCount = (event.retryCount ?? 0) + 1;
  const message = error instanceof Error ? error.message : String(error);

  if (retryCount >= DEFAULT_MAX_RETRIES) {
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

  await db
    .update(githubSyncEvents)
    .set({
      status: "failed",
      retryCount,
      lastError: message,
      nextAttemptAt: computeNextAttempt(retryCount, now),
      processingStartedAt: null,
    })
    .where(eq(githubSyncEvents.id, event.id));
}

async function processClaimedEvent(event: typeof githubSyncEvents.$inferSelect): Promise<void> {
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
    await db
      .update(githubSyncEvents)
      .set({
        status: "skipped",
        lastError: "Connection is inactive or deleted.",
        processingStartedAt: null,
        processedAt: now,
      })
      .where(eq(githubSyncEvents.id, event.id));
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
        await db
          .update(githubSyncEvents)
          .set({
            status: "skipped",
            processingStartedAt: null,
            processedAt: now,
          })
          .where(eq(githubSyncEvents.id, event.id));
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
      await db
        .update(githubSyncEvents)
        .set({
          status: "skipped",
          processingStartedAt: null,
          processedAt: now,
        })
        .where(eq(githubSyncEvents.id, event.id));
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
