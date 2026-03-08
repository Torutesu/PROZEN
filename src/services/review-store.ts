// PROZEN Review Store
// Generates and persists periodic AI reviews:
//   - Evening review (20:00 UTC) — decision log recap + open questions for tomorrow
//   - Weekly retro  (Sunday 08:00 UTC) — bet accuracy retrospective for the past 7 days

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  betSpecs,
  decisionLogs,
  productReviews,
} from "../db/schema.js";

const newId = () => randomUUID().replace(/-/g, "");

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductReviewRecord {
  id: string;
  workspaceId: string;
  productId: string;
  reviewType: string;
  reviewDate: string;
  content: string;
  metadata: Record<string, unknown>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Shared helper: get or generate a review
// ---------------------------------------------------------------------------

async function getOrGenerateReview(
  workspaceId: string,
  productId: string,
  reviewType: "evening_review" | "weekly_retro",
  generate: () => Promise<{ content: string; metadata: Record<string, unknown> }>,
): Promise<ProductReviewRecord> {
  const db = getDb();
  const today = todayUtc();

  const existing = (
    await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.workspaceId, workspaceId),
          eq(productReviews.productId, productId),
          eq(productReviews.reviewType, reviewType),
          eq(productReviews.reviewDate, today),
        ),
      )
      .limit(1)
  )[0];

  if (existing) {
    return {
      id: existing.id,
      workspaceId: existing.workspaceId,
      productId: existing.productId,
      reviewType: existing.reviewType,
      reviewDate: existing.reviewDate,
      content: existing.content,
      metadata: (existing.metadata ?? {}) as Record<string, unknown>,
      generatedAt: existing.generatedAt.toISOString(),
    };
  }

  const { content, metadata } = await generate();

  const id = `review_${newId().slice(0, 16)}`;
  const [row] = await db
    .insert(productReviews)
    .values({
      id,
      workspaceId,
      productId,
      reviewType,
      reviewDate: today,
      content,
      metadata,
    })
    .onConflictDoUpdate({
      target: [
        productReviews.workspaceId,
        productReviews.productId,
        productReviews.reviewType,
        productReviews.reviewDate,
      ],
      set: { content, metadata, generatedAt: new Date() },
    })
    .returning();

  return {
    id: row!.id,
    workspaceId: row!.workspaceId,
    productId: row!.productId,
    reviewType: row!.reviewType,
    reviewDate: row!.reviewDate,
    content: row!.content,
    metadata: (row!.metadata ?? {}) as Record<string, unknown>,
    generatedAt: row!.generatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Evening Review
// Recaps today's decisions, surfaces open bets without progress, and
// proposes 1-3 questions to answer first thing tomorrow.
// ---------------------------------------------------------------------------

export async function getEveningReview(
  workspaceId: string,
  productId: string,
): Promise<ProductReviewRecord> {
  return getOrGenerateReview(workspaceId, productId, "evening_review", async () => {
    const db = getDb();
    const today = todayUtc();

    // Today's decision logs
    const todayDecisions = await db
      .select({ title: decisionLogs.title, decision: decisionLogs.decision, rationale: decisionLogs.rationale })
      .from(decisionLogs)
      .where(
        and(
          eq(decisionLogs.workspaceId, workspaceId),
          eq(decisionLogs.productId, productId),
          sql`date(${decisionLogs.createdAt} AT TIME ZONE 'UTC') = ${today}`,
        ),
      )
      .orderBy(desc(decisionLogs.createdAt))
      .limit(10);

    // Active bets to surface
    const activeBets = await db
      .select({ id: betSpecs.id, title: betSpecs.title, status: betSpecs.status, updatedAt: betSpecs.updatedAt })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .orderBy(desc(betSpecs.updatedAt))
      .limit(10);

    const openBets = activeBets.filter((b) => b.status === "active" || b.status === "draft");

    let content: string;
    try {
      const anthropic = new Anthropic();

      const decisionSummary =
        todayDecisions.length > 0
          ? todayDecisions.map((d) => `- ${d.title}: ${d.decision}`).join("\n")
          : "No decisions were logged today.";

      const betSummary =
        openBets.length > 0
          ? openBets.map((b) => `- [${b.status}] ${b.title}`).join("\n")
          : "No open bets.";

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `You are a PM co-pilot generating an end-of-day review. Today is ${today}.

## Decisions Made Today
${decisionSummary}

## Open Bets
${betSummary}

Write a concise evening review in 4-5 sentences covering:
1. A brief recap of what was decided today (or note if nothing was logged)
2. Which active bet needs attention or a decision tomorrow
3. 1-2 concrete open questions to resolve first thing tomorrow

Tone: thoughtful, forward-looking, like a trusted co-pilot handing off for the evening. No bullet points — flowing prose.`,
          },
        ],
      });

      const block = msg.content[0];
      content =
        block && block.type === "text"
          ? block.text.trim()
          : `Review for ${today}: ${todayDecisions.length} decision(s) logged. ${openBets.length} bet(s) still open.`;
    } catch {
      content =
        todayDecisions.length > 0
          ? `You logged ${todayDecisions.length} decision(s) today. ${openBets.length} bet(s) remain open — review their progress tomorrow.`
          : `No decisions were logged today. Review your ${openBets.length} open bet(s) and consider capturing any implicit decisions made.`;
    }

    return {
      content,
      metadata: {
        decisionsToday: todayDecisions.length,
        openBets: openBets.length,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Weekly Retro
// Retrospective covering bets completed in the past 7 days:
// accuracy of hypotheses, patterns across outcomes, and recommended focus.
// ---------------------------------------------------------------------------

export async function getWeeklyRetro(
  workspaceId: string,
  productId: string,
): Promise<ProductReviewRecord> {
  return getOrGenerateReview(workspaceId, productId, "weekly_retro", async () => {
    const db = getDb();
    const sevenDaysAgo = daysAgoUtc(7);

    // Bets completed in the last 7 days
    const recentlyCompleted = await db
      .select({
        id: betSpecs.id,
        title: betSpecs.title,
        outcomeNote: betSpecs.outcomeNote,
        learningSummary: betSpecs.learningSummary,
        updatedAt: betSpecs.updatedAt,
      })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
          eq(betSpecs.status, "completed"),
          gte(betSpecs.updatedAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(betSpecs.updatedAt))
      .limit(10);

    // Still-active bets for context
    const activeBets = await db
      .select({ title: betSpecs.title, status: betSpecs.status })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
          eq(betSpecs.status, "active"),
        ),
      )
      .limit(5);

    let content: string;
    try {
      const anthropic = new Anthropic();

      const completedSummary =
        recentlyCompleted.length > 0
          ? recentlyCompleted
              .map(
                (b) =>
                  `- "${b.title}": ${b.outcomeNote ?? "no outcome note"}\n  Learning: ${b.learningSummary ?? "none recorded"}`,
              )
              .join("\n")
          : "No bets were completed this week.";

      const activeSummary =
        activeBets.length > 0
          ? activeBets.map((b) => `- [${b.status}] ${b.title}`).join("\n")
          : "No active bets in flight.";

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `You are a PM co-pilot generating a weekly bet accuracy retrospective.

## Bets Completed This Week
${completedSummary}

## Currently Active Bets
${activeSummary}

Write a weekly retrospective in 5-6 sentences covering:
1. How many bets were completed and the overall accuracy rate (did outcomes match hypotheses?)
2. The key pattern or insight across this week's outcomes
3. What to carry forward into next week's bets
4. One strategic recommendation for the most important active bet

Tone: analytical but encouraging, like a mentor reviewing the week's work. No bullet points — flowing prose.`,
          },
        ],
      });

      const block = msg.content[0];
      content =
        block && block.type === "text"
          ? block.text.trim()
          : `This week: ${recentlyCompleted.length} bet(s) completed. Review learnings and adjust active bet hypotheses accordingly.`;
    } catch {
      content =
        recentlyCompleted.length > 0
          ? `This week you completed ${recentlyCompleted.length} bet(s). Review the outcomes and update your active bet strategies based on what you learned.`
          : "No bets were completed this week. Consider reviewing your active bets for blockers or opportunities to accelerate.";
    }

    return {
      content,
      metadata: {
        betsCompleted: recentlyCompleted.length,
        betsActive: activeBets.length,
      },
    };
  });
}
