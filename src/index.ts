// PROZEN API server — Hono on @hono/node-server
// Replaces the legacy raw-http router. The server/ directory is kept for reference.

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

const host = "127.0.0.1";
const port = Number(process.env["PORT"] ?? 8787);

const app = createApp();

// Global middleware
app.use("*", requestIdMiddleware);
app.use("/api/*", authMiddleware);

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
    `  GET  /api/v1/workspaces/:wid/audit-events?productId=&limit=&offset=\n`,
  );
});
