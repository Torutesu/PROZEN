// PROZEN API server — Hono on @hono/node-server

import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import {
  authMiddleware,
  createApp,
  requestIdMiddleware,
} from "./api/middleware.js";
import auditRoutes from "./api/audit-routes.js";
import contextPackRoutes from "./api/context-pack-routes.js";
import decisionLogRoutes from "./api/decision-log-routes.js";
import specRoutes from "./api/spec-routes.js";
import metricRoutes from "./api/metric-routes.js";
import githubRoutes from "./api/github-routes.js";
import workspaceRoutes from "./api/workspace-routes.js";
import briefingRoutes from "./api/briefing-routes.js";
import { startGitHubSyncQueueWorker } from "./services/github-sync-queue.js";

const host = "127.0.0.1";
const port = Number(process.env["PORT"] ?? 8787);

const app = createApp();

// Global middleware
app.use("*", requestIdMiddleware);
// Auth applies to user-facing APIs. GitHub webhook uses HMAC signature verification instead.
app.use("/api/v1/workspaces/*", authMiddleware);

// Health
app.get("/healthz", (c) =>
  c.json({ status: "ok", service: "prozen-api" }),
);

// Schema endpoints
app.get("/schema/:name", async (c) => {
  const { name } = c.req.param();
  const allowed = ["bet-spec", "context-pack"];
  if (!allowed.includes(name)) {
    return c.json({ code: "not_found", message: "Schema not found." }, 404);
  }
  try {
    const raw = await readFile(
      path.resolve(process.cwd(), `schemas/${name}.schema.json`),
      "utf-8",
    );
    return c.json(JSON.parse(raw) as unknown);
  } catch {
    return c.json({ code: "schema_read_error", message: "Failed to read schema." }, 500);
  }
});

// M1 API routes
app.route("/", contextPackRoutes);
app.route("/", decisionLogRoutes);
app.route("/", auditRoutes);

// M2 API routes
app.route("/", specRoutes);

// M3 API routes
app.route("/", metricRoutes);

// M4 API routes
app.route("/", githubRoutes);

// M5 API routes
app.route("/", workspaceRoutes);

// M10 API routes
app.route("/", briefingRoutes);

// Fallback
app.notFound((c) =>
  c.json(
    {
      code: "not_found",
      message: "Route not found.",
      request_id: c.get("requestId") ?? "",
    },
    404,
  ),
);

serve({ fetch: app.fetch, hostname: host, port }, () => {
  const stopWorker = startGitHubSyncQueueWorker();
  process.on("SIGTERM", stopWorker);
  process.on("SIGINT", stopWorker);

  process.stdout.write(`PROZEN API started on http://${host}:${port}\n`);
  process.stdout.write(`  GET  /healthz\n`);
  process.stdout.write(`  GET  /schema/bet-spec\n`);
  process.stdout.write(`  GET  /schema/context-pack\n`);
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/context-pack/ingest\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/context-pack\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/context-pack/versions\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/context-pack/restore\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/decision-logs\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/decision-logs\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/decision-logs/:id\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/bets\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/bets\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/bets/:betId\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/bets/:betId/messages\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/bets/:betId/conversation\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/bets/:betId/versions\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/bets/:betId/restore\n`,
  );
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/metrics/ingest\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/metrics/anomalies\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/audit-events?productId=&limit=&offset=\n`,
  );
  process.stdout.write(`  GET  /api/v1/workspaces\n`);
  process.stdout.write(`  POST /api/v1/workspaces\n`);
  process.stdout.write(`  POST /api/v1/workspaces/onboarding/setup\n`);
  process.stdout.write(`  GET  /api/v1/workspaces/:wid\n`);
  process.stdout.write(`  GET  /api/v1/workspaces/:wid/products\n`);
  process.stdout.write(`  POST /api/v1/workspaces/:wid/products\n`);
  process.stdout.write(`  PATCH /api/v1/workspaces/:wid/products/:pid\n`);
  process.stdout.write(`  POST /api/v1/github/webhook\n`);
  process.stdout.write(
    `  POST /api/v1/workspaces/:wid/products/:pid/github-connections\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/github-connections\n`,
  );
  process.stdout.write(
    `  DELETE /api/v1/workspaces/:wid/products/:pid/github-connections\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/github-sync-events\n`,
  );
});
