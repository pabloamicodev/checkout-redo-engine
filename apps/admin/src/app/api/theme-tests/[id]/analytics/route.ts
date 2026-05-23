import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analytics.service";
import { ThemeTestService } from "@/services/theme-test.service";
import { getShopId } from "@/lib/api-shop";

const analyticsService = new AnalyticsService();
const service = new ThemeTestService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;

  try {
    await service.get(shopId, id); // ownership check
  } catch {
    return NextResponse.json({ error: "Theme test not found" }, { status: 404 });
  }

  try {
    const analytics = await analyticsService.getExperimentAnalytics(shopId, id);
    return NextResponse.json(analytics);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

