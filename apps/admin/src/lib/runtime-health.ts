/**
 * Redis-backed runtime health signal tracker.
 *
 * Records "last seen" timestamps for key storefront runtime events.
 * All writes are fire-and-forget so they never block response latency.
 *
 * Keys use a 48-hour TTL so stale shops naturally expire.
 */

import { redis } from "@/lib/redis";

const TTL_SECONDS = 48 * 60 * 60; // 48 hours

export type RuntimeSignal =
  | "config_fetch"
  | "assignment"
  | "cart_sync"
  | "event_ingested";

function key(shopDomain: string, signal: RuntimeSignal): string {
  return `rh:${shopDomain}:${signal}`;
}

/**
 * Record a successful runtime signal for a shop.
 * Silently swallows errors so it never affects the calling route.
 */
export function recordRuntimeSignal(
  shopDomain: string,
  signal: RuntimeSignal
): void {
  const now = new Date().toISOString();
  redis.set(key(shopDomain, signal), now, "EX", TTL_SECONDS).catch(() => {
    // Fail silently — health tracking must never break the storefront
  });
}

export interface RuntimeHealthData {
  lastConfigFetch: string | null;
  lastAssignment: string | null;
  lastCartSync: string | null;
  lastEventIngested: string | null;
}

/**
 * Read all runtime health signals for a shop.
 */
export async function getRuntimeHealth(
  shopDomain: string
): Promise<RuntimeHealthData> {
  try {
    const [configFetch, assignment, cartSync, eventIngested] =
      await Promise.all([
        redis.get(key(shopDomain, "config_fetch")),
        redis.get(key(shopDomain, "assignment")),
        redis.get(key(shopDomain, "cart_sync")),
        redis.get(key(shopDomain, "event_ingested")),
      ]);
    return {
      lastConfigFetch: configFetch,
      lastAssignment: assignment,
      lastCartSync: cartSync,
      lastEventIngested: eventIngested,
    };
  } catch {
    return {
      lastConfigFetch: null,
      lastAssignment: null,
      lastCartSync: null,
      lastEventIngested: null,
    };
  }
}
