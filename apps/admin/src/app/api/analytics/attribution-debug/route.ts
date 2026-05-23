/**
 * GET /api/analytics/attribution-debug
 *
 * Returns attribution health metrics for the authenticated shop:
 * - Total attributed vs. unattributed orders (last 30 days)
 * - Attribution method breakdown (cart token / checkout token / customer / note attributes)
 * - Recent unattributed orders for investigation
 *
 * Used by support to diagnose attribution gaps and by the Install Health page
 * to surface "Order attribution" status to merchants.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withShopAuth } from "@/lib/api-middleware";

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId: string) => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Total attributed orders in the window
    const [totalAttributed, unattributedCount] = await Promise.all([
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: { not: null },
        },
      }),
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: null,
        },
      }),
    ]);

    const totalOrders = totalAttributed + unattributedCount;
    const attributionRate =
      totalOrders > 0 ? Math.round((totalAttributed / totalOrders) * 100) : 100;

    // Attribution method breakdown — inferred from which identifier is non-null.
    // Priority: cartToken > checkoutToken > customerId > visitorId (from note attrs).
    const [byCartToken, byCheckoutToken, byCustomerId, byVisitorOnly] = await Promise.all([
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: { not: null },
          cartToken: { not: null },
        },
      }),
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: { not: null },
          cartToken: null,
          checkoutToken: { not: null },
        },
      }),
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: { not: null },
          cartToken: null,
          checkoutToken: null,
          customerId: { not: null },
        },
      }),
      prisma.orderAttribution.count({
        where: {
          shopId,
          attributedAt: { gte: since },
          experimentId: { not: null },
          cartToken: null,
          checkoutToken: null,
          customerId: null,
          visitorId: { not: null },
        },
      }),
    ]);

    // Recent unattributed orders for debugging
    const recentUnattributed = await prisma.orderAttribution.findMany({
      where: {
        shopId,
        attributedAt: { gte: since },
        experimentId: null,
      },
      orderBy: { attributedAt: "desc" },
      take: 10,
      select: {
        shopifyOrderId: true,
        shopifyOrderName: true,
        totalPrice: true,
        currencyCode: true,
        financialStatus: true,
        cartToken: true,
        checkoutToken: true,
        customerId: true,
        visitorId: true,
        attributedAt: true,
      },
    });

    return NextResponse.json({
      windowDays: days,
      since: since.toISOString(),
      totals: {
        total: totalOrders,
        attributed: totalAttributed,
        unattributed: unattributedCount,
        attributionRate,
      },
      methodBreakdown: {
        cartToken: byCartToken,
        checkoutToken: byCheckoutToken,
        customerId: byCustomerId,
        visitorIdOnly: byVisitorOnly,
      },
      recentUnattributed,
    });
  });
}
