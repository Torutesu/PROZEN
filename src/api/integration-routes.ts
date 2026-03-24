// Integration API routes (M15)
//
// GET    /api/v1/workspaces/:wid/products/:pid/integrations
// POST   /api/v1/workspaces/:wid/products/:pid/integrations/:provider
// DELETE /api/v1/workspaces/:wid/products/:pid/integrations/:provider
//
// Stripe webhook (no auth — HMAC verified):
// POST   /api/v1/webhooks/stripe/:workspaceId/:productId

import { apiError, createApp } from "./middleware.js";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  getIntegrationConfig,
  type IntegrationProvider,
  type StripeConfig,
  type PostHogConfig,
  type SentryConfig,
  type TypeformConfig,
} from "../services/integration-store.js";
import {
  verifyStripeSignature,
  handleStripeWebhook,
} from "../services/integrations/stripe-sync.js";

const app = createApp();

const BASE = "/api/v1/workspaces/:workspaceId/products/:productId";
const VALID_PROVIDERS: IntegrationProvider[] = ["stripe", "posthog", "sentry", "typeform"];

// ---------------------------------------------------------------------------
// GET .../integrations
// ---------------------------------------------------------------------------
app.get(`${BASE}/integrations`, async (c) => {
  const { workspaceId, productId } = c.req.param();

  try {
    const items = await listIntegrations(workspaceId, productId);
    // Never return credentials
    return c.json({ items });
  } catch (err) {
    return apiError(c, 500, "fetch_error", err instanceof Error ? err.message : "Failed to list integrations.");
  }
});

// ---------------------------------------------------------------------------
// POST .../integrations/:provider  — create or replace connection
// ---------------------------------------------------------------------------
app.post(`${BASE}/integrations/:provider`, async (c) => {
  const { workspaceId, productId, provider } = c.req.param();
  const actorId = c.get("actorId");

  if (!VALID_PROVIDERS.includes(provider as IntegrationProvider)) {
    return apiError(c, 422, "invalid_provider", `Provider must be one of: ${VALID_PROVIDERS.join(", ")}.`);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return apiError(c, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;
  let config: StripeConfig | PostHogConfig | SentryConfig | TypeformConfig;
  const syncConfig: Record<string, unknown> = {};

  try {
    switch (provider as IntegrationProvider) {
      case "stripe": {
        if (typeof b["restrictedKey"] !== "string" || !b["restrictedKey"]) {
          return apiError(c, 422, "invalid_payload", '"restrictedKey" is required for Stripe.');
        }
        const stripeConfig: StripeConfig = { restrictedKey: b["restrictedKey"] };
        if (typeof b["webhookSecret"] === "string" && b["webhookSecret"]) {
          stripeConfig.webhookSecret = b["webhookSecret"];
        }
        config = stripeConfig;
        break;
      }
      case "posthog": {
        if (typeof b["apiKey"] !== "string" || !b["apiKey"]) {
          return apiError(c, 422, "invalid_payload", '"apiKey" is required for PostHog.');
        }
        if (typeof b["projectId"] !== "string" || !b["projectId"]) {
          return apiError(c, 422, "invalid_payload", '"projectId" is required for PostHog.');
        }
        const posthogConfig: PostHogConfig = { apiKey: b["apiKey"], projectId: b["projectId"] };
        if (typeof b["host"] === "string" && b["host"]) {
          posthogConfig.host = b["host"];
        }
        config = posthogConfig;
        break;
      }
      case "sentry": {
        if (typeof b["authToken"] !== "string" || !b["authToken"]) {
          return apiError(c, 422, "invalid_payload", '"authToken" is required for Sentry.');
        }
        if (typeof b["organizationSlug"] !== "string" || !b["organizationSlug"]) {
          return apiError(c, 422, "invalid_payload", '"organizationSlug" is required for Sentry.');
        }
        if (typeof b["projectSlug"] !== "string" || !b["projectSlug"]) {
          return apiError(c, 422, "invalid_payload", '"projectSlug" is required for Sentry.');
        }
        config = {
          authToken: b["authToken"],
          organizationSlug: b["organizationSlug"],
          projectSlug: b["projectSlug"],
        } satisfies SentryConfig;
        break;
      }
      case "typeform": {
        if (typeof b["accessToken"] !== "string" || !b["accessToken"]) {
          return apiError(c, 422, "invalid_payload", '"accessToken" is required for Typeform.');
        }
        if (typeof b["formId"] !== "string" || !b["formId"]) {
          return apiError(c, 422, "invalid_payload", '"formId" is required for Typeform.');
        }
        config = {
          accessToken: b["accessToken"],
          formId: b["formId"],
        } satisfies TypeformConfig;
        break;
      }
    }
  } catch (err) {
    return apiError(c, 500, "config_error", err instanceof Error ? err.message : "Failed to process config.");
  }

  try {
    const connection = await createIntegration({
      workspaceId,
      productId,
      provider: provider as IntegrationProvider,
      config,
      syncConfig,
      createdBy: actorId,
    });
    return c.json(connection, 201);
  } catch (err) {
    return apiError(c, 500, "create_error", err instanceof Error ? err.message : "Failed to save integration.");
  }
});

// ---------------------------------------------------------------------------
// DELETE .../integrations/:provider
// ---------------------------------------------------------------------------
app.delete(`${BASE}/integrations/:provider`, async (c) => {
  const { workspaceId, productId, provider } = c.req.param();

  if (!VALID_PROVIDERS.includes(provider as IntegrationProvider)) {
    return apiError(c, 422, "invalid_provider", `Provider must be one of: ${VALID_PROVIDERS.join(", ")}.`);
  }

  try {
    const deleted = await deleteIntegration(workspaceId, productId, provider as IntegrationProvider);
    if (!deleted) {
      return apiError(c, 404, "not_found", "Integration not found.");
    }
    return c.json({ deleted: true, provider });
  } catch (err) {
    return apiError(c, 500, "delete_error", err instanceof Error ? err.message : "Failed to delete integration.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/stripe/:workspaceId/:productId
// No auth middleware — verified via HMAC signature
// ---------------------------------------------------------------------------
app.post("/api/v1/webhooks/stripe/:workspaceId/:productId", async (c) => {
  const { workspaceId, productId } = c.req.param();

  const rawBody = await c.req.text();
  const sigHeader = c.req.header("stripe-signature") ?? "";

  // Look up webhook secret
  const stripeConfig = await getIntegrationConfig<StripeConfig>(
    workspaceId,
    productId,
    "stripe",
  );

  if (!stripeConfig?.webhookSecret) {
    return apiError(c, 400, "webhook_not_configured", "Stripe webhook secret not configured.");
  }

  if (!verifyStripeSignature(rawBody, sigHeader, stripeConfig.webhookSecret)) {
    return apiError(c, 401, "invalid_signature", "Stripe webhook signature verification failed.");
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return apiError(c, 400, "invalid_json", "Invalid webhook payload.");
  }

  try {
    await handleStripeWebhook(workspaceId, productId, event);
    return c.json({ received: true });
  } catch (err) {
    // Return 200 to prevent Stripe retries for processing errors
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[integration-routes] stripe webhook processing failed for ${workspaceId}/${productId}: ${msg}\n`,
    );
    return c.json({ received: true, warning: "processing_error" });
  }
});

export default app;
