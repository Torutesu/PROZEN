import { createHash } from "node:crypto";

export interface StoredResponse {
  statusCode: number;
  body: unknown;
  requestHash: string;
  createdAt: string;
}

export type IdempotencyCheckResult =
  | { type: "miss" }
  | { type: "replay"; response: StoredResponse }
  | { type: "conflict" };

const keyOf = (workspaceId: string, idempotencyKey: string) => `${workspaceId}::${idempotencyKey}`;

export class IdempotencyStore {
  private readonly responses = new Map<string, StoredResponse>();

  static buildRequestHash(method: string, pathname: string, rawBody: string): string {
    return createHash("sha256").update(`${method}|${pathname}|${rawBody}`).digest("hex");
  }

  check(
    workspaceId: string,
    idempotencyKey: string,
    requestHash: string
  ): IdempotencyCheckResult {
    const existing = this.responses.get(keyOf(workspaceId, idempotencyKey));
    if (!existing) {
      return { type: "miss" };
    }
    if (existing.requestHash !== requestHash) {
      return { type: "conflict" };
    }
    return { type: "replay", response: existing };
  }

  save(
    workspaceId: string,
    idempotencyKey: string,
    requestHash: string,
    statusCode: number,
    body: unknown
  ) {
    this.responses.set(keyOf(workspaceId, idempotencyKey), {
      statusCode,
      body,
      requestHash,
      createdAt: new Date().toISOString()
    });
  }
}

