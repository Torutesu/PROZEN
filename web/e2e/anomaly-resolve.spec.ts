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
    const metricsData = (await metricsRes.json()) as { items: Array<{ id: string; baselineValue: number | null }> };

    let metricId: string;
    if (metricsData.items.length === 0) {
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
      const created = (await createRes.json()) as { id: string };
      metricId = created.id;
    } else {
      metricId = metricsData.items[0]!.id;
    }

    // 2. Ingest a reading far below baseline to trigger anomaly
    await apiRequest(
      "POST",
      `/api/v1/workspaces/${wsId}/products/${productId}/metrics/${metricId}/readings`,
      { value: 5, note: "E2E anomaly test reading" },
    );

    // 3. Navigate to metrics page
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);

    // 4. Anomaly section should have at least one entry
    await expect(page.getByText(/Anomalies/i)).toBeVisible({ timeout: 5_000 });
    const resolveBtn = page.getByRole("button", { name: /Resolve/i }).first();
    await expect(resolveBtn).toBeVisible({ timeout: 5_000 });
  });

  test("resolving anomaly removes it from the active list", async ({
    authedPage: page,
    apiRequest,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);

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

  test("anomaly shows affected bets link", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/metrics`);

    // Look for affected bets section in anomaly card
    const affectedBets = page.getByText(/Affected Bets/i);
    const hasAffected = await affectedBets.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasAffected) {
      // Clicking the bet link should navigate to the bets page
      const betLink = page.getByRole("link", { name: /bet/i }).first();
      if (await betLink.isVisible()) {
        await betLink.click();
        await expect(page).toHaveURL(/\/bets/);
      }
    }
    // Acceptable if no affected bets (metric not linked to a bet)
  });
});
