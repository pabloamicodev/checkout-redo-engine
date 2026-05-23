import { NextRequest, NextResponse } from "next/server";
import { ExperimentService } from "@/services/experiment.service";
import { withShopAuth, withPlanGuard } from "@/lib/api-middleware";

const service = new ExperimentService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId, actorId) => {
    return withPlanGuard(shopId, "experiments", async () => {
      const { id } = await params;
      const experiment = await service.launch(shopId, id, actorId);
      return NextResponse.json({ experiment });
    });
  });
}
