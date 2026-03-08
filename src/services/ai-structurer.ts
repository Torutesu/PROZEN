// AI structuring service — converts raw natural language product context
// into a typed ContextPackSections payload via Claude.

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContextPackSections,
  ContextStatement,
  KpiDefinition,
  GlossaryTerm,
} from "../domain/context-pack.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `You are an AI assistant that structures product context for PROZEN, an AI-native product management system.

Extract structured information from the user's raw input and return ONLY a JSON object (no markdown, no explanation) with this exact shape:

{
  "summary": "One-paragraph summary of the product context (max 300 characters)",
  "sections": {
    "productVision": [{ "id": "PV-1", "statement": "...", "confidence": 0.9 }],
    "targetUsers": [{ "id": "TU-1", "statement": "..." }],
    "goals": [{ "id": "GL-1", "statement": "..." }],
    "constraints": [{ "id": "CN-1", "statement": "..." }],
    "kpiDefinitions": [
      {
        "metricId": "retention_d7",
        "metricName": "Day-7 Retention",
        "definition": "Percentage of users who return on day 7",
        "cadence": "weekly",
        "targetDirection": "increase"
      }
    ],
    "glossary": [{ "term": "...", "definition": "..." }],
    "openQuestions": [{ "id": "OQ-1", "statement": "..." }]
  }
}

Rules:
- Extract ONLY what is explicitly stated or strongly implied. Do not invent data.
- Empty arrays are valid for any section with no relevant content.
- confidence is 0–1; omit if unknown.
- ID patterns: PV-N, TU-N, GL-N, CN-N, OQ-N.
- cadence values: "daily" | "weekly" | "monthly" | "quarterly".
- targetDirection values: "increase" | "decrease".
- Return ONLY valid JSON. No markdown fences.`;

export interface StructuringResult {
  summary: string;
  sections: ContextPackSections;
}

export async function structureContextInput(
  rawInput: string,
): Promise<StructuringResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Structure this product context input:\n\n${rawInput}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI structurer returned no text content");
  }

  // Strip markdown code fences if the model emits them despite instructions.
  const raw = textBlock.text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const parsed = JSON.parse(raw) as StructuringResult;
  validateStructuringResult(parsed);
  return parsed;
}

function validateStructuringResult(result: unknown): asserts result is StructuringResult {
  if (
    typeof result !== "object" ||
    result === null ||
    typeof (result as Record<string, unknown>)["summary"] !== "string" ||
    typeof (result as Record<string, unknown>)["sections"] !== "object"
  ) {
    throw new Error("AI structurer returned invalid JSON shape");
  }
}

// Fallback: build a minimal ContextPackSections from raw text
// Used when the AI call is unavailable (e.g. tests without API key).
export function buildSectionsFromRawText(input: string): StructuringResult {
  const lines = input
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pick = (n: number): string => lines[n] ?? lines[0] ?? "Not provided.";

  const sections: ContextPackSections = {
    productVision: [{ id: "PV-1", statement: pick(0) }],
    targetUsers: [{ id: "TU-1", statement: pick(1) }],
    goals: [{ id: "GL-1", statement: pick(2) }],
    constraints: [],
    kpiDefinitions: [],
    glossary: [],
    openQuestions: [
      { id: "OQ-1", statement: "What should be prioritized next?" },
    ],
  };

  const summary = input.replace(/\s+/g, " ").trim().slice(0, 297);
  return { summary: summary.length < input.length ? `${summary}...` : summary, sections };
}
