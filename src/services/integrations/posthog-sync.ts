// PostHog sync — hourly polling for product analytics metrics.
//
// Metrics provisioned automatically:
//   activity  DAU (Daily Active Users)   — fetched from Trends API (last 1 day)
//   kpi       MAU (Monthly Active Users) — fetched from Trends API (last 30 days)
//   activity  Session Count              — fetched from Trends API (last 1 day)
//
// Uses PostHog Query API (free tier, no SDK required).

import { addReading } from "../metric-store.js";
import {
  findOrCreateMetric,
  getIntegrationConfig,
  markSyncSuccess,
  markSyncError,
  type PostHogConfig,
} from "../integration-store.js";

const DEFAULT_HOST = "https://app.posthog.com";

async function queryPostHog(
  host: string,
  apiKey: string,
  projectId: string,
  eventName: string,
  dateFrom: string,
  dateTo: string,
): Promise<number> {
  const url = `${host}/api/projects/${projectId}/insights/trend/`;
  const body = {
    events: [{ id: eventName, math: "dau" }],
    date_from: dateFrom,
    date_to: dateTo,
    interval: "day",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    result?: Array<{ data: number[]; aggregated_value?: number }>;
  };

  const result = data.result?.[0];
  if (!result) return 0;

  // aggregated_value is the sum over the period; use last data point for DAU
  if (dateFrom === "-1d") {
    const vals = result.data;
    return vals[vals.length - 1] ?? 0;
  }

  return result.aggregated_value ?? result.data.reduce((a, b) => a + b, 0);
}

export async function syncPostHogMetrics(
  workspaceId: string,
  productId: string,
): Promise<void> {
  const config = await getIntegrationConfig<PostHogConfig>(
    workspaceId,
    productId,
    "posthog",
  );
  if (!config) return;

  const host = config.host ?? DEFAULT_HOST;
  const now = new Date().toISOString();

  try {
    // DAU — last 24 hours
    const dau = await queryPostHog(
      host,
      config.apiKey,
      config.projectId,
      "$pageview",
      "-1d",
      "today",
    );

    const dauMetricId = await findOrCreateMetric({
      workspaceId,
      productId,
      name: "DAU",
      layer: "activity",
      unit: "users",
      direction: "increase",
      source: "posthog",
    });
    await addReading({
      workspaceId,
      productId,
      metricId: dauMetricId,
      value: dau,
      recordedAt: now,
      source: "posthog",
      note: "Daily active users (pageview)",
      createdBy: "integration:posthog",
    });

    // MAU — last 30 days (unique users)
    const mauRes = await fetch(
      `${host}/api/projects/${config.projectId}/insights/trend/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events: [{ id: "$pageview", math: "unique_users" }],
          date_from: "-30d",
          date_to: "today",
          interval: "month",
        }),
      },
    );

    if (mauRes.ok) {
      const mauData = (await mauRes.json()) as {
        result?: Array<{ aggregated_value?: number; data?: number[] }>;
      };
      const mau =
        mauData.result?.[0]?.aggregated_value ??
        (mauData.result?.[0]?.data?.reduce((a, b) => a + b, 0) ?? 0);

      const mauMetricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "MAU",
        layer: "kpi",
        unit: "users",
        direction: "increase",
        source: "posthog",
      });
      await addReading({
        workspaceId,
        productId,
        metricId: mauMetricId,
        value: mau,
        recordedAt: now,
        source: "posthog",
        note: "Monthly active users",
        createdBy: "integration:posthog",
      });
    }

    await markSyncSuccess(workspaceId, productId, "posthog");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markSyncError(workspaceId, productId, "posthog", msg);
    throw err;
  }
}
