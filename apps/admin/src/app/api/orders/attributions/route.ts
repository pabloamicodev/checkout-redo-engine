import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withShopAuth } from "@/lib/api-middleware";

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId: string) => {
    const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experimentId") ?? undefined;
  const variantId = searchParams.get("variantId") ?? undefined;
  const financialStatus = searchParams.get("financialStatus") ?? undefined;
  const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
  const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;
  if (startDate && isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }
  if (endDate && isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
  }
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "1", 10) - 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const where = {
    shopId,
    ...(experimentId ? { experimentId } : {}),
    ...(variantId ? { variantId } : {}),
    ...(financialStatus ? { financialStatus } : {}),
    ...(startDate || endDate
      ? { attributedAt: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.orderAttribution.findMany({
      where,
      orderBy: { attributedAt: "desc" },
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        shopifyOrderId: true,
        shopifyOrderName: true,
        experimentId: true,
        variantId: true,
        visitorId: true,
        subtotalPrice: true,
        totalPrice: true,
        netRevenue: true,
        totalDiscounts: true,
        currencyCode: true,
        cogs: true,
        grossProfit: true,
        contributionMargin: true,
        financialStatus: true,
        fulfillmentStatus: true,
        attributedAt: true,
        experiment: { select: { name: true, type: true, slug: true } },
        variant: { select: { name: true, key: true, isControl: true } },
      },
    }),
    prisma.orderAttribution.count({ where }),
  ]);

    return NextResponse.json({ items, total, page: page + 1, limit });
  });
}
