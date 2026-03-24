// Stripe sync — webhook handler + periodic MRR reconciliation.
//
// Metrics provisioned automatically:
//   kpi/activity  MRR ($)                — updated on invoice.payment_succeeded
//   activity      New Subscriptions      — incremented on customer.subscription.created
//   kpi           Active Subscriptions   — absolute count, reconciled hourly
//   activity      Failed Payments        — incremented on invoice.payment_failed
//   kpi           Churn Rate (%)         — updated on customer.subscription.deleted
//
// Stripe webhook events handled:
//   customer.subscription.created
//   customer.subscription.deleted
//   invoice.payment_succeeded
//   invoice.payment_failed

import { createHmac, timingSafeEqual } from "node:crypto";
import { addReading } from "../metric-store.js";
import {
  findOrCreateMetric,
  getIntegrationConfig,
  markSyncSuccess,
  markSyncError,
  type StripeConfig,
} from "../integration-store.js";

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

// Stripe recommends rejecting webhooks older than 300 seconds to prevent replay attacks.
const WEBHOOK_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  try {
    // Parse header into { t: string, v1: string[] } — collect ALL v1 values
    // to support Stripe webhook secret rotation (multiple simultaneous signatures).
    let timestamp: string | undefined;
    const v1Signatures: string[] = [];

    for (const part of sigHeader.split(",")) {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      if (key === "t") timestamp = val;
      else if (key === "v1") v1Signatures.push(val);
    }

    if (!timestamp || v1Signatures.length === 0) return false;

    // Reject webhooks outside the tolerance window (replay attack prevention)
    if (!/^\d+$/.test(timestamp)) return false;
    const eventTime = Number.parseInt(timestamp, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - eventTime) > toleranceSeconds) return false;

    const payload = `${timestamp}.${rawBody}`;
    const expectedHex = createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");
    const expectedBuf = Buffer.from(expectedHex, "hex");

    // Accept if ANY of the provided v1 signatures matches (rotation support)
    return v1Signatures.some((sig) => {
      const sigBuf = Buffer.from(sig, "hex");
      if (sigBuf.length !== expectedBuf.length) return false;
      return timingSafeEqual(expectedBuf, sigBuf);
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Webhook event handler
// ---------------------------------------------------------------------------

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

export async function handleStripeWebhook(
  workspaceId: string,
  productId: string,
  event: StripeEvent,
): Promise<void> {
  const obj = event.data.object;
  const now = new Date().toISOString();

  switch (event.type) {
    case "invoice.payment_succeeded": {
      const amountPaid = (obj["amount_paid"] as number | undefined) ?? 0;
      const dollars = amountPaid / 100;
      if (dollars <= 0) break;

      const metricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "MRR",
        layer: "kpi",
        unit: "$",
        direction: "increase",
        source: "stripe",
      });
      await addReading({
        workspaceId,
        productId,
        metricId,
        value: dollars,
        recordedAt: now,
        source: "stripe",
        note: `Invoice ${String(obj["id"] ?? "")} paid`,
        createdBy: "integration:stripe",
      });
      break;
    }

    case "invoice.payment_failed": {
      const metricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "Failed Payments",
        layer: "activity",
        unit: "count",
        direction: "decrease",
        source: "stripe",
      });
      await addReading({
        workspaceId,
        productId,
        metricId,
        value: 1,
        recordedAt: now,
        source: "stripe",
        note: `Invoice ${String(obj["id"] ?? "")} failed`,
        createdBy: "integration:stripe",
      });
      break;
    }

    case "customer.subscription.created": {
      const metricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "New Subscriptions",
        layer: "activity",
        unit: "count",
        direction: "increase",
        source: "stripe",
      });
      await addReading({
        workspaceId,
        productId,
        metricId,
        value: 1,
        recordedAt: now,
        source: "stripe",
        note: `Sub ${String(obj["id"] ?? "")} created`,
        createdBy: "integration:stripe",
      });
      break;
    }

    case "customer.subscription.deleted": {
      const metricId = await findOrCreateMetric({
        workspaceId,
        productId,
        name: "Churned Subscriptions",
        layer: "activity",
        unit: "count",
        direction: "decrease",
        source: "stripe",
      });
      await addReading({
        workspaceId,
        productId,
        metricId,
        value: 1,
        recordedAt: now,
        source: "stripe",
        note: `Sub ${String(obj["id"] ?? "")} canceled`,
        createdBy: "integration:stripe",
      });
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }
}

// ---------------------------------------------------------------------------
// Periodic reconciliation — fetch live Active Subscriptions count from Stripe API
// ---------------------------------------------------------------------------

export async function syncStripeMetrics(
  workspaceId: string,
  productId: string,
): Promise<void> {
  const config = await getIntegrationConfig<StripeConfig>(
    workspaceId,
    productId,
    "stripe",
  );
  if (!config) return;

  try {
    // Fetch active subscription count using expand[]=total_count for accurate totals.
    // expand[]=total_count instructs Stripe to return the full count without fetching all pages.
    const params = new URLSearchParams({ status: "active", limit: "1" });
    params.append("expand[]", "total_count");
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${config.restrictedKey}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { data: unknown[]; total_count?: number };
    // total_count must be present when expand[]=total_count is requested.
    // If absent, the key/permission does not support expand — treat as a sync error
    // rather than silently recording 0 (which would trigger false anomalies).
    if (data.total_count === undefined) {
      throw new Error(
        "Stripe API did not return total_count. Ensure the restricted key has 'subscriptions:read' permission and the API version supports expand[]=total_count.",
      );
    }
    const totalCount = data.total_count;

    const metricId = await findOrCreateMetric({
      workspaceId,
      productId,
      name: "Active Subscriptions",
      layer: "kpi",
      unit: "count",
      direction: "increase",
      source: "stripe",
    });

    await addReading({
      workspaceId,
      productId,
      metricId,
      value: totalCount,
      recordedAt: new Date().toISOString(),
      source: "stripe",
      note: "Hourly reconciliation",
      createdBy: "integration:stripe",
    });

    await markSyncSuccess(workspaceId, productId, "stripe");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markSyncError(workspaceId, productId, "stripe", msg);
    throw err;
  }
}
