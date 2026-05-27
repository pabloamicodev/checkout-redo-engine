import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "@/services/analytics.service";
import { withShopAuth } from "@/lib/api-middleware";

const analyticsService = new AnalyticsService();

/**
 * GET /api/experiments/:id/analytics/custom-metrics
 *
 * Query params:
 *   eventName — required, the registered custom event name to analyze
 *   startDate — ISO date string (optional)
 *   endDate   — ISO date string (optional)
 *
 * Returns per-variant counts and statistical significance vs. control,
 * allowing any registered custom event to be used as an experiment metric.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const eventName = searchParams.get("eventName");

    if (!eventName?.trim()) {
      return NextResponse.json({ error: "eventName query param is required" }, { status: 400 });
    }

    // GUARD: only allow registered custom events for this shop
    const registered = await prisma.customEvent.findUnique({
      where: { shopId_name: { shopId, name: eventName } },
      select: { name: true, displayName: true, description: true },
    });
    if (!registered) {
      return NextResponse.json(
        { error: `Custom event "${eventName}" is not registered for this shop. Register it at /custom-events first.` },
        { status: 404 }
      );
    }

    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    }

    const result = await analyticsService.getCustomEventMetrics(
      shopId,
      id,
      eventName,
      startDate && endDate ? { start: startDate, end: endDate } : undefined
    );

    if (!result) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

    return NextResponse.json({
      ...result,
      eventDisplayName: registered.displayName,
      eventDescription: registered.description,
    });
  });
}
