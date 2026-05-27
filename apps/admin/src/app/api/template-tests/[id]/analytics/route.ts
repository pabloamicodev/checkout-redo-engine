import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/services/analytics.service";
import { withShopAuth } from "@/lib/api-middleware";
import { TemplateTestService } from "@/services/template-test.service";

const analyticsService = new AnalyticsService();
const service = new TemplateTestService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
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
  });
}

