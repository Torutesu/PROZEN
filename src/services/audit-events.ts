import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { auditEvents } from "../db/schema.js";

export interface AuditEventRecord {
  id: string;
  workspaceId: string;
  actorId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  requestId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditEvents(params: {
  workspaceId: string;
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditEventRecord[]> {
  const db = getDb();
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const offset = Math.max(0, params.offset ?? 0);

  const whereExpr = params.productId
    ? and(
        eq(auditEvents.workspaceId, params.workspaceId),
        sql`${auditEvents.metadata} ->> 'productId' = ${params.productId}`,
      )
    : eq(auditEvents.workspaceId, params.workspaceId);

  const rows = await db
    .select()
    .from(auditEvents)
    .where(whereExpr)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    actorId: row.actorId,
    eventType: row.eventType,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    ...(row.requestId ? { requestId: row.requestId } : {}),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
  }));
}

