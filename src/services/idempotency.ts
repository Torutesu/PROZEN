import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { apiIdempotencyKeys } from "../db/schema.js";

export type IdempotencyCheckResult =
  | { type: "miss" }
  | { type: "replay"; statusCode: number; responseBody: unknown }
  | { type: "conflict" };

export const buildRequestHash = (
  method: string,
  path: string,
  rawBody: string,
): string =>
  createHash("sha256")
    .update(`${method.toUpperCase()}|${path}|${rawBody}`)
    .digest("hex");

export async function checkIdempotency(params: {
  workspaceId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<IdempotencyCheckResult> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(apiIdempotencyKeys)
      .where(
        and(
          eq(apiIdempotencyKeys.workspaceId, params.workspaceId),
          eq(apiIdempotencyKeys.idempotencyKey, params.idempotencyKey),
        ),
      )
      .limit(1)
  )[0];

  if (!row) return { type: "miss" };
  if (row.requestHash !== params.requestHash) return { type: "conflict" };

  return {
    type: "replay",
    statusCode: row.responseCode,
    responseBody: row.responseBody,
  };
}

export async function saveIdempotencyResponse(params: {
  workspaceId: string;
  idempotencyKey: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(apiIdempotencyKeys)
    .values({
      workspaceId: params.workspaceId,
      idempotencyKey: params.idempotencyKey,
      requestHash: params.requestHash,
      responseCode: params.statusCode,
      responseBody: params.responseBody as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [
        apiIdempotencyKeys.workspaceId,
        apiIdempotencyKeys.idempotencyKey,
      ],
      set: {
        requestHash: params.requestHash,
        responseCode: params.statusCode,
        responseBody: params.responseBody as Record<string, unknown>,
      },
    });
}

