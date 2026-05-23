import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService, type SegmentDimension } from "@/services/analytics.service";
import { withShopAuth } from "@/lib/api-middleware";

const ALLOWED_DIMENSIONS = new Set<SegmentDimension>([
  "deviceType",
  "country",
  "utmSource",
]);

const service = new AnalyticsService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const dim = searchParams.get("dimension") as SegmentDimension | null;
    if (!dim || !ALLOWED_DIMENSIONS.has(dim)) {
      return NextResponse.json(
        { error: "dimension must be one of: deviceType, country, utmSource" },
        { status: 400 }
      );
    }

    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const dateRange =
      startParam && endParam
        ? { start: new Date(startParam), end: new Date(endParam) }
        : undefined;

    const breakdown = await service.getSegmentBreakdown(shopId, id, dim, dateRange);

    if (!breakdown) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({ breakdown, dimension: dim });
  });
}
