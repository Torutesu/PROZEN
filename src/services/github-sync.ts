// GitHub Living Spec — fetches diffs from GitHub and uses Claude to analyze
// how code changes affect active Bet Specs.

import { createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BetSpecSummary {
  id: string;
  title: string;
  hypothesis: string;
  acceptanceCriteria: Array<{ id: string; statement: string }>;
  scope?: { inScope: string[]; outOfScope: string[] } | undefined;
}

export interface AffectedBet {
  betSpecId: string;
  sections: string[];
  reason: string;
  suggestedUpdate: string;
}

export interface DiffAnalysis {
  summary: string;
  affectedBets: AffectedBet[];
  confidence: "low" | "medium" | "high";
}

export interface GitHubPushPayload {
  ref: string;
  after: string;
  repository: { full_name: string };
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  compare: string;
}

export interface GitHubPRPayload {
  action: string;
  number: number;
  pull_request: {
    title: string;
    body: string | null;
    head: { sha: string };
    diff_url: string;
  };
  repository: { full_name: string };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fetch diff from GitHub API
// ---------------------------------------------------------------------------

const MAX_DIFF_CHARS = 8000;

export async function fetchCommitDiff(
  repository: string,
  sha: string,
  accessToken: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${repository}/commits/${sha}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "PROZEN/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }

  const diff = await res.text();
  return diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]"
    : diff;
}

export async function fetchPRDiff(
  diffUrl: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(diffUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "PROZEN/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub PR diff fetch error ${res.status}`);
  }

  const diff = await res.text();
  return diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]"
    : diff;
}

// ---------------------------------------------------------------------------
// Claude diff analysis
// ---------------------------------------------------------------------------

export async function analyzeDiffAgainstBetSpecs(
  diff: string,
  betSpecs: BetSpecSummary[],
  eventDescription: string,
): Promise<DiffAnalysis> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || betSpecs.length === 0) {
    return buildOfflineAnalysis(diff, betSpecs);
  }

  const client = new Anthropic({ apiKey });

  const specsText = betSpecs
    .map(
      (b) =>
        `BetSpec ID: ${b.id}\nTitle: ${b.title}\nHypothesis: ${b.hypothesis}\nAcceptance Criteria:\n${b.acceptanceCriteria.map((ac) => `  - ${ac.id}: ${ac.statement}`).join("\n")}${b.scope ? `\nIn Scope: ${b.scope.inScope.join(", ")}` : ""}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are analyzing a GitHub code change to identify which product Bet Specs might need updating.

Event: ${eventDescription}

Active Bet Specs:
${specsText}

Code Diff:
\`\`\`diff
${diff}
\`\`\`

Analyze whether this code change affects any of the Bet Specs above. Look for:
- Changed files that relate to features described in the bet hypotheses
- New/removed functionality that affects acceptance criteria
- Scope changes (in-scope features added, out-of-scope things implemented)

Respond with ONLY valid JSON (no markdown):
{
  "summary": "one sentence describing what changed in the code",
  "affectedBets": [
    {
      "betSpecId": "bet_...",
      "sections": ["acceptanceCriteria", "scope"],
      "reason": "brief explanation of why this bet is affected",
      "suggestedUpdate": "concrete suggestion for updating the spec"
    }
  ],
  "confidence": "low" | "medium" | "high"
}

If no bets are affected, return empty affectedBets array.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(cleaned) as DiffAnalysis;
    return {
      summary: parsed.summary ?? "Code change analyzed.",
      affectedBets: Array.isArray(parsed.affectedBets) ? parsed.affectedBets : [],
      confidence: parsed.confidence ?? "medium",
    };
  } catch {
    return buildOfflineAnalysis(diff, betSpecs);
  }
}

function buildOfflineAnalysis(
  diff: string,
  betSpecs: BetSpecSummary[],
): DiffAnalysis {
  const lines = diff.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).length;
  return {
    summary: `Code change touching ~${lines} lines. Manual review recommended against ${betSpecs.length} active bet(s).`,
    affectedBets: [],
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
// Register webhook on GitHub repo
// ---------------------------------------------------------------------------

export async function registerGitHubWebhook(
  repository: string,
  accessToken: string,
  webhookUrl: string,
  secret: string,
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repository}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "PROZEN/1.0",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push", "pull_request"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to register webhook: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: number };
  return String(data.id);
}

// ---------------------------------------------------------------------------
// Delete webhook on GitHub repo
// ---------------------------------------------------------------------------

export async function deleteGitHubWebhook(
  repository: string,
  webhookId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${repository}/hooks/${webhookId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PROZEN/1.0",
    },
  });

  // Already removed (or never existed) should be treated as success for cleanup.
  if (res.status === 404) return;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to delete webhook: ${res.status} ${body}`);
  }
}
