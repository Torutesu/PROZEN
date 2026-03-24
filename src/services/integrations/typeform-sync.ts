// Typeform sync — hourly polling for NPS / satisfaction survey responses.
//
// Metrics provisioned automatically:
//   kpi       NPS Score         — average NPS from responses (0–10 scale → -100 to +100)
//   activity  Survey Responses  — new response count since last sync
//   kpi       CSAT Score (%)    — % of respondents scoring 8+

import { addReading } from "../metric-store.js";
import {
  findOrCreateMetric,
  getIntegrationConfig,
  getIntegration,
  markSyncSuccess,
  markSyncError,
  type TypeformConfig,
} from "../integration-store.js";

const TYPEFORM_API = "https://api.typeform.com";

interface TypeformAnswer {
  field: { ref: string; type: string };
  type: string;
  number?: number;
  choice?: { label: string };
}

interface TypeformResponse {
  submitted_at: string;
  answers?: TypeformAnswer[];
}

interface TypeformResponsesPayload {
  total_items: number;
  items: TypeformResponse[];
}

function computeNps(scores: number[]): number {
  if (scores.length === 0) return 0;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export async function syncTypeformMetrics(
  workspaceId: string,
  productId: string,
): Promise<void> {
  const config = await getIntegrationConfig<TypeformConfig>(
    workspaceId,
    productId,
    "typeform",
  );
  if (!config) return;

  const connection = await getIntegration(workspaceId, productId, "typeform");
  const since = connection?.lastSyncedAt?.toISOString() ?? undefined;

  const headers = { Authorization: `Bearer ${config.accessToken}` };
  const now = new Date().toISOString();

  try {
    let url = `${TYPEFORM_API}/forms/${config.formId}/responses?page_size=1000`;
    if (since) url += `&since=${since}`;

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Typeform API error ${res.status}: ${text}`);
    }

    const payload = (await res.json()) as TypeformResponsesPayload;
    const responses = payload.items;

    if (responses.length === 0) {
      await markSyncSuccess(workspaceId, productId, "typeform");
      return;
    }

    // Extract NPS scores from number-type answers
    const scores: number[] = [];
    for (const response of responses) {
      for (const answer of response.answers ?? []) {
        if (answer.type === "number" && answer.number !== undefined) {
          scores.push(answer.number);
        }
      }
    }

    // Response count metric
    const responseMetricId = await findOrCreateMetric({
      workspaceId,
      productId,
      name: "Survey Responses",
      layer: "activity",
      unit: "responses",
      direction: "increase",
      source: "typeform",
    });
    await addReading({
      workspaceId,
      productId,
      metricId: responseMetricId,
      value: responses.length,
      recordedAt: now,
      source: "typeform",
      note: since ? `New responses since last sync` : "All responses",
      createdBy: "integration:typeform",
    });

    if (scores.length > 0) {
      // NPS Score
      const nps = computeNps(scores);
      const npsMetricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "NPS Score",
        layer: "kpi",
        unit: "score",
        direction: "increase",
        source: "typeform",
      });
      await addReading({
        workspaceId,
        productId,
        metricId: npsMetricId,
        value: nps,
        recordedAt: now,
        source: "typeform",
        note: `Computed from ${scores.length} responses`,
        createdBy: "integration:typeform",
      });

      // CSAT Score (% scoring 8+)
      const csat = Math.round((scores.filter((s) => s >= 8).length / scores.length) * 100);
      const csatMetricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "CSAT Score",
        layer: "kpi",
        unit: "%",
        direction: "increase",
        source: "typeform",
      });
      await addReading({
        workspaceId,
        productId,
        metricId: csatMetricId,
        value: csat,
        recordedAt: now,
        source: "typeform",
        note: `${scores.filter((s) => s >= 8).length}/${scores.length} rated 8+`,
        createdBy: "integration:typeform",
      });
    }

    await markSyncSuccess(workspaceId, productId, "typeform");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markSyncError(workspaceId, productId, "typeform", msg);
    throw err;
  }
}
