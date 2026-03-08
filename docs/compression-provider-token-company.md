# Context Compression Provider Plan (The Token Company)

Version: 1.0  
Date: 2026-03-08  
Owner: Platform / Context Layer

## 1. Decision

PROZEN will use **The Token Company** as an optional external provider for `FR-CL-005` context compression.

This is a **provider implementation**, not a product dependency:
- Default path remains internal compression.
- External provider is enabled only by feature flag.
- Fallback to internal compression is mandatory on provider error/timeout.

## 2. Why This Fits

Goals for compression operations:
- Reduce token usage for long-lived Context Pack history.
- Preserve key entities and retrieval quality.
- Keep latency and cost predictable.

The Token Company API offers:
- Direct text compression endpoint.
- Tunable aggressiveness.
- Safety tags for preserving critical tokens.

## 3. Non-Goals

- No vendor lock-in in schema or domain contracts.
- No mandatory dependency for local development.
- No external call in critical write paths without fallback.

## 4. Integration Contract

Provider interface (logical):
- `compress(input, options) -> { compressedText, compressionRatio, tokenStats, providerMeta }`

Common options:
- `aggressiveness` (default `0.15`)
- `safeTerms` (IDs, metrics, domain entities)
- `timeoutMs` (default `2500`)

Required output fields:
- `compressedText`
- `inputTokens`
- `outputTokens`
- `compressionRatio`
- `provider` (`internal` | `token_company`)
- `model`
- `latencyMs`
- `fallbackUsed` (boolean)

## 5. Runtime Controls

Environment variables:
- `TOKEN_COMPANY_ENABLED` (`true`/`false`, default `false`)
- `TOKEN_COMPANY_API_KEY`
- `TOKEN_COMPANY_MODEL` (default `bear-1.2`)
- `TOKEN_COMPANY_AGGRESSIVENESS` (default `0.15`)
- `TOKEN_COMPANY_TIMEOUT_MS` (default `2500`)

Feature flags:
- `compression.provider.shadow_mode` (invoke provider, do not serve output)
- `compression.provider.canary_percent` (0-100)

## 6. Rollout Plan

1. **Shadow mode**  
   Internal output is served. Provider output is logged for offline quality comparison.
2. **Canary (5% -> 25% -> 50%)**  
   Gradual serve path with automatic rollback on SLO breach.
3. **General availability**  
   Keep internal fallback permanently enabled.

Rollback conditions:
- Provider error rate above threshold.
- P95 latency above threshold.
- Quality guardrail breach (retrieval mismatch / missing protected entities).

## 7. Observability

Per workspace and global:
- Compression success rate
- Fallback rate
- P50/P95 latency
- Input/output token counts
- Estimated cost savings
- Quality score delta vs internal compressor

Audit metadata fields:
- `compression_provider`
- `compression_model`
- `compression_ratio`
- `fallback_used`

## 8. Security and Data Handling

- Do not send secrets or credentials in compressible text.
- Redact sensitive fields before external provider call.
- Log only hashes/summaries of raw payload where possible.
- Keep provider key in secret manager only.

## 9. Open Items

- Define quantitative quality threshold for rollout gate.
- Define maximum payload size and chunking strategy.
- Add provider-specific integration tests and contract tests.

