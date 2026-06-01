import { NextRequest, NextResponse } from "next/server";
import { ExperimentService } from "@/services/experiment.service";
import { UpdateExperimentSchema } from "@/lib/zod-schemas";
import { withShopAuth } from "@/lib/api-middleware";

const service = new ExperimentService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    const experiment = await service.get(shopId, id);
    return NextResponse.json({ experiment });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId, actorId) => {
    const { id } = await params;
    const body = await request.json() as unknown;

    const parsed = UpdateExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const experiment = await service.update(shopId, id, parsed.data, actorId);
    return NextResponse.json({ experiment });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId, actorId) => {
    const { id } = await params;
    await service.hardDelete(shopId, id, actorId);
    return NextResponse.json({ success: true });
  });
}
