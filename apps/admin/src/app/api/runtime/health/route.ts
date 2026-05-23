/**
 * GET /api/runtime/health
 *
 * Returns real-time runtime health signals for a shop.
 * Used by the Install Health page and support tooling to diagnose
 * "the storefront isn't running" issues without guessing.
 *
 * Signals are sourced from Redis (last-seen timestamps written by runtime routes).
 * All checks fail-open — a Redis failure returns nulls, never an error.
 *
 * Auth: Admin JWT via withShopAuth (merchant-facing dashboard endpoint).
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { getRuntimeHealth } from "@/lib/runtime-health";
import { prisma } from "@/lib/prisma";

// A signal is considered "healthy" if seen within this window
const HEALTHY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function signalStatus(isoTimestamp: string | null): {
  lastSeenAt: string | null;
  healthy: boolean;
  staleSince: string | null;
} {
  if (!isoTimestamp) {
    return { lastSeenAt: null, healthy: false, staleSince: null };
  }
  const age = Date.now() - new Date(isoTimestamp).getTime();
  const healthy = age < HEALTHY_WINDOW_MS;
  return {
    lastSeenAt: isoTimestamp,
    healthy,
    staleSince: healthy ? null : isoTimestamp,
  };
}

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    // Resolve shopDomain from shopId — needed for Redis key lookup
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const health = await getRuntimeHealth(shop.shopDomain);

    const configFetch = signalStatus(health.lastConfigFetch);
    const assignment = signalStatus(health.lastAssignment);
    const cartSync = signalStatus(health.lastCartSync);
    const eventIngested = signalStatus(health.lastEventIngested);

    // Overall runtime health: config fetch is the minimum requirement.
    // Assignment and events are expected only for shops with running experiments.
    const overallHealthy = configFetch.healthy;

    return NextResponse.json({
      shopDomain: shop.shopDomain,
      overallHealthy,
      signals: {
        configFetch,
        assignment,
        cartSync,
        eventIngested,
      },
      // Human-readable summary for the Install Health UI
      summary: {
        runtimeActive: configFetch.healthy,
        assignmentActive: assignment.healthy,
        eventsFlowing: eventIngested.healthy,
        cartSyncActive: cartSync.healthy,
      },
    });
  });
}
