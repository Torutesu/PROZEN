// Spec Agent — multi-turn Claude conversation → BetSpec generation.
// Each call to sendMessage() passes the full conversation history + Context Pack
// to Claude, which responds conversationally and optionally generates a BetSpec.

import Anthropic from "@anthropic-ai/sdk";
import type { BetSpec } from "../domain/bet-spec.js";

export type AgentState = "collecting" | "clarifying" | "generating" | "done";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AgentResponse {
  reply: string;
  state: AgentState;
  spec?: BetSpec | undefined;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(contextPackJson: string | null): string {
  const contextSection = contextPackJson
    ? `## Product Context Pack\nUse this as background knowledge about the product:\n\`\`\`json\n${contextPackJson}\n\`\`\``
    : `## Product Context Pack\nNo context pack available yet. Ask the user to describe their product if needed.`;

  return `You are the PROZEN Spec Agent — an expert AI product manager that helps solopreneurs turn product ideas into structured, actionable Bet Specs.

${contextSection}

## Your Role
Guide the user through a conversation to understand their product bet, then generate a complete BetSpec.
A "bet" is a product initiative with a clear hypothesis: "We believe [doing X] for [user segment] will [achieve Y], as evidenced by [metric Z]."

## Conversation Stages
- **collecting**: Gathering initial information (problem, hypothesis, expected impact)
- **clarifying**: Asking follow-up questions about gaps (metrics, scope, risks, timeline)
- **generating**: BetSpec is ready — output the full spec JSON
- **done**: User has confirmed the spec is acceptable

## What to Collect
Required (ask if missing):
1. Problem statement and user segment
2. Hypothesis ("We believe...")
3. At least one expected metric impact (what moves, by how much)
4. Acceptance criteria (how will we know it worked?)
5. Target decision date

Helpful (ask once you have required fields):
- Out-of-scope boundaries
- Known risks and assumptions
- Review cadence preference

## BetSpec Format Rules
- betId: use the id passed in context (do NOT generate a new one)
- workspaceId, productId: use values from context
- status: always "draft" when generating
- priority: infer from urgency language ("critical", "ASAP" → high/critical)
- All string IDs for acceptanceCriteria use pattern "AC-N" (AC-1, AC-2...)
- All risk IDs use "R-N", assumption IDs use "A-N", dependency IDs use "D-N"
- timeline.createdDate: today's date in YYYY-MM-DD format
- timeline.targetDecisionDate: 2 weeks from today unless user specifies
- links.contextPackVersionId: use the value from context (or empty string if none)
- links.decisionLogIds: [] unless user mentions specific decisions
- createdAt/updatedAt: current ISO timestamp
- createdBy/updatedBy: use the actorId from context

## Output Format
Always respond with ONLY a JSON object (no markdown, no explanation outside JSON):
\`\`\`
{
  "reply": "your conversational message to the user",
  "state": "collecting" | "clarifying" | "generating" | "done",
  "spec": { /* full BetSpec — only include when state is generating or done */ }
}
\`\`\`

Generate the spec when you have enough information for all required fields.
Ask at most 2-3 questions per turn. Be concise and direct — the user is a busy solopreneur.`;
}

// ---------------------------------------------------------------------------
// Parse agent response
// ---------------------------------------------------------------------------

function parseAgentResponse(raw: string): AgentResponse {
  // Strip markdown code fences if present.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: treat the whole response as a plain reply.
    return { reply: raw.trim(), state: "collecting" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { reply: raw.trim(), state: "collecting" };
  }

  const obj = parsed as Record<string, unknown>;
  const reply = typeof obj["reply"] === "string" ? obj["reply"] : raw.trim();
  const state: AgentState =
    obj["state"] === "collecting" ||
    obj["state"] === "clarifying" ||
    obj["state"] === "generating" ||
    obj["state"] === "done"
      ? (obj["state"] as AgentState)
      : "collecting";

  const spec =
    (state === "generating" || state === "done") &&
    typeof obj["spec"] === "object" &&
    obj["spec"] !== null
      ? (obj["spec"] as BetSpec)
      : undefined;

  return { reply, state, spec };
}

// ---------------------------------------------------------------------------
// Main: call Claude with full conversation history
// ---------------------------------------------------------------------------

export interface AgentCallInput {
  messages: ConversationMessage[];
  contextPackJson: string | null;
  // Injected into system prompt for spec generation.
  betId: string;
  workspaceId: string;
  productId: string;
  actorId: string;
  contextPackVersionId: string;
}

export async function callSpecAgent(
  input: AgentCallInput,
): Promise<AgentResponse> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    // Offline fallback for tests / local dev without API key.
    return buildOfflineResponse(input);
  }

  const client = new Anthropic({ apiKey });

  // Inject bet metadata as a system-level context note.
  const contextNote = `\n\n## Current Bet Metadata (use these values in the spec)
- betId: ${input.betId}
- workspaceId: ${input.workspaceId}
- productId: ${input.productId}
- actorId (createdBy/updatedBy): ${input.actorId}
- contextPackVersionId: ${input.contextPackVersionId}`;

  const systemPrompt =
    buildSystemPrompt(input.contextPackJson) + contextNote;

  const anthropicMessages: Anthropic.MessageParam[] = input.messages.map(
    (m) => ({
      role: m.role,
      content: m.content,
    }),
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return parseAgentResponse(rawText);
}

