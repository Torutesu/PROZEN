// Hono middleware: request ID, API key auth, actor resolution.

import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

// Context variables — exported so route files can type their Hono instances.
export type Variables = {
  requestId: string;
  actorId: string;
};

export type HonoEnv = { Variables: Variables };

// ---------------------------------------------------------------------------
// Request ID middleware
// ---------------------------------------------------------------------------
export const requestIdMiddleware = createMiddleware<HonoEnv>(
  async (c, next: Next) => {
    const fromHeader = c.req.header("x-request-id");
    const requestId =
      typeof fromHeader === "string" && fromHeader.length > 0
        ? fromHeader
        : randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  },
);

// ---------------------------------------------------------------------------
// API key auth
// Expects: Authorization: Bearer <PROZEN_API_KEY>
// Actor resolved from X-Actor-Id header (placeholder for real auth in M2).
// ---------------------------------------------------------------------------
export const authMiddleware = createMiddleware<HonoEnv>(
  async (c, next: Next) => {
    const apiKey = process.env["PROZEN_API_KEY"];
    if (!apiKey) {
      // If PROZEN_API_KEY is not configured, skip auth (local dev mode).
      c.set("actorId", c.req.header("x-actor-id") ?? "anonymous");
      await next();
      return;
    }

    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== apiKey) {
      return c.json(
        {
          code: "unauthorized",
          message: "Invalid or missing API key.",
          request_id: c.get("requestId"),
        },
        401,
      );
    }

    c.set("actorId", c.req.header("x-actor-id") ?? "api_key_holder");
    await next();
  },
);

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------
export function apiError(
  c: Context,
  status: 400 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
  details?: unknown,
) {
  const requestId = (c as { get?: (key: string) => unknown }).get?.("requestId");
  return c.json(
    {
      code,
      message,
      request_id: typeof requestId === "string" ? requestId : "",
      ...(details !== undefined ? { details } : {}),
    },
    status,
  );
}

// Typed Hono factory — use this in route files to get c.get() type safety.
export const createApp = (): Hono<HonoEnv> => new Hono<HonoEnv>();
