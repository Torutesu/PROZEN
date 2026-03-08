// Daily Briefing Store (M10)
// One AI-generated digest per product per UTC day, cached in DB.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { betSpecs, dailyBriefings, metricAnomalies, metrics } from "../db/schema.js";

const newId = () => randomUUID().replace(/-/g, "");

// Today's date as YYYY-MM-DD (UTC)
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DailyBriefingRecord {
  id: string;
  workspaceId: string;
  productId: string;
  briefingDate: string;
  content: string;
  activeBets: number;
  openAnomalies: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Get (or generate) today's briefing
// ---------------------------------------------------------------------------

export async function getDailyBriefing(
  workspaceId: string,
  productId: string,
): Promise<DailyBriefingRecord> {
  const db = getDb();
  const today = todayUtc();

  // Return cached briefing if already generated today.
  const existing = (
    await db
      .select()
      .from(dailyBriefings)
      .where(
        and(
          eq(dailyBriefings.workspaceId, workspaceId),
          eq(dailyBriefings.productId, productId),
          eq(dailyBriefings.briefingDate, today),
        ),
      )
      .limit(1)
  )[0];

  if (existing) {
    return {
      id: existing.id,
      workspaceId: existing.workspaceId,
      productId: existing.productId,
      briefingDate: existing.briefingDate,
      content: existing.content,
      activeBets: existing.activeBets,
      openAnomalies: existing.openAnomalies,
      generatedAt: existing.generatedAt.toISOString(),
    };
  }

  // Gather context for the briefing.
  const [activeBetRows, anomalyRows] = await Promise.all([
    db
      .select({ id: betSpecs.id, title: betSpecs.title, status: betSpecs.status })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .orderBy(desc(betSpecs.updatedAt))
      .limit(10),
    db
      .select({ id: metricAnomalies.id, severity: metricAnomalies.severity })
      .from(metricAnomalies)
      .innerJoin(metrics, eq(metricAnomalies.metricId, metrics.id))
      .where(
        and(
          eq(metricAnomalies.workspaceId, workspaceId),
          eq(metrics.productId, productId),
          eq(metricAnomalies.isResolved, false),
        ),
      )
      .limit(20),
  ]);

  const activeBets = activeBetRows.filter((b) => b.status === "active" || b.status === "draft");
  const openAnomalies = anomalyRows.length;
  const highAnomalies = anomalyRows.filter((a) => a.severity === "high").length;

  // Generate briefing via Claude.
  let content: string;
  try {
    const anthropic = new Anthropic();

    const betSummary =
      activeBets.length > 0
        ? activeBets.map((b) => `- [${b.status}] ${b.title}`).join("\n")
        : "No active bets.";

    const anomalySummary =
      openAnomalies > 0
        ? `${openAnomalies} open anomalies (${highAnomalies} high severity)`
        : "No open anomalies — metrics look healthy.";

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `You are a PM co-pilot generating a concise daily briefing. Today is ${today}.

## Active Bets
${betSummary}

## Signal Health
${anomalySummary}

Write a focused daily briefing in 3-4 sentences. Cover:
1. The most important bet to focus on today and why
2. Any signals that need attention (anomalies or healthy metrics)
3. One concrete action or decision to make today

Tone: direct, confident, like a trusted advisor. No bullet points — flowing prose.`,
        },
      ],
    });

    const block = msg.content[0];
    content =
      block && block.type === "text"
        ? block.text.trim()
        : "Focus on your active bets today. Check your metrics for any signals that need attention.";
  } catch {
    content =
      activeBets.length > 0
        ? `You have ${activeBets.length} active bet(s) to focus on today.${openAnomalies > 0 ? ` There are ${openAnomalies} open metric anomalies requiring attention.` : " Metrics look healthy."}`
        : "No active bets yet. Consider starting a new bet to track your next product initiative.";
  }

  // Persist.
  const id = `brief_${newId().slice(0, 16)}`;
  const [row] = await db
    .insert(dailyBriefings)
    .values({
      id,
      workspaceId,
      productId,
      briefingDate: today,
      content,
      activeBets: activeBets.length,
      openAnomalies,
    })
    .onConflictDoUpdate({
      target: [dailyBriefings.workspaceId, dailyBriefings.productId, dailyBriefings.briefingDate],
      set: { content, activeBets: activeBets.length, openAnomalies, generatedAt: new Date() },
    })
    .returning();

  return {
    id: row!.id,
    workspaceId: row!.workspaceId,
    productId: row!.productId,
    briefingDate: row!.briefingDate,
    content: row!.content,
    activeBets: row!.activeBets,
    openAnomalies: row!.openAnomalies,
    generatedAt: row!.generatedAt.toISOString(),
  };
}
