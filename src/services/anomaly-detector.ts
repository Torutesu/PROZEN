// Anomaly Detector — detects deviations in metric readings and
// generates Claude-powered impact narratives for activity-layer anomalies.

import Anthropic from "@anthropic-ai/sdk";

export type AnomalySeverity = "low" | "medium" | "high";
export type AnomalyDirection = "above_target" | "below_target";

export interface DetectionResult {
  isAnomaly: boolean;
  severity?: AnomalySeverity | undefined;
  direction?: AnomalyDirection | undefined;
  deviationPct?: number | undefined;
}

// ---------------------------------------------------------------------------
// Deviation-based anomaly detection
// Thresholds: >=15% = low, >=30% = medium, >=50% = high
// ---------------------------------------------------------------------------

export function detectAnomaly(
  value: number,
  baselineValue: number | null,
  direction: "increase" | "decrease",
): DetectionResult {
  if (baselineValue === null || baselineValue === 0) {
    return { isAnomaly: false };
  }

  const deviationPct = ((value - baselineValue) / Math.abs(baselineValue)) * 100;

  // Only flag anomaly when moving in the WRONG direction:
  // - "increase" metric: going DOWN (deviationPct < 0) is bad → below_target
  // - "decrease" metric: going UP (deviationPct > 0) is bad → above_target
  const movingInWrongDirection =
    direction === "increase" ? deviationPct < 0 : deviationPct > 0;

  if (!movingInWrongDirection) {
    return { isAnomaly: false };
  }

  const absDeviation = Math.abs(deviationPct);

  let severity: AnomalySeverity;
  if (absDeviation >= 50) {
    severity = "high";
  } else if (absDeviation >= 30) {
    severity = "medium";
  } else if (absDeviation >= 15) {
    severity = "low";
  } else {
    return { isAnomaly: false };
  }

  const anomalyDirection: AnomalyDirection =
    direction === "increase" ? "below_target" : "above_target";

  return {
    isAnomaly: true,
    severity,
    direction: anomalyDirection,
    deviationPct: Math.round(deviationPct * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Impact narrative generator (Claude)
// Triggered when an activity-layer anomaly is detected.
// Produces a brief natural-language estimate of KPI impact.
// ---------------------------------------------------------------------------

export interface ImpactContext {
  metricName: string;
  metricLayer: string;
  unit: string | null;
  baselineValue: number;
  actualValue: number;
  deviationPct: number;
  direction: AnomalyDirection;
  severity: AnomalySeverity;
  // Context pack summary for the product.
  productSummary?: string | undefined;
  // Related KPI metrics for upstream impact estimation.
  relatedKpis?: Array<{ name: string; unit: string | null; currentValue: number }> | undefined;
}

export async function generateImpactNarrative(
  ctx: ImpactContext,
): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return buildOfflineNarrative(ctx);
  }

  const client = new Anthropic({ apiKey });

  const relatedKpisText =
    ctx.relatedKpis && ctx.relatedKpis.length > 0
      ? `Related KPIs:\n${ctx.relatedKpis
          .map((k) => `- ${k.name}: ${k.currentValue}${k.unit ? ` ${k.unit}` : ""}`)
          .join("\n")}`
      : "No related KPIs provided.";

  const productContext = ctx.productSummary
    ? `Product context: ${ctx.productSummary}`
    : "";

  const prompt = `An anomaly was detected in a product metric. Generate a brief (2-3 sentences) impact assessment.

Metric: ${ctx.metricName} (${ctx.metricLayer} layer)
Baseline: ${ctx.baselineValue}${ctx.unit ? ` ${ctx.unit}` : ""}
Actual: ${ctx.actualValue}${ctx.unit ? ` ${ctx.unit}` : ""}
Deviation: ${ctx.deviationPct}% (${ctx.direction.replace("_", " ")})
Severity: ${ctx.severity}
${productContext}
${relatedKpisText}

Write a concise impact assessment: what likely caused this, what KPIs may be affected, and one recommended action. Be specific and direct. No bullet points — just 2-3 sentences of flowing text.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    return response.content[0]?.type === "text"
      ? response.content[0].text.trim()
      : buildOfflineNarrative(ctx);
  } catch {
    return buildOfflineNarrative(ctx);
  }
}

function buildOfflineNarrative(ctx: ImpactContext): string {
  const direction = ctx.direction === "below_target" ? "dropped" : "spiked";
  const absDeviation = Math.abs(ctx.deviationPct);
  return (
    `${ctx.metricName} has ${direction} ${absDeviation}% from baseline — a ${ctx.severity}-severity signal. ` +
    `This ${ctx.metricLayer === "activity" ? "activity metric deviation may cascade to KPI-layer metrics" : "metric shift warrants immediate review"}. ` +
    `Recommended action: investigate root cause and update the associated Bet Spec if scope has changed.`
  );
}
