// Integration Store — CRUD for external integration connections.
// Handles credential encryption/decryption and metric auto-provisioning.

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { integrationConnections, metrics } from "../db/schema.js";
import { encryptSecret, decryptSecret } from "./secret-crypto.js";
import type { MetricLayer, MetricDirection } from "./metric-store.js";

const newId = () => randomUUID().replace(/-/g, "");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationProvider = "stripe" | "posthog" | "sentry" | "typeform";

export interface IntegrationConnection {
  id: string;
  workspaceId: string;
  productId: string;
  provider: IntegrationProvider;
  syncConfig: Record<string, unknown>;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Raw decrypted credentials per provider
export interface StripeConfig {
  restrictedKey: string;   // sk_restricted_... (read-only)
  webhookSecret?: string;  // whsec_...
}

export interface PostHogConfig {
  apiKey: string;          // phx_...
  projectId: string;
  host?: string;           // default: https://app.posthog.com
}

export interface SentryConfig {
  authToken: string;       // sntrys_...
  organizationSlug: string;
  projectSlug: string;
}

export interface TypeformConfig {
  accessToken: string;
  formId: string;
}

export type ProviderConfig = StripeConfig | PostHogConfig | SentryConfig | TypeformConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeConfig(config: ProviderConfig): string {
  return encryptSecret(JSON.stringify(config));
}

function deserializeConfig<T extends ProviderConfig>(encrypted: string): T {
  return JSON.parse(decryptSecret(encrypted)) as T;
}

function toRecord(row: typeof integrationConnections.$inferSelect): IntegrationConnection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    productId: row.productId,
    provider: row.provider as IntegrationProvider,
    syncConfig: (row.syncConfig ?? {}) as Record<string, unknown>,
    isActive: row.isActive,
    lastSyncedAt: row.lastSyncedAt ?? null,
    lastSyncError: row.lastSyncError ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createIntegration(input: {
  workspaceId: string;
  productId: string;
  provider: IntegrationProvider;
  config: ProviderConfig;
  syncConfig?: Record<string, unknown>;
  createdBy: string;
}): Promise<IntegrationConnection> {
  const db = getDb();
  const id = `int_${newId()}`;

  const [row] = await db
    .insert(integrationConnections)
    .values({
      id,
      workspaceId: input.workspaceId,
      productId: input.productId,
      provider: input.provider,
      encryptedConfig: serializeConfig(input.config),
      syncConfig: input.syncConfig ?? {},
      isActive: true,
      createdBy: input.createdBy,
    })
    .onConflictDoUpdate({
      target: [
        integrationConnections.workspaceId,
        integrationConnections.productId,
        integrationConnections.provider,
      ],
      set: {
        encryptedConfig: serializeConfig(input.config),
        syncConfig: input.syncConfig ?? {},
        isActive: true,
        lastSyncError: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toRecord(row!);
}

export async function listIntegrations(
  workspaceId: string,
  productId: string,
): Promise<IntegrationConnection[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
      ),
    );
  return rows.map(toRecord);
}

export async function getIntegration(
  workspaceId: string,
  productId: string,
  provider: IntegrationProvider,
): Promise<IntegrationConnection | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
        eq(integrationConnections.provider, provider),
      ),
    )
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function getIntegrationConfig<T extends ProviderConfig>(
  workspaceId: string,
  productId: string,
  provider: IntegrationProvider,
): Promise<T | null> {
  const db = getDb();
  const [row] = await db
    .select({ encryptedConfig: integrationConnections.encryptedConfig })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
        eq(integrationConnections.provider, provider),
        eq(integrationConnections.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;
  return deserializeConfig<T>(row.encryptedConfig);
}

export async function deleteIntegration(
  workspaceId: string,
  productId: string,
  provider: IntegrationProvider,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(integrationConnections)
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
        eq(integrationConnections.provider, provider),
      ),
    )
    .returning({ id: integrationConnections.id });
  return result.length > 0;
}

export async function markSyncSuccess(
  workspaceId: string,
  productId: string,
  provider: IntegrationProvider,
): Promise<void> {
  const db = getDb();
  await db
    .update(integrationConnections)
    .set({ lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
        eq(integrationConnections.provider, provider),
      ),
    );
}

export async function markSyncError(
  workspaceId: string,
  productId: string,
  provider: IntegrationProvider,
  error: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(integrationConnections)
    .set({ lastSyncError: error, updatedAt: new Date() })
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.productId, productId),
        eq(integrationConnections.provider, provider),
      ),
    );
}

export async function listAllActiveIntegrations(): Promise<
  Array<{ workspaceId: string; productId: string; provider: IntegrationProvider }>
> {
  const db = getDb();
  const rows = await db
    .select({
      workspaceId: integrationConnections.workspaceId,
      productId: integrationConnections.productId,
      provider: integrationConnections.provider,
    })
    .from(integrationConnections)
    .where(eq(integrationConnections.isActive, true));
  return rows.map((r) => ({ ...r, provider: r.provider as IntegrationProvider }));
}

// ---------------------------------------------------------------------------
// findOrCreateMetric — used by sync services to auto-provision metrics
// ---------------------------------------------------------------------------

export async function findOrCreateMetric(input: {
  workspaceId: string;
  productId: string;
  name: string;
  layer: MetricLayer;
  unit?: string;
  direction?: MetricDirection;
  source: string;
}): Promise<string> {
  const db = getDb();

  const [existing] = await db
    .select({ id: metrics.id })
    .from(metrics)
    .where(
      and(
        eq(metrics.workspaceId, input.workspaceId),
        eq(metrics.productId, input.productId),
        eq(metrics.name, input.name),
        eq(metrics.isActive, true),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const id = `met_${newId()}`;
  await db.insert(metrics).values({
    id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    name: input.name,
    layer: input.layer,
    unit: input.unit ?? null,
    direction: input.direction ?? "increase",
    isActive: true,
    createdBy: `integration:${input.source}`,
  });

  return id;
}
