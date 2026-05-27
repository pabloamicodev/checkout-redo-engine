/**
 * POST /api/settings/reset-analytics
 *
 * Deletes all analytics data for the shop:
 *  - Events
 *  - ExperimentAssignments
 *  - OrderAttributions
 *  - DailyMetrics
 *
 * GUARD: Requires explicit confirmation header to prevent accidental calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, applyRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const rl = await checkRateLimit(`${shopId}:reset_analytics`, RATE_LIMITS.reset_analytics);
    if (!rl.allowed) {
      const headers = new Headers();
      applyRateLimitHeaders(headers, rl);
      return NextResponse.json(
        { error: "Analytics reset is limited to twice per hour." },
        { status: 429, headers }
      );
    }

    const confirm = request.headers.get("x-confirm-reset");
    if (confirm !== "yes") {
      return NextResponse.json(
        { error: "Send X-Confirm-Reset: yes header to confirm this destructive operation" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.event.deleteMany({ where: { shopId } }),
      prisma.experimentAssignment.deleteMany({ where: { shopId } }),
      prisma.orderAttribution.deleteMany({ where: { shopId } }),
      prisma.dailyMetric.deleteMany({ where: { shopId } }),
    ]);

    return NextResponse.json({ ok: true });
  });
}
