// AI structuring service — converts raw natural language product context
// into a typed ContextPackSections payload via Claude.

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContextPackSections,
} from "../domain/context-pack.js";
import { KPI_CADENCE } from "../domain/context-pack.js";

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
  if (!hasAnthropicApiKey()) {
    return buildSectionsFromRawText(rawInput);
  }

  try {
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
  } catch {
    return buildSectionsFromRawText(rawInput);
  }
}

function hasAnthropicApiKey(): boolean {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

function validateStructuringResult(result: unknown): asserts result is StructuringResult {
  if (!isRecord(result)) {
    throw new Error("AI structurer returned invalid JSON shape: root object is missing.");
  }

  if (typeof result["summary"] !== "string" || result["summary"].trim().length === 0) {
    throw new Error("AI structurer returned invalid JSON shape: summary is required.");
  }

  const sections = result["sections"];
  if (!isRecord(sections)) {
    throw new Error("AI structurer returned invalid JSON shape: sections is required.");
  }

  assertContextStatements(sections["productVision"], "productVision");
  assertContextStatements(sections["targetUsers"], "targetUsers");
  assertContextStatements(sections["goals"], "goals");
  assertContextStatements(sections["constraints"], "constraints");
  assertKpiDefinitions(sections["kpiDefinitions"]);
  assertGlossary(sections["glossary"]);
  assertContextStatements(sections["openQuestions"], "openQuestions");
}

function assertContextStatements(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`AI structurer returned invalid sections.${field}: array is required.`);
  }
  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error(`AI structurer returned invalid sections.${field}: item must be object.`);
    }
    if (typeof item["id"] !== "string" || item["id"].trim().length === 0) {
      throw new Error(`AI structurer returned invalid sections.${field}: id is required.`);
    }
    if (
      typeof item["statement"] !== "string" ||
      item["statement"].trim().length === 0
    ) {
      throw new Error(`AI structurer returned invalid sections.${field}: statement is required.`);
    }
    if (
      item["confidence"] !== undefined &&
      (typeof item["confidence"] !== "number" ||
        Number.isNaN(item["confidence"]) ||
        item["confidence"] < 0 ||
        item["confidence"] > 1)
    ) {
      throw new Error(`AI structurer returned invalid sections.${field}: confidence must be 0..1.`);
    }
    if (
      item["evidenceLinks"] !== undefined &&
      (!Array.isArray(item["evidenceLinks"]) ||
        item["evidenceLinks"].some((link) => typeof link !== "string"))
    ) {
      throw new Error(`AI structurer returned invalid sections.${field}: evidenceLinks must be string[].`);
    }
  }
}

function assertKpiDefinitions(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error("AI structurer returned invalid sections.kpiDefinitions: array is required.");
  }
  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error("AI structurer returned invalid kpiDefinitions: item must be object.");
    }
    if (
      typeof item["metricId"] !== "string" ||
      typeof item["metricName"] !== "string" ||
      typeof item["definition"] !== "string"
    ) {
      throw new Error("AI structurer returned invalid kpiDefinitions: metric fields are required.");
    }
    if (
      !isKpiCadence(item["cadence"])
    ) {
      throw new Error("AI structurer returned invalid kpiDefinitions: cadence is invalid.");
    }
    if (
      item["targetDirection"] !== undefined &&
      item["targetDirection"] !== "increase" &&
      item["targetDirection"] !== "decrease"
    ) {
      throw new Error("AI structurer returned invalid kpiDefinitions: targetDirection is invalid.");
    }
  }
}

function assertGlossary(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error("AI structurer returned invalid sections.glossary: array is required.");
  }
  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error("AI structurer returned invalid glossary: item must be object.");
    }
    if (
      typeof item["term"] !== "string" ||
      item["term"].trim().length === 0 ||
      typeof item["definition"] !== "string" ||
      item["definition"].trim().length === 0
    ) {
      throw new Error("AI structurer returned invalid glossary: term and definition are required.");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKpiCadence(value: unknown): value is (typeof KPI_CADENCE)[number] {
  return (
    typeof value === "string" &&
    KPI_CADENCE.includes(value as (typeof KPI_CADENCE)[number])
  );
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

  const normalizedInput = input.replace(/\s+/g, " ").trim();
  const summarySource =
    normalizedInput.length > 0 ? normalizedInput : "No context provided.";
  const clippedSummary = summarySource.slice(0, 297);
  return {
    summary:
      clippedSummary.length < summarySource.length
        ? `${clippedSummary}...`
        : clippedSummary,
    sections,
  };
}
