// Spec Store — DB-backed CRUD for Bet Specs, versions, and conversations.

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, max } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  auditEvents,
  betSpecVersions,
  betSpecs,
  contextPacks,
  specConversations,
} from "../db/schema.js";
import type { BetSpec } from "../domain/bet-spec.js";
import type { AgentState, ConversationMessage } from "./spec-agent.js";
import { callSpecAgent } from "./spec-agent.js";
import { getCurrentContext } from "./context-layer.js";

const nowIso = () => new Date().toISOString();
const newId = () => randomUUID().replace(/-/g, "");

async function emitAuditEvent(params: {
  workspaceId: string;
  actorId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  requestId?: string | undefined;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(auditEvents).values({
    id: `ae_${newId()}`,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    eventType: params.eventType,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    requestId: params.requestId ?? null,
    metadata: params.metadata ?? {},
  });
}

function normalizeBetStatus(status: string): BetSpec["status"] {
  return status === "draft" ||
    status === "active" ||
    status === "completed" ||
    status === "cancelled"
    ? status
    : "draft";
}

async function loadContextForAgent(
  workspaceId: string,
  productId: string,
): Promise<{ contextPackJson: string | null; contextPackVersionId: string }> {
  const db = getDb();
  const contextPack = await getCurrentContext(workspaceId, productId).catch(
    () => null,
  );
  const contextPackMeta = (
    await db
      .select({ currentVersionId: contextPacks.currentVersionId })
      .from(contextPacks)
      .where(
        and(
          eq(contextPacks.workspaceId, workspaceId),
          eq(contextPacks.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  return {
    contextPackJson: contextPack ? JSON.stringify(contextPack, null, 2) : null,
    contextPackVersionId: contextPackMeta?.currentVersionId ?? "",
  };
}

function canonicalizeSpec(params: {
  rawSpec: BetSpec;
  betSpecId: string;
  workspaceId: string;
  productId: string;
  actorId: string;
  contextPackVersionId: string;
  fallbackTitle: string;
  status: BetSpec["status"];
  createdBy: string;
  createdAt: string;
}): BetSpec {
  const now = nowIso();
  const normalizedCreatedAt =
    typeof params.createdAt === "string" && params.createdAt.length > 0
      ? params.createdAt
      : now;
  const cleanTitle =
    typeof params.rawSpec.title === "string" && params.rawSpec.title.trim().length > 0
      ? params.rawSpec.title.trim()
      : params.fallbackTitle;
  const cleanOwner =
    typeof params.rawSpec.owner === "string" && params.rawSpec.owner.trim().length > 0
      ? params.rawSpec.owner
      : params.actorId;
  const decisionLogIds = Array.isArray(params.rawSpec.links?.decisionLogIds)
    ? params.rawSpec.links.decisionLogIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];

  return {
    ...params.rawSpec,
    betId: params.betSpecId,
    workspaceId: params.workspaceId,
    productId: params.productId,
    title: cleanTitle,
    status: params.status,
    owner: cleanOwner,
    links: {
      ...params.rawSpec.links,
      contextPackVersionId: params.contextPackVersionId,
      decisionLogIds,
    },
    createdBy: params.createdBy,
    createdAt: normalizedCreatedAt,
    updatedBy: params.actorId,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BetSpecSummary {
  id: string;
  title: string;
  status: string;
  currentVersionId: string | null;
  conversationId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BetSpecVersionItem {
  id: string;
  versionNumber: number;
  source: string;
  createdBy: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Create a new bet spec and start a conversation
// ---------------------------------------------------------------------------

export interface CreateBetSpecInput {
  workspaceId: string;
  productId: string;
  title: string;
  initialMessage: string;
  createdBy: string;
  requestId?: string | undefined;
}

export interface CreateBetSpecResult {
  betSpecId: string;
  conversationId: string;
  agentReply: string;
  agentState: AgentState;
  spec?: BetSpec | undefined;
}

export async function createBetSpec(
  input: CreateBetSpecInput,
): Promise<CreateBetSpecResult> {
  const db = getDb();
  const betSpecId = `bet_${newId()}`;
  const conversationId = `conv_${newId()}`;
  const now = nowIso();

  const { contextPackJson, contextPackVersionId } = await loadContextForAgent(
    input.workspaceId,
    input.productId,
  );

  const userMessage: ConversationMessage = {
    role: "user",
    content: input.initialMessage,
    createdAt: now,
  };

  // Call agent with the single user message.
  const agentResponse = await callSpecAgent({
    messages: [userMessage],
    contextPackJson,
    betId: betSpecId,
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.createdBy,
    contextPackVersionId,
  });

  const assistantMessage: ConversationMessage = {
    role: "assistant",
    content: agentResponse.reply,
    createdAt: nowIso(),
  };

  const messages: ConversationMessage[] = [userMessage, assistantMessage];
  let savedSpec: BetSpec | undefined;

  await db.transaction(async (tx) => {
    // Insert bet spec (no version yet).
    await tx.insert(betSpecs).values({
      id: betSpecId,
      workspaceId: input.workspaceId,
      productId: input.productId,
      title: input.title,
      status: "draft",
      currentVersionId: null,
      conversationId: null,
      createdBy: input.createdBy,
    });

    // Insert conversation.
    await tx.insert(specConversations).values({
      id: conversationId,
      betSpecId,
      messages: messages as unknown as Record<string, unknown>[],
      agentState: agentResponse.state,
    });

    // Link conversation back to bet spec.
    await tx
      .update(betSpecs)
      .set({ conversationId, updatedAt: new Date() })
      .where(eq(betSpecs.id, betSpecId));

    // If agent already has a spec, save it as v1.
    if (agentResponse.spec) {
      const versionId = `bsv_${newId()}`;
      const spec = canonicalizeSpec({
        rawSpec: agentResponse.spec,
        betSpecId,
        workspaceId: input.workspaceId,
        productId: input.productId,
        actorId: input.createdBy,
        contextPackVersionId,
        fallbackTitle: input.title,
        status: "draft",
        createdBy: input.createdBy,
        createdAt: now,
      });
      savedSpec = spec;
      await tx.insert(betSpecVersions).values({
        id: versionId,
        betSpecId,
        versionNumber: 1,
        structuredPayload: spec as unknown as Record<string, unknown>,
        source: "conversation",
        createdBy: input.createdBy,
      });
      await tx
        .update(betSpecs)
        .set({ currentVersionId: versionId, updatedAt: new Date() })
        .where(eq(betSpecs.id, betSpecId));
    }
  });

  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.createdBy,
    eventType: "bet_spec.created",
    resourceType: "bet_spec",
    resourceId: betSpecId,
    requestId: input.requestId,
    metadata: { productId: input.productId, title: input.title },
  });

  return {
    betSpecId,
    conversationId,
    agentReply: agentResponse.reply,
    agentState: agentResponse.state,
    ...(savedSpec ? { spec: savedSpec } : {}),
  };
}

// ---------------------------------------------------------------------------
// Send a message to the conversation
// ---------------------------------------------------------------------------

export interface SendMessageInput {
  workspaceId: string;
  productId: string;
  betSpecId: string;
  message: string;
  actorId: string;
  requestId?: string | undefined;
}

export interface SendMessageResult {
  agentReply: string;
  agentState: AgentState;
  newVersionId?: string | undefined;
  newVersionNumber?: number | undefined;
  spec?: BetSpec | undefined;
}

export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult | null> {
  const db = getDb();

  const bet = (
    await db
      .select()
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.id, input.betSpecId),
          eq(betSpecs.workspaceId, input.workspaceId),
          eq(betSpecs.productId, input.productId),
        ),
      )
      .limit(1)
  )[0];

  if (!bet) return null;

  const conv = bet.conversationId
    ? (
        await db
          .select()
          .from(specConversations)
          .where(eq(specConversations.id, bet.conversationId))
          .limit(1)
      )[0]
    : null;

  const existingMessages: ConversationMessage[] =
    (conv?.messages as unknown as ConversationMessage[]) ?? [];

  const now = nowIso();
  const userMessage: ConversationMessage = {
    role: "user",
    content: input.message,
    createdAt: now,
  };

  const allMessages = [...existingMessages, userMessage];

  const { contextPackJson, contextPackVersionId } = await loadContextForAgent(
    input.workspaceId,
    input.productId,
  );

  const agentResponse = await callSpecAgent({
    messages: allMessages,
    contextPackJson,
    betId: input.betSpecId,
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    contextPackVersionId,
  });

  const assistantMessage: ConversationMessage = {
    role: "assistant",
    content: agentResponse.reply,
    createdAt: nowIso(),
  };

  const updatedMessages = [...allMessages, assistantMessage];

  let newVersionId: string | undefined;
  let newVersionNumber: number | undefined;
  let savedSpec: BetSpec | undefined;

  await db.transaction(async (tx) => {
    // Update conversation messages + state.
    if (conv) {
      await tx
        .update(specConversations)
        .set({
          messages: updatedMessages as unknown as Record<string, unknown>[],
          agentState: agentResponse.state,
          updatedAt: new Date(),
        })
        .where(eq(specConversations.id, conv.id));
    } else {
      const newConvId = `conv_${newId()}`;
      await tx.insert(specConversations).values({
        id: newConvId,
        betSpecId: input.betSpecId,
        messages: updatedMessages as unknown as Record<string, unknown>[],
        agentState: agentResponse.state,
      });
      await tx
        .update(betSpecs)
        .set({ conversationId: newConvId, updatedAt: new Date() })
        .where(eq(betSpecs.id, input.betSpecId));
    }

    // If agent generated a spec, save a new version.
    if (agentResponse.spec) {
      const maxRow = (
        await tx
          .select({ m: max(betSpecVersions.versionNumber) })
          .from(betSpecVersions)
          .where(eq(betSpecVersions.betSpecId, input.betSpecId))
      )[0];

      newVersionNumber = (maxRow?.m ?? 0) + 1;
      newVersionId = `bsv_${newId()}`;

      const spec = canonicalizeSpec({
        rawSpec: agentResponse.spec,
        betSpecId: input.betSpecId,
        workspaceId: input.workspaceId,
        productId: input.productId,
        actorId: input.actorId,
        contextPackVersionId,
        fallbackTitle: bet.title,
        status: normalizeBetStatus(bet.status),
        createdBy: bet.createdBy,
        createdAt: agentResponse.spec.createdAt,
      });
      savedSpec = spec;

      await tx.insert(betSpecVersions).values({
        id: newVersionId,
        betSpecId: input.betSpecId,
        versionNumber: newVersionNumber,
        structuredPayload: spec as unknown as Record<string, unknown>,
        source: "conversation",
        createdBy: input.actorId,
      });

      await tx
        .update(betSpecs)
        .set({
          currentVersionId: newVersionId,
          title: spec.title,
          updatedAt: new Date(),
        })
        .where(eq(betSpecs.id, input.betSpecId));
    }
  });

  return {
    agentReply: agentResponse.reply,
    agentState: agentResponse.state,
    ...(newVersionId
      ? { newVersionId, newVersionNumber }
      : {}),
    ...(savedSpec ? { spec: savedSpec } : {}),
  };
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function getBetSpecs(
  workspaceId: string,
  productId: string,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: BetSpecSummary[] }> {
  const db = getDb();

  const totalRow = (
    await db
      .select({ total: count() })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
  )[0];

  const rows = await db
    .select()
    .from(betSpecs)
    .where(
      and(
        eq(betSpecs.workspaceId, workspaceId),
        eq(betSpecs.productId, productId),
      ),
    )
    .orderBy(desc(betSpecs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      currentVersionId: r.currentVersionId,
      conversationId: r.conversationId,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

export async function getBetSpecById(
  workspaceId: string,
  productId: string,
  betSpecId: string,
): Promise<{ meta: BetSpecSummary; spec: BetSpec | null } | null> {
  const db = getDb();

  const bet = (
    await db
      .select()
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.id, betSpecId),
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!bet) return null;

  let spec: BetSpec | null = null;
  if (bet.currentVersionId) {
    const version = (
      await db
        .select()
        .from(betSpecVersions)
        .where(eq(betSpecVersions.id, bet.currentVersionId))
        .limit(1)
    )[0];
    if (version) {
      spec = version.structuredPayload as unknown as BetSpec;
    }
  }

  return {
    meta: {
      id: bet.id,
      title: bet.title,
      status: bet.status,
      currentVersionId: bet.currentVersionId,
      conversationId: bet.conversationId,
      createdBy: bet.createdBy,
      createdAt: bet.createdAt,
      updatedAt: bet.updatedAt,
    },
    spec,
  };
}

export async function getConversation(
  workspaceId: string,
  productId: string,
  betSpecId: string,
): Promise<{ messages: ConversationMessage[]; agentState: AgentState } | null> {
  const db = getDb();

  const bet = (
    await db
      .select({ conversationId: betSpecs.conversationId })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.id, betSpecId),
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!bet?.conversationId) return null;

  const conv = (
    await db
      .select()
      .from(specConversations)
      .where(eq(specConversations.id, bet.conversationId))
      .limit(1)
  )[0];

  if (!conv) return null;

  return {
    messages: (conv.messages as unknown as ConversationMessage[]) ?? [],
    agentState: conv.agentState as AgentState,
  };
}

export async function getBetSpecVersions(
  workspaceId: string,
  productId: string,
  betSpecId: string,
  limit = 50,
  offset = 0,
): Promise<{ total: number; items: BetSpecVersionItem[] }> {
  const db = getDb();

  // Verify ownership.
  const bet = (
    await db
      .select({ id: betSpecs.id })
      .from(betSpecs)
      .where(
        and(
          eq(betSpecs.id, betSpecId),
          eq(betSpecs.workspaceId, workspaceId),
          eq(betSpecs.productId, productId),
        ),
      )
      .limit(1)
  )[0];

  if (!bet) return { total: 0, items: [] };

  const totalRow = (
    await db
      .select({ total: count() })
      .from(betSpecVersions)
      .where(eq(betSpecVersions.betSpecId, betSpecId))
  )[0];

  const items = await db
    .select({
      id: betSpecVersions.id,
      versionNumber: betSpecVersions.versionNumber,
      source: betSpecVersions.source,
      createdBy: betSpecVersions.createdBy,
      createdAt: betSpecVersions.createdAt,
    })
    .from(betSpecVersions)
    .where(eq(betSpecVersions.betSpecId, betSpecId))
    .orderBy(desc(betSpecVersions.versionNumber))
    .limit(limit)
    .offset(offset);

  return { total: Number(totalRow?.total ?? 0), items };
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateBetSpecStatus(
  workspaceId: string,
  productId: string,
  betSpecId: string,
  status: string,
  actorId: string,
): Promise<boolean> {
  const db = getDb();

  const result = await db
    .update(betSpecs)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(betSpecs.id, betSpecId),
        eq(betSpecs.workspaceId, workspaceId),
        eq(betSpecs.productId, productId),
      ),
    );

  const updated = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (updated > 0) {
    await emitAuditEvent({
      workspaceId,
      actorId,
      eventType: "bet_spec.status_updated",
      resourceType: "bet_spec",
      resourceId: betSpecId,
      metadata: { status },
    });
  }
  return updated > 0;
}

// ---------------------------------------------------------------------------
// Restore to a previous version
// ---------------------------------------------------------------------------

export interface RestoreBetSpecResult {
  newVersionId: string;
  newVersionNumber: number;
  restoredFromVersion: number;
}

export async function restoreBetSpec(
  workspaceId: string,
  productId: string,
  betSpecId: string,
  restoreToVersion: number,
  actorId: string,
  requestId?: string,
): Promise<RestoreBetSpecResult | null> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const bet = (
      await tx
        .select()
        .from(betSpecs)
        .where(
          and(
            eq(betSpecs.id, betSpecId),
            eq(betSpecs.workspaceId, workspaceId),
            eq(betSpecs.productId, productId),
          ),
        )
        .limit(1)
    )[0];

    if (!bet) return null;

    const snapshot = (
      await tx
        .select()
        .from(betSpecVersions)
        .where(
          and(
            eq(betSpecVersions.betSpecId, betSpecId),
            eq(betSpecVersions.versionNumber, restoreToVersion),
          ),
        )
        .limit(1)
    )[0];

    if (!snapshot) return null;

    const maxRow = (
      await tx
        .select({ m: max(betSpecVersions.versionNumber) })
        .from(betSpecVersions)
        .where(eq(betSpecVersions.betSpecId, betSpecId))
    )[0];

    const nextVersion = (maxRow?.m ?? 0) + 1;
    const newVersionId = `bsv_${newId()}`;

    const sourceSpec = snapshot.structuredPayload as unknown as BetSpec;
    const restoredSpec = canonicalizeSpec({
      rawSpec: sourceSpec,
      betSpecId,
      workspaceId,
      productId,
      actorId,
      contextPackVersionId: sourceSpec.links?.contextPackVersionId ?? "",
      fallbackTitle: bet.title,
      status: normalizeBetStatus(bet.status),
      createdBy: bet.createdBy,
      createdAt: sourceSpec.createdAt,
    });

    await tx.insert(betSpecVersions).values({
      id: newVersionId,
      betSpecId,
      versionNumber: nextVersion,
      structuredPayload: restoredSpec as unknown as Record<string, unknown>,
      source: "restored",
      sourceVersionFrom: restoreToVersion,
      createdBy: actorId,
    });

    await tx
      .update(betSpecs)
      .set({ currentVersionId: newVersionId, updatedAt: new Date() })
      .where(eq(betSpecs.id, betSpecId));

    return { newVersionId, newVersionNumber: nextVersion };
  });

  if (!result) return null;

  await emitAuditEvent({
    workspaceId,
    actorId,
    eventType: "bet_spec.restored",
    resourceType: "bet_spec",
    resourceId: betSpecId,
    requestId,
    metadata: { restoredFromVersion: restoreToVersion, newVersion: result.newVersionNumber },
  });

  return {
    newVersionId: result.newVersionId,
    newVersionNumber: result.newVersionNumber,
    restoredFromVersion: restoreToVersion,
  };
}
