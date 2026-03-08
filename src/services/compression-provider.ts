// Compression provider — routes to The Token Company or internal Claude fallback.
//
// Environment variables:
//   TOKEN_COMPANY_ENABLED        "true" to activate external provider (default: false)
//   TOKEN_COMPANY_API_KEY        Required when enabled
//   TOKEN_COMPANY_MODEL          Model slug (default: "bear-1.2")
//   TOKEN_COMPANY_AGGRESSIVENESS 0–1 float (default: 0.15)
//   TOKEN_COMPANY_TIMEOUT_MS     Request timeout in ms (default: 2500)

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompressionInput {
  text: string;
  safeTerms?: string[];
  aggressiveness?: number;
  timeoutMs?: number;
}

export interface CompressionOutput {
  compressedText: string;
  inputTokens: number;
  outputTokens: number;
  compressionRatio: number;
  provider: "internal" | "token_company";
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    enabled: process.env.TOKEN_COMPANY_ENABLED === "true",
    apiKey: process.env.TOKEN_COMPANY_API_KEY ?? "",
    model: process.env.TOKEN_COMPANY_MODEL ?? "bear-1.2",
    aggressiveness: parseFloat(
      process.env.TOKEN_COMPANY_AGGRESSIVENESS ?? "0.15",
    ),
    timeoutMs: parseInt(process.env.TOKEN_COMPANY_TIMEOUT_MS ?? "2500", 10),
  };
}

// ---------------------------------------------------------------------------
// Internal compression (Claude)
// ---------------------------------------------------------------------------

async function compressViaInternal(
  input: CompressionInput,
): Promise<CompressionOutput> {
  const client = new Anthropic();
  const aggressiveness = input.aggressiveness ?? 0.15;

  const compressionLevel =
    aggressiveness < 0.1
      ? "light — preserve nearly all detail"
      : aggressiveness < 0.3
        ? "moderate — preserve key entities, condense supporting detail"
        : aggressiveness < 0.6
          ? "aggressive — keep only critical facts and entities"
          : "maximum — strip everything except essential statements";

  const safeTermsNote =
    input.safeTerms && input.safeTerms.length > 0
      ? `\nCritical terms that MUST appear verbatim in the output: ${input.safeTerms.join(", ")}`
      : "";

  const systemPrompt = `You are a context compression assistant. Compress product context text while preserving semantic meaning and all critical entities.

Compression level: ${compressionLevel}${safeTermsNote}

Rules:
- Preserve all IDs (e.g., PV-1, TU-2, GL-3), metric IDs, and glossary terms exactly as written.
- Remove redundant phrasing, filler words, and restatements.
- Maintain the original structure and section ordering.
- Return ONLY the compressed text, no commentary.`;

  const t0 = Date.now();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: input.text }],
  });
  const latencyMs = Date.now() - t0;

  const compressedText =
    response.content[0]?.type === "text" ? response.content[0].text : input.text;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const compressionRatio = inputTokens > 0 ? outputTokens / inputTokens : 1;

  return {
    compressedText,
    inputTokens,
    outputTokens,
    compressionRatio,
    provider: "internal",
    model: "claude-sonnet-4-6",
    latencyMs,
    fallbackUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Token Company provider
// ---------------------------------------------------------------------------

async function compressViaTokenCompany(
  input: CompressionInput,
  config: ReturnType<typeof getConfig>,
): Promise<CompressionOutput> {
  const timeoutMs = input.timeoutMs ?? config.timeoutMs;
  const aggressiveness = input.aggressiveness ?? config.aggressiveness;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const t0 = Date.now();
  let response: Response;
  try {
    response = await fetch("https://api.thetokencompany.ai/v1/compress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        text: input.text,
        model: config.model,
        aggressiveness,
        safe_terms: input.safeTerms ?? [],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - t0;

  if (!response.ok) {
    throw new Error(
      `Token Company API error: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as {
    compressed_text: string;
    input_tokens: number;
    output_tokens: number;
    compression_ratio: number;
  };

  return {
    compressedText: body.compressed_text,
    inputTokens: body.input_tokens,
    outputTokens: body.output_tokens,
    compressionRatio: body.compression_ratio,
    provider: "token_company",
    model: config.model,
    latencyMs,
    fallbackUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function compress(
  input: CompressionInput,
): Promise<CompressionOutput> {
  const config = getConfig();

  if (!config.enabled || !config.apiKey) {
    return compressViaInternal(input);
  }

  try {
    return await compressViaTokenCompany(input, config);
  } catch (err) {
    console.warn(
      "[compression-provider] Token Company failed, falling back to internal:",
      err instanceof Error ? err.message : err,
    );
    const result = await compressViaInternal(input);
    return { ...result, fallbackUsed: true };
  }
}
