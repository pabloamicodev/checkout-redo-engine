import { NextRequest, NextResponse } from "next/server";
import { CheckoutTestService } from "@/services/checkout-test.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new CheckoutTestService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const exp = await service.activate(shopId, id);
      return NextResponse.json(exp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Activation failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 422 });
    }
  });
}
