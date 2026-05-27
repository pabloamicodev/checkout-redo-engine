import { NextRequest, NextResponse } from "next/server";
import { DiscountTestService, CreateDiscountTestSchema } from "@/services/discount-test.service";
import { withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";

const service = new DiscountTestService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const result = await service.list(shopId, { status, limit, offset });
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "experiments", async () => {
        let body: unknown;
        try { body = await request.json(); }
        catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

        const parsed = CreateDiscountTestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
        }

        try {
          const experiment = await service.create(shopId, parsed.data);
          return NextResponse.json(experiment, { status: 201 });
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create discount test" },
            { status: 400 }
          );
        }
      })
    );
  });
}

