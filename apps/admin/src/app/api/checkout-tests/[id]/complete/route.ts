import { NextRequest, NextResponse } from "next/server";
import { ExperimentService } from "@/services/experiment.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new ExperimentService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId, actorId) => {
    const { id } = await params;
    try {
      const experiment = await service.complete(shopId, id, actorId);
      return NextResponse.json(experiment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Complete failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 422 });
    }
  });
}
