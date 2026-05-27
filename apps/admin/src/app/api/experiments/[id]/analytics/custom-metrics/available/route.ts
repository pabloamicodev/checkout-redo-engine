import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withShopAuth } from "@/lib/api-middleware";

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
  return withShopAuth(request, async (shopId) => {
    const { id: experimentId } = await params;

    const [customEvents, eventCounts] = await Promise.all([
      prisma.customEvent.findMany({
        where: { shopId },
        orderBy: { displayName: "asc" },
        select: { name: true, displayName: true, description: true },
      }),
      prisma.event.groupBy({
        by: ["eventName"],
        where: { shopId, experimentId, eventType: "CUSTOM" },
        _count: { id: true },
      }),
    ]);

    const countMap = new Map(
      eventCounts.map((e: (typeof eventCounts)[number]) => [e.eventName, e._count.id])
    );

    return NextResponse.json({
      events: customEvents.map((e: (typeof customEvents)[number]) => ({
        name: e.name,
        displayName: e.displayName,
        description: e.description,
        occurrences: countMap.get(e.name) ?? 0,
      })),
    });
  });
}
