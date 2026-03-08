// PROZEN Scheduled Job Scheduler
// Runs daily and weekly autonomous PM routines per workspace/product.
// Uses Node.js setInterval — no external dependencies required.
//
// Schedule (UTC):
//   Morning briefing  — 07:00 UTC daily
//   Evening review    — 20:00 UTC daily
//   Weekly retro      — Sunday 08:00 UTC
//
// Job state is checked in-process; the actual briefing record acts as the
// idempotency gate (one briefing per product per UTC day).

import { getDb } from "../db/client.js";
import { products, workspaces } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getDailyBriefing } from "../services/briefing-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowUtcHour(): number {
  return new Date().getUTCHours();
}

function nowUtcDay(): number {
  return new Date().getUTCDay(); // 0 = Sunday
}

function nowUtcMinute(): number {
  return new Date().getUTCMinutes();
}

function log(message: string): void {
  process.stdout.write(`[scheduler] ${new Date().toISOString()} ${message}\n`);
}

// ---------------------------------------------------------------------------
// Get all active workspace+product pairs
// ---------------------------------------------------------------------------

async function getActiveProductPairs(): Promise<
  Array<{ workspaceId: string; productId: string }>
> {
  const db = getDb();
  const rows = await db
    .select({ workspaceId: products.workspaceId, productId: products.id })
    .from(products)
    .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
    .where(eq(products.status, "active"));
  return rows;
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------

async function runMorningBriefings(): Promise<void> {
  log("Running morning briefing job...");
  let succeeded = 0;
  let failed = 0;
  try {
    const pairs = await getActiveProductPairs();
    for (const { workspaceId, productId } of pairs) {
      try {
        await getDailyBriefing(workspaceId, productId);
        succeeded++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        log(`  briefing failed for product ${productId}: ${msg}`);
      }
    }
    log(`Morning briefings: ${succeeded} succeeded, ${failed} failed (${pairs.length} total).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Morning briefing job error: ${msg}`);
  }
}

async function runEveningReview(): Promise<void> {
  // Evening review is currently a no-op placeholder.
  // In a future milestone this will generate an evening decision log recap.
  log("Evening review job triggered (placeholder — no action taken).");
}

async function runWeeklyRetro(): Promise<void> {
  // Weekly retrospective is a placeholder.
  // In a future milestone this will generate bet accuracy retrospectives.
  log("Weekly retro job triggered (placeholder — no action taken).");
}

// ---------------------------------------------------------------------------
// Scheduler loop
// ---------------------------------------------------------------------------
// Checks every minute whether a scheduled job should fire.
// Each job has an "already run this UTC hour" guard to prevent duplicate runs.

const firedHours = new Set<string>(); // e.g. "morning:2026-03-08T07"

function hourKey(label: string): string {
  const now = new Date();
  const dateHour = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}`;
  return `${label}:${dateHour}`;
}

function tick(): void {
  const hour = nowUtcHour();
  const minute = nowUtcMinute();

  // Only fire in the first 5 minutes of the target hour to avoid missing the
  // window if the server is briefly down at the exact hour mark.
  if (minute > 5) return;

  // Morning briefing — 07:00 UTC
  if (hour === 7) {
    const key = hourKey("morning");
    if (!firedHours.has(key)) {
      firedHours.add(key);
      void runMorningBriefings();
    }
  }

  // Evening review — 20:00 UTC
  if (hour === 20) {
    const key = hourKey("evening");
    if (!firedHours.has(key)) {
      firedHours.add(key);
      void runEveningReview();
    }
  }

  // Weekly retro — Sunday 08:00 UTC
  if (nowUtcDay() === 0 && hour === 8) {
    const key = hourKey("weekly");
    if (!firedHours.has(key)) {
      firedHours.add(key);
      void runWeeklyRetro();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startScheduler(): () => void {
  log("Scheduler started.");
  const intervalMs = 60_000; // check every minute
  const handle = setInterval(tick, intervalMs);

  // Run an initial tick immediately so briefings fire if the server starts
  // within the target window.
  tick();

  return () => {
    clearInterval(handle);
    log("Scheduler stopped.");
  };
}
