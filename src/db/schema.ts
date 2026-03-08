// Drizzle schema — mirrors db/migrations/0001 + 0002 exactly.
// This file is READ-ONLY from the API implementation perspective.
// Schema changes must be done via a new migration file first.

import {
  boolean,
  integer,
  jsonb,
  numeric,
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

export const contextPacks = pgTable(
  "context_packs",
  {
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
  },
  (t) => [unique().on(t.workspaceId, t.productId)],
);

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

// ---------------------------------------------------------------------------
// M2 — Spec Agent (0004_m2_spec_agent.sql)
// ---------------------------------------------------------------------------

export const betSpecs = pgTable("bet_specs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  // currentVersionId has a deferred FK to bet_spec_versions (circular ref).
  currentVersionId: text("current_version_id"),
  // conversationId has a deferred FK to spec_conversations (circular ref).
  conversationId: text("conversation_id"),
  outcomeNote: text("outcome_note"),
  learningSummary: text("learning_summary"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const betSpecVersions = pgTable(
  "bet_spec_versions",
  {
    id: text("id").primaryKey(),
    betSpecId: text("bet_spec_id")
      .notNull()
      .references(() => betSpecs.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    structuredPayload: jsonb("structured_payload").notNull(),
    source: text("source").notNull(),
    sourceVersionFrom: integer("source_version_from"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.betSpecId, t.versionNumber)],
);

export const specConversations = pgTable("spec_conversations", {
  id: text("id").primaryKey(),
  betSpecId: text("bet_spec_id")
    .notNull()
    .references(() => betSpecs.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull().default([]),
  agentState: text("agent_state").notNull().default("collecting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// M3 — Signal → Decision Loop (0005_m3_metrics.sql)
// ---------------------------------------------------------------------------

export const metrics = pgTable("metrics", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  layer: text("layer").notNull(),
  unit: text("unit"),
  direction: text("direction").notNull().default("increase"),
  targetValue: numeric("target_value"),
  baselineValue: numeric("baseline_value"),
  // betSpecId has a nullable FK to bet_specs.
  betSpecId: text("bet_spec_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricReadings = pgTable("metric_readings", {
  id: text("id").primaryKey(),
  metricId: text("metric_id")
    .notNull()
    .references(() => metrics.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  value: numeric("value").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("manual"),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricAnomalies = pgTable("metric_anomalies", {
  id: text("id").primaryKey(),
  metricId: text("metric_id")
    .notNull()
    .references(() => metrics.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  readingId: text("reading_id"),
  severity: text("severity").notNull(),
  direction: text("direction").notNull(),
  baselineValue: numeric("baseline_value"),
  actualValue: numeric("actual_value").notNull(),
  deviationPct: numeric("deviation_pct"),
  impactNarrative: text("impact_narrative"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// M4 — GitHub Living Spec (0006_m4_github.sql)
// ---------------------------------------------------------------------------

export const githubConnections = pgTable(
  "github_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    repository: text("repository").notNull(),
    accessToken: text("access_token").notNull(),
    webhookId: text("webhook_id"),
    webhookSecret: text("webhook_secret").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.productId)],
);

export const githubSyncEvents = pgTable(
  "github_sync_events",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => githubConnections.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    githubDeliveryId: text("github_delivery_id"),
    repository: text("repository").notNull(),
    ref: text("ref"),
    commitSha: text("commit_sha"),
    prNumber: integer("pr_number"),
    prTitle: text("pr_title"),
    diffSummary: text("diff_summary"),
    analysis: jsonb("analysis"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.connectionId, t.githubDeliveryId)],
);
