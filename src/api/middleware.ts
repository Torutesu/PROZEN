// Hono middleware: request ID, Clerk JWT auth, actor resolution.

import { randomUUID } from "node:crypto";
import { verifyToken } from "@clerk/backend";
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
// Auth middleware
// Strategy (in priority order):
//  1. CLERK_SECRET_KEY set → verify Clerk JWT from Authorization: Bearer <token>
//  2. PROZEN_API_KEY set   → legacy simple API key check (dev/CI use)
//  3. Neither set          → local dev passthrough (anonymous)
// ---------------------------------------------------------------------------
export const authMiddleware = createMiddleware<HonoEnv>(
  async (c, next: Next) => {
    const clerkSecretKey = process.env["CLERK_SECRET_KEY"];
    const apiKey = process.env["PROZEN_API_KEY"];

    const authHeader = c.req.header("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // --- Clerk JWT path ---
    if (clerkSecretKey) {
      if (!token) {
        return c.json(
          {
            code: "unauthorized",
            message: "Missing Authorization header.",
            request_id: c.get("requestId"),
          },
          401,
        );
      }
      try {
        const payload = await verifyToken(token, { secretKey: clerkSecretKey });
        if (typeof payload.sub !== "string" || payload.sub.length === 0) {
          return c.json(
            {
              code: "unauthorized",
              message: "Token missing subject claim.",
              request_id: c.get("requestId"),
            },
            401,
          );
        }
        // `sub` is the Clerk user ID
        c.set("actorId", payload.sub);
        await next();
        return;
      } catch {
        return c.json(
          {
            code: "unauthorized",
            message: "Invalid or expired token.",
            request_id: c.get("requestId"),
          },
          401,
        );
      }
    }

    // --- Legacy API key path ---
    if (apiKey) {
      if (!token || token !== apiKey) {
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
      return;
    }

    // --- Local dev passthrough ---
    c.set("actorId", c.req.header("x-actor-id") ?? "anonymous");
    await next();
  },
);

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------
export function apiError(
  c: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500 | 502,
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
