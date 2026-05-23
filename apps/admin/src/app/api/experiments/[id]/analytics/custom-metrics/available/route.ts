import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";

/**
 * GET /api/experiments/:id/analytics/custom-metrics/available
 *
 * Returns all registered custom events for the shop along with
 * whether each has any recorded occurrences in this experiment,
 * so the UI can show a meaningful list for metric selection.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: DEMO_SHOP },
    select: { id: true },
  });
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id: experimentId } = await params;

  const [customEvents, eventCounts] = await Promise.all([
    prisma.customEvent.findMany({
      where: { shopId: shop.id },
      orderBy: { displayName: "asc" },
      select: { name: true, displayName: true, description: true },
    }),
    prisma.event.groupBy({
      by: ["eventName"],
      where: { shopId: shop.id, experimentId, eventType: "CUSTOM" },
      _count: { id: true },
    }),
  ]);

  const countMap = new Map(eventCounts.map((e) => [e.eventName, e._count.id]));

  return NextResponse.json({
    events: customEvents.map((e) => ({
      name: e.name,
      displayName: e.displayName,
      description: e.description,
      occurrences: countMap.get(e.name) ?? 0,
    })),
  });
}

