// Drizzle schema — mirrors db/migrations/0001 + 0002 exactly.
// This file is READ-ONLY from the API implementation perspective.
// Schema changes must be done via a new migration file first.

import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// M0 — Foundation (0001_m0_foundation.sql)
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: text("id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
);

export const apiIdempotencyKeys = pgTable(
  "api_idempotency_keys",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseCode: integer("response_code").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.idempotencyKey] })],
);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  requestId: text("request_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// M1 — Context Layer (0002_m1_context_layer.sql)
// ---------------------------------------------------------------------------

export const contextPacks = pgTable("context_packs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  // currentVersionId has a deferred FK to context_pack_versions (circular ref)
  // The constraint is enforced by the DB migration; not repeated here.
  currentVersionId: text("current_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contextPackVersions = pgTable(
  "context_pack_versions",
  {
    id: text("id").primaryKey(),
    contextPackId: text("context_pack_id")
      .notNull()
      .references(() => contextPacks.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    summary: text("summary").notNull(),
    structuredPayload: jsonb("structured_payload").notNull(),
    source: text("source").notNull(),
    sourceVersionFrom: integer("source_version_from"),
    sourceVersionTo: integer("source_version_to"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.contextPackId, t.versionNumber)],
);

export const decisionLogs = pgTable("decision_logs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale").notNull(),
  alternatives: jsonb("alternatives").notNull().default([]),
  evidenceLinks: jsonb("evidence_links").notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const compressionJobs = pgTable("compression_jobs", {
  id: text("id").primaryKey(),
  contextPackId: text("context_pack_id")
    .notNull()
    .references(() => contextPacks.id, { onDelete: "cascade" }),
  sourceVersionFrom: integer("source_version_from").notNull(),
  sourceVersionTo: integer("source_version_to").notNull(),
  status: text("status").notNull(),
  outputPayload: jsonb("output_payload"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
