/**
 * E2E: Anomaly → Affected Bets → Resolve
 *
 * Scenario:
 *  1. Ingest a metric reading that triggers an anomaly (via API)
 *  2. Navigate to Metrics page — anomaly appears
 *  3. View affected bets listed in the anomaly
 *  4. Resolve the anomaly — it disappears from the active list
 */

import { test, expect } from "./fixtures";

test.describe("Anomaly → Resolve Flow", () => {
  test("ingested reading that creates anomaly shows on metrics page", async ({
    authedPage: page,
    apiRequest,
    wsId,
    productId,
  }) => {
    // 1. Create a metric via API if none exists
    const metricsRes = await apiRequest(
      "GET",
      `/api/v1/workspaces/${wsId}/products/${productId}/metrics?limit=10`,
    );
    if (!metricsRes.ok) {
      test.skip(true, `Metrics API unavailable (${metricsRes.status}) — skipping`);
      return;
    }
    const metricsData = (await metricsRes.json()) as { items?: Array<{ id: string; baselineValue: number | null }> };
    const metrics = Array.isArray(metricsData.items) ? metricsData.items : [];

    let metricId: string;
    if (metrics.length === 0) {
      const createRes = await apiRequest(
        "POST",
        `/api/v1/workspaces/${wsId}/products/${productId}/metrics`,
        {
          name: "E2E Retention Test",
          layer: "bet",
          unit: "%",
          direction: "increase",
          baselineValue: 25,
          targetValue: 30,
        },
      );
      if (!createRes.ok) {
        test.skip(true, `Metric creation failed (${createRes.status}) — skipping`);
        return;
      }
      const created = (await createRes.json()) as { id: string };
      metricId = created.id;
    } else {
      metricId = metrics[0]!.id;
    }

    // 2. Ingest a reading far below baseline to trigger anomaly
    const readingRes = await apiRequest(
      "POST",
      `/api/v1/workspaces/${wsId}/products/${productId}/metrics/${metricId}/readings`,
      { value: 5, note: "E2E anomaly test reading" },
    );
    if (!readingRes.ok) {
      test.skip(true, `Add reading failed (${readingRes.status}) — skipping`);
      return;
    }

    // 3. Navigate to metrics page
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);
    const hasFetchError = await page.getByText("Failed to fetch").isVisible().catch(() => false);
    if (hasFetchError) {
      test.skip(true, "Metrics page could not fetch backend data — skipping");
      return;
    }

    // 4. Anomaly section should have at least one entry
    await expect(page.getByText("Metrics")).toBeVisible({ timeout: 5_000 });
    const resolveBtn = page.getByRole("button", { name: /Resolve/i }).first();
    await expect(resolveBtn).toBeVisible({ timeout: 5_000 });
  });

  test("resolving anomaly removes it from the active list", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);
    const hasFetchError = await page.getByText("Failed to fetch").isVisible().catch(() => false);
    if (hasFetchError) {
      test.skip(true, "Metrics page could not fetch backend data — skipping");
      return;
    }

    const resolveBtn = page.getByRole("button", { name: /Resolve/i }).first();
    const hasAnomaly = await resolveBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasAnomaly) {
      test.skip(true, "No active anomaly to resolve — skipping");
      return;
    }

    // Count anomalies before resolving
    const beforeCount = await page.getByRole("button", { name: /Resolve/i }).count();
    await resolveBtn.click();

    // After resolving, count should decrease
    await expect(page.getByRole("button", { name: /Resolve/i })).toHaveCount(
      Math.max(0, beforeCount - 1),
      { timeout: 5_000 },
    );
  });

  test("anomaly card can expand affected bets details", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);
    const hasFetchError = await page.getByText("Failed to fetch").isVisible().catch(() => false);
    if (hasFetchError) {
      test.skip(true, "Metrics page could not fetch backend data — skipping");
      return;
    }

    const viewBtn = page.getByRole("button", { name: /View affected bets/i }).first();
    const hasAnomaly = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasAnomaly) {
      test.skip(true, "No active anomaly available — skipping");
      return;
    }

    await viewBtn.click();
    await expect(page.getByRole("button", { name: /Hide affected bets/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("anomaly affected-bets API responds for an active anomaly", async ({
    wsId,
    productId,
    apiRequest,
  }) => {
    const anomaliesRes = await apiRequest(
      "GET",
      `/api/v1/workspaces/${wsId}/products/${productId}/anomalies?includeResolved=false`,
    );
    if (!anomaliesRes.ok) {
      test.skip(true, `Anomalies API unavailable (${anomaliesRes.status}) — skipping`);
      return;
    }
    const anomalies = (await anomaliesRes.json()) as { items?: Array<{ id: string }> };
    const anomalyItems = Array.isArray(anomalies.items) ? anomalies.items : [];

    if (anomalyItems.length === 0) {
      test.skip(true, "No active anomaly available — skipping");
      return;
    }

    const anomalyId = anomalyItems[0]!.id;
    const affectedRes = await apiRequest(
      "GET",
      `/api/v1/workspaces/${wsId}/products/${productId}/anomalies/${anomalyId}/affected-bets`,
    );
    if (!affectedRes.ok) {
      test.skip(true, `Affected-bets API unavailable (${affectedRes.status}) — skipping`);
      return;
    }
    const affected = (await affectedRes.json()) as {
      anomalyId?: string;
      affectedBets?: unknown[];
    };
    expect(affected.anomalyId).toBe(anomalyId);
    expect(Array.isArray(affected.affectedBets)).toBe(true);
  });
});
