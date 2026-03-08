// In-memory token bucket rate limiter for Claude-calling routes.
// Per actor (user ID). No external dependencies required.
//
// Defaults: 20 requests per 60 seconds per actor.
// Exceeding the limit returns HTTP 429.

import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "./middleware.js";

interface Bucket {
  tokens: number;
  lastRefill: number; // epoch ms
}

const buckets = new Map<string, Bucket>();

const CAPACITY = 20;        // max tokens
const REFILL_RATE = 20;     // tokens added per window
const WINDOW_MS = 60_000;   // 1 minute

function getTokens(actorId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(actorId);

  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(actorId, bucket);
  }

  // Refill tokens proportionally to elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= WINDOW_MS) {
    bucket.tokens = CAPACITY;
    bucket.lastRefill = now;
  } else {
    const refill = Math.floor((elapsed / WINDOW_MS) * REFILL_RATE);
    if (refill > 0) {
      bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens };
}

// Prune stale entries every 5 minutes to avoid unbounded memory growth.
const pruneTimer = setInterval(
  () => {
    const cutoff = Date.now() - WINDOW_MS * 5;
    for (const [key, bucket] of buckets) {
      if (bucket.lastRefill < cutoff) {
        buckets.delete(key);
      }
    }
  },
  5 * 60_000,
);
pruneTimer.unref?.();

export const rateLimitMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const actorId = c.get("actorId") ?? "anonymous";
  const { allowed, remaining } = getTokens(actorId);

  c.header("x-ratelimit-limit", String(CAPACITY));
  c.header("x-ratelimit-remaining", String(remaining));

  if (!allowed) {
    return c.json(
      {
        code: "rate_limit_exceeded",
        message: "Too many requests. Please wait before retrying.",
        request_id: c.get("requestId") ?? "",
      },
      429,
    );
  }

  await next();
});
