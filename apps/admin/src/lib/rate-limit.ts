/**
 * Redis-based sliding window rate limiter for runtime API endpoints.
 *
 * Uses a sorted set per (key) where member = timestamp and score = timestamp.
 * Entries older than the window are pruned on each check.
 */

import { redis } from "@/lib/redis";

export interface RateLimitConfig {
  // Max requests allowed in the window
  limit: number;
  // Window duration in seconds
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp (ms) when the oldest entry expires
  limit: number;
}

// GUARD: default limits by endpoint class
export const RATE_LIMITS = {
  // Runtime endpoints (per shop or per visitor)
  runtime_config: { limit: 120, windowSeconds: 60 },      // 120 req/min per shop (CDN-fronted)
  runtime_assign: { limit: 100, windowSeconds: 60 },      // 100 req/min per visitor
  runtime_assign_shop: { limit: 2000, windowSeconds: 60 }, // 2000 req/min per shop (DoS guard)
  runtime_event: { limit: 200, windowSeconds: 60 },       // 200 events/min per shop
  runtime_cart_sync: { limit: 300, windowSeconds: 60 },   // 300 req/min per visitor
  // Generic admin
  admin_api: { limit: 300, windowSeconds: 60 },           // 300 req/min per shop
  webhook_inbound: { limit: 50, windowSeconds: 60 },      // 50 webhooks/min
  // Per-operation limits (write-heavy or expensive operations)
  create_experiment: { limit: 10, windowSeconds: 60 },    // 10 creates/min per shop
  import_cogs: { limit: 1, windowSeconds: 3600 },         // 1 CSV import/hour per shop
  reset_analytics: { limit: 2, windowSeconds: 3600 },     // 2 resets/hour per shop (destructive)
  analytics_export: { limit: 10, windowSeconds: 60 },     // 10 exports/min per shop
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Check and increment a rate limit counter.
 *
 * @param identifier - Unique key for this rate limit bucket (e.g. "shop_id:endpoint")
 * @param config - Limit and window configuration
 * @returns Whether the request is allowed and remaining quota
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  try {
    // Phase 1: prune the window and read the current count atomically.
    // We do NOT add the entry yet — adding unconditionally inflates the sorted set
    // for every denied request (e.g. bot floods), which bloats Redis and skews resetAt.
    const readPipeline = redis.pipeline();
    readPipeline.zremrangebyscore(key, 0, windowStart);
    readPipeline.zcard(key);

    const readResults = await readPipeline.exec();
    const countBefore = (readResults?.[1]?.[1] as number) ?? 0;

    const allowed = countBefore < config.limit;
    const remaining = Math.max(0, config.limit - countBefore - (allowed ? 1 : 0));

    // Phase 2: only record the request when it is actually allowed.
    // Blocked requests must not consume quota slots in the sorted set.
    if (allowed) {
      const writePipeline = redis.pipeline();
      writePipeline.zadd(key, now, `${now}-${Math.random()}`);
      writePipeline.expire(key, config.windowSeconds + 1);
      await writePipeline.exec();
    }

    // The oldest entry in the window determines when a new slot opens up.
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now;
    const resetAt = oldestScore + config.windowSeconds * 1000;

    return { allowed, remaining, resetAt, limit: config.limit };
  } catch {
    // GUARD: if Redis is unavailable, fail open (allow the request)
    return { allowed: true, remaining: config.limit, resetAt: now + config.windowSeconds * 1000, limit: config.limit };
  }
}

/**
 * Apply rate limit headers to a Response and return false if the request should be blocked.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
}
