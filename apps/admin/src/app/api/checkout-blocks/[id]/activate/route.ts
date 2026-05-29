import { NextRequest, NextResponse } from "next/server";
import { CheckoutBlockService } from "@/services/checkout-block.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new CheckoutBlockService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const block = await service.activate(shopId, id);
      return NextResponse.json(block);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to activate checkout block";
      const status = msg.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  });
}

