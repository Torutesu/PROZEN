// PROZEN API server — Hono on @hono/node-server

import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import {
  authMiddleware,
  createApp,
  requestIdMiddleware,
} from "./api/middleware.js";
import { rateLimitMiddleware } from "./api/rate-limit.js";
import auditRoutes from "./api/audit-routes.js";
import contextPackRoutes from "./api/context-pack-routes.js";
import decisionLogRoutes from "./api/decision-log-routes.js";
import specRoutes from "./api/spec-routes.js";
import metricRoutes from "./api/metric-routes.js";
import githubRoutes from "./api/github-routes.js";
import workspaceRoutes from "./api/workspace-routes.js";
import briefingRoutes from "./api/briefing-routes.js";
import reviewRoutes from "./api/review-routes.js";
import integrationRoutes from "./api/integration-routes.js";
import { startGitHubSyncQueueWorker } from "./services/github-sync-queue.js";
import { startScheduler } from "./jobs/scheduler.js";
import { getSqlClient } from "./db/client.js";

const host = "127.0.0.1";
const port = Number(process.env["PORT"] ?? 8787);

const app = createApp();

// CORS — allow frontend origin (set ALLOWED_ORIGIN in production)
const allowedOrigins = (
  process.env["ALLOWED_ORIGIN"] ??
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100"
)
  .split(",")
  .map((v) => v.trim())
  .filter((v) => v.length > 0);
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-request-id", "x-actor-id"],
    exposeHeaders: ["x-request-id", "x-ratelimit-limit", "x-ratelimit-remaining"],
    maxAge: 86400,
    credentials: true,
  }),
);

// Global middleware
app.use("*", requestIdMiddleware);
// Auth applies to user-facing APIs. GitHub webhook uses HMAC signature verification instead.
app.use("/api/v1/workspaces/*", authMiddleware);

// Rate limiting on Claude-calling routes
app.use("/api/v1/workspaces/:wid/products/:pid/bets", rateLimitMiddleware);
app.use("/api/v1/workspaces/:wid/products/:pid/bets/:betId/messages", rateLimitMiddleware);
app.use("/api/v1/workspaces/:wid/products/:pid/bets/:betId/complete", rateLimitMiddleware);
app.use("/api/v1/workspaces/:wid/products/:pid/context-pack/ingest", rateLimitMiddleware);

// Health — includes DB connectivity check
app.get("/healthz", async (c) => {
  try {
    const sql = getSqlClient();
    await sql`SELECT 1`;
    return c.json({ status: "ok", service: "prozen-api", db: "ok" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ status: "degraded", service: "prozen-api", db: "error", detail: msg }, 503);
  }
});

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
app.route("/", reviewRoutes);

// M15 API routes (integrations + Stripe webhook)
// Note: Stripe webhook is at /api/v1/webhooks/stripe/:wid/:pid — no auth middleware needed
app.route("/", integrationRoutes);

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
  const stopScheduler = startScheduler();
  process.on("SIGTERM", () => { stopWorker(); stopScheduler(); });
  process.on("SIGINT", () => { stopWorker(); stopScheduler(); });

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
    `  POST /api/v1/workspaces/:wid/products/:pid/context-pack/compress\n`,
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
    `  GET  /api/v1/workspaces/:wid/products/:pid/anomalies\n`,
  );
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/anomalies/:anomalyId/affected-bets\n`,
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
  process.stdout.write(
    `  GET  /api/v1/workspaces/:wid/products/:pid/reviews/:type\n`,
  );
});