// ---------------------------------------------------------------------------
// Offline fallback (no API key)
// ---------------------------------------------------------------------------

function buildOfflineResponse(input: AgentCallInput): AgentResponse {
  const count = input.messages.filter((m) => m.role === "user").length;

  if (count === 1) {
    return {
      reply:
        "Got it! To shape this into a proper Bet Spec, I need a few more details:\n\n" +
        "1. Who is the primary user segment for this bet?\n" +
        "2. What metric will you move, and by how much?\n" +
        "3. What's your target decision date?",
      state: "clarifying",
    };
  }

  if (count === 2) {
    return {
      reply:
        "Great context. One more thing — what are the main risks or assumptions you're making with this bet?",
      state: "clarifying",
    };
  }

  // After 3+ turns, generate a placeholder spec.
  const firstUserMsg = input.messages.find((m) => m.role === "user")?.content ?? "Untitled bet";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const spec: BetSpec = {
    schemaVersion: "1.0.0",
    betId: input.betId,
    workspaceId: input.workspaceId,
    productId: input.productId,
    title: firstUserMsg.slice(0, 80),
    status: "draft",
    priority: "medium",
    owner: "user",
    hypothesis:
      "We believe that implementing this feature will improve user outcomes, as evidenced by increased engagement.",
    problemStatement: firstUserMsg.slice(0, 200),
    userSegment: "Primary users",
    intent: ["Improve user experience"],
    constraints: ["Must ship within current sprint capacity"],
    expectedImpacts: [
      {
        metricId: "metric_1",
        metricName: "Engagement Rate",
        layer: "kpi",
        targetType: "relative",
        direction: "increase",
        baselineValue: 20,
        targetValue: 25,
        unit: "%",
        confidence: 0.6,
        evaluationWindowDays: 30,
      },
    ],
    scope: {
      inScope: ["Core feature implementation"],
      outOfScope: ["Third-party integrations"],
    },
    acceptanceCriteria: [
      {
        id: "AC-1",
        type: "functional",
        priority: "p0",
        statement: "Feature works as described in the hypothesis",
        verificationMethod: "manual",
        status: "pending",
      },
    ],
    risks: [
      {
        id: "R-1",
        statement: "User adoption may be slower than expected",
        severity: "medium",
      },
    ],
    assumptions: [
      {
        id: "A-1",
        statement: "Users want this feature",
        confidence: "medium",
      },
    ],
    dependencies: [],
    instrumentationPlan: [
      {
        eventName: "feature_engaged",
        description: "User interacts with the new feature",
        layer: "activity",
      },
    ],
    timeline: {
      createdDate: today,
      targetDecisionDate: twoWeeks,
      reviewCadence: "weekly",
    },
    links: {
      contextPackVersionId: input.contextPackVersionId,
      decisionLogIds: [],
    },
    tags: [],
    createdAt: now.toISOString(),
    createdBy: input.actorId,
    updatedAt: now.toISOString(),
    updatedBy: input.actorId,
  };

  return {
    reply:
      "Based on our conversation, I've drafted your Bet Spec. Review it and let me know what to adjust — or say \"looks good\" to finalize it.",
    state: "generating",
    spec,
  };
}
