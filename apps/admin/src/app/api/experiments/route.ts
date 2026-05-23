import { NextRequest, NextResponse } from "next/server";
import { ExperimentService } from "@/services/experiment.service";
import { CreateExperimentSchema } from "@/lib/zod-schemas";
import { getShopFromRequest, withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";

const service = new ExperimentService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);

    const { experiments, total } = await service.list(shopId, {
      status: searchParams.get("status") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      search: searchParams.get("q") ?? undefined,
      limit: parseInt(searchParams.get("limit") ?? "50"),
      offset: parseInt(searchParams.get("offset") ?? "0"),
    });

    return NextResponse.json({ experiments, total });
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId, actorId) => {
    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "experiments", async () => {
        const body = await request.json() as unknown;

        const parsed = CreateExperimentSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const experiment = await service.create(shopId, parsed.data, actorId);
        return NextResponse.json({ experiment }, { status: 201 });
      })
    );
  });
}
