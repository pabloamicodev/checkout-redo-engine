import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analytics.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new AnalyticsService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const metricParam = searchParams.get("metric") ?? "conversionRate";

    const dateRange =
      startParam && endParam
        ? { start: new Date(startParam), end: new Date(endParam) }
        : undefined;

    const [analytics, timeSeries] = await Promise.all([
      service.getExperimentAnalytics(shopId, id, dateRange),
      service.getTimeSeriesData(shopId, id, metricParam, dateRange),
    ]);

    if (!analytics) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({ analytics, timeSeries });
  });
}
