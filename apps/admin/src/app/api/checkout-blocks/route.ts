import { NextRequest, NextResponse } from "next/server";
import { CheckoutBlockService } from "@/services/checkout-block.service";
import { CreateCheckoutBlockSchema } from "@/lib/zod-schemas";
import { withShopAuth } from "@/lib/api-middleware";

const service = new CheckoutBlockService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await service.list(shopId, { status, type, page, limit });
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    return (async () => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = CreateCheckoutBlockSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
        }

        try {
          const block = await service.create(shopId, parsed.data);
          return NextResponse.json(block, { status: 201 });
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create checkout block" },
            { status: 400 }
          );
        }
      })();
  });
}


