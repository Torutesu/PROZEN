import { randomUUID } from "node:crypto";

export interface AuditEvent {
  id: string;
  workspaceId: string;
  productId?: string;
  actorId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListAuditOptions {
  productId?: string;
  limit?: number;
}

export class AuditStore {
  private readonly events: AuditEvent[] = [];

  record(event: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
    const created: AuditEvent = {
      ...event,
      id: `audit_${randomUUID()}`,
      createdAt: new Date().toISOString()
    };
    this.events.push(created);
    return created;
  }

  listByWorkspace(workspaceId: string, options?: ListAuditOptions): AuditEvent[] {
    const filtered = this.events.filter((event) => {
      if (event.workspaceId !== workspaceId) {
        return false;
      }
      if (options?.productId && event.productId !== options.productId) {
        return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const limit = options?.limit ?? 50;
    return sorted.slice(0, Math.max(1, Math.min(limit, 200)));
  }
}

