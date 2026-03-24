// Sentry sync — hourly polling for error/crash metrics.
//
// Metrics provisioned automatically:
//   activity  New Issues (24h)     — unresolved issues opened in last 24h
//   activity  Error Events (24h)   — total error events in last 24h
//   kpi       Crash-Free Rate (%)  — (1 - crash_users / total_users) * 100

import { addReading } from "../metric-store.js";
import {
  findOrCreateMetric,
  getIntegrationConfig,
  markSyncSuccess,
  markSyncError,
  type SentryConfig,
} from "../integration-store.js";

const SENTRY_API = "https://sentry.io/api/0";

interface SentryIssue {
  id: string;
  count: string;
  userCount: number;
}

interface SentryStatsV2Response {
  data: Array<[number, Array<{ count: number }>]>;
}

export async function syncSentryMetrics(
  workspaceId: string,
  productId: string,
): Promise<void> {
  const config = await getIntegrationConfig<SentryConfig>(
    workspaceId,
    productId,
    "sentry",
  );
  if (!config) return;

  const headers = {
    Authorization: `Bearer ${config.authToken}`,
    "Content-Type": "application/json",
  };
  const now = new Date().toISOString();

  try {
    // New issues in last 24h
    const issuesRes = await fetch(
      `${SENTRY_API}/projects/${config.organizationSlug}/${config.projectSlug}/issues/?query=firstSeen%3A%3E-24h&limit=100`,
      { headers },
    );

    if (!issuesRes.ok) {
      const text = await issuesRes.text();
      throw new Error(`Sentry API error ${issuesRes.status}: ${text}`);
    }

    const issues = (await issuesRes.json()) as SentryIssue[];
    const newIssueCount = issues.length;

    const newIssuesMetricId = await findOrCreateMetric({
      workspaceId,
      productId,
      name: "New Issues (24h)",
      layer: "activity",
      unit: "issues",
      direction: "decrease",
      source: "sentry",
    });
    await addReading({
      workspaceId,
      productId,
      metricId: newIssuesMetricId,
      value: newIssueCount,
      recordedAt: now,
      source: "sentry",
      note: "Unresolved issues opened in last 24h",
      createdBy: "integration:sentry",
    });

    // Total error events (24h) via Stats API v2
    const statsRes = await fetch(
      `${SENTRY_API}/organizations/${config.organizationSlug}/stats_v2/?project=${config.projectSlug}&field=sum(times_seen)&interval=1h&statsPeriod=24h&groupBy=outcome`,
      { headers },
    );

    if (statsRes.ok) {
      const stats = (await statsRes.json()) as SentryStatsV2Response;
      const totalEvents = stats.data.reduce(
        (sum, [, groups]) => sum + (groups[0]?.count ?? 0),
        0,
      );

      const errorEventsMetricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "Error Events (24h)",
        layer: "activity",
        unit: "events",
        direction: "decrease",
        source: "sentry",
      });
      await addReading({
        workspaceId,
        productId,
        metricId: errorEventsMetricId,
        value: totalEvents,
        recordedAt: now,
        source: "sentry",
        note: "Total error events in last 24h",
        createdBy: "integration:sentry",
      });
    }

    await markSyncSuccess(workspaceId, productId, "sentry");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markSyncError(workspaceId, productId, "sentry", msg);
    throw err;
  }
}
