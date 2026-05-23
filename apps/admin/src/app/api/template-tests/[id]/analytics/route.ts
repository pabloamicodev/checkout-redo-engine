import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analytics.service";
import { getShopId } from "@/lib/api-shop";
import { TemplateTestService } from "@/services/template-test.service";

const analyticsService = new AnalyticsService();
const service = new TemplateTestService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;

  // Ownership check — ensures experiment belongs to this shop and is TEMPLATE_TEST
  try {
    await service.get(shopId, id);
  } catch {
    return NextResponse.json({ error: "Template test not found" }, { status: 404 });
  }

  try {
    const analytics = await analyticsService.getExperimentAnalytics(shopId, id);
    return NextResponse.json(analytics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch analytics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


