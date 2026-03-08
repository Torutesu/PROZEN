// Workspace & Product store (M5)
// Workspace = tenant root. Product = feature scope within a workspace.

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { workspaces, products } from "../db/schema.js";
import { randomUUID } from "node:crypto";
import { ingestContext } from "./context-layer.js";
import { createBetSpec } from "./spec-store.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingSetupInput {
  workspaceName: string;
  productName: string;
  productDescription?: string | undefined;
  mainKpi?: string | undefined;
  firstBetIdea?: string | undefined;
  skipFirstBet: boolean;
  actorId: string;
  requestId?: string | undefined;
}

export interface SetupWarning {
  step: "context_pack" | "first_bet";
  code: string;
  message: string;
}

export interface OnboardingSetupResult {
  workspace: WorkspaceRecord;
  product: ProductRecord;
  betSpecId: string | null;
  warnings: SetupWarning[];
}

// ---------------------------------------------------------------------------
// Workspace CRUD
// ---------------------------------------------------------------------------

export async function createWorkspace(
  name: string,
  ownerUserId: string,
): Promise<WorkspaceRecord> {
  const db = getDb();
  const id = `ws_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = new Date();

  const [row] = await db
    .insert(workspaces)
    .values({ id, name: name.trim(), ownerUserId, createdAt: now, updatedAt: now })
    .returning();

  return row!;
}

export async function getWorkspacesByOwner(
  ownerUserId: string,
): Promise<WorkspaceRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, ownerUserId))
    .orderBy(desc(workspaces.createdAt));
}

export async function getWorkspaceById(
  workspaceId: string,
  ownerUserId: string,
): Promise<WorkspaceRecord | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.ownerUserId, ownerUserId),
        ),
      )
      .limit(1)
  )[0];
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Product CRUD
// ---------------------------------------------------------------------------

export async function createProduct(
  workspaceId: string,
  name: string,
): Promise<ProductRecord> {
  const db = getDb();
  const id = `prod_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = new Date();

  const [row] = await db
    .insert(products)
    .values({ id, workspaceId, name: name.trim(), status: "active", createdAt: now, updatedAt: now })
    .returning();

  return row!;
}

export async function getProducts(
  workspaceId: string,
): Promise<ProductRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(products)
    .where(eq(products.workspaceId, workspaceId))
    .orderBy(desc(products.createdAt));
}

export async function getProductById(
  workspaceId: string,
  productId: string,
): Promise<ProductRecord | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(products)
      .where(
        and(eq(products.workspaceId, workspaceId), eq(products.id, productId)),
      )
      .limit(1)
  )[0];
  return row ?? null;
}

export async function updateProduct(
  workspaceId: string,
  productId: string,
  patch: { name?: string | undefined; status?: string | undefined },
): Promise<ProductRecord | null> {
  const db = getDb();
  const now = new Date();

  const updates: Partial<typeof products.$inferInsert> = { updatedAt: now };
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.status !== undefined) updates.status = patch.status;

  const [row] = await db
    .update(products)
    .set(updates)
    .where(
      and(eq(products.workspaceId, workspaceId), eq(products.id, productId)),
    )
    .returning();

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Onboarding setup (M5)
// ---------------------------------------------------------------------------

export async function setupOnboarding(
  input: OnboardingSetupInput,
): Promise<OnboardingSetupResult> {
  const db = getDb();
  const warnings: SetupWarning[] = [];

  const workspaceName = input.workspaceName.trim().length > 0
    ? input.workspaceName.trim()
    : "My Workspace";
  const productName = input.productName.trim().length > 0
    ? input.productName.trim()
    : "My Product";

  const [workspace, product] = await db.transaction(async (tx) => {
    const workspaceId = `ws_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const productId = `prod_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const now = new Date();

    const [workspaceRow] = await tx
      .insert(workspaces)
      .values({
        id: workspaceId,
        name: workspaceName,
        ownerUserId: input.actorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [productRow] = await tx
      .insert(products)
      .values({
        id: productId,
        workspaceId,
        name: productName,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return [workspaceRow!, productRow!] as const;
  });

  const contextParts = [
    `Product: ${product.name}`,
    input.productDescription?.trim() ?? "",
    input.mainKpi?.trim() ? `Main KPI: ${input.mainKpi.trim()}` : "",
  ].filter((v) => v.length > 0);

  if (contextParts.length > 0) {
    try {
      await ingestContext({
        workspaceId: workspace.id,
        productId: product.id,
        rawInput: contextParts.join("\n\n"),
        createdBy: input.actorId,
        requestId: input.requestId,
      });
    } catch (err) {
      warnings.push({
        step: "context_pack",
        code: "context_pack_ingest_failed",
        message: err instanceof Error
          ? err.message
          : "Failed to ingest context pack during setup.",
      });
    }
  }

  let betSpecId: string | null = null;
  const betIdea = input.firstBetIdea?.trim() ?? "";
  if (!input.skipFirstBet && betIdea.length > 0) {
    try {
      const result = await createBetSpec({
        workspaceId: workspace.id,
        productId: product.id,
        title: `${product.name} - Initial Bet`,
        initialMessage: betIdea,
        createdBy: input.actorId,
        requestId: input.requestId,
      });
      betSpecId = result.betSpecId;
    } catch (err) {
      warnings.push({
        step: "first_bet",
        code: "first_bet_create_failed",
        message: err instanceof Error
          ? err.message
          : "Failed to create first bet during setup.",
      });
    }
  }

  return {
    workspace,
    product,
    betSpecId,
    warnings,
  };
}
