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
    await service.hardDelete(shopId, id, actorId);
    return NextResponse.json({ success: true });
  });
}
