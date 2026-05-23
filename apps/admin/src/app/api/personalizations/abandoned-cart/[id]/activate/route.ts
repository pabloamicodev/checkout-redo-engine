import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { AbandonedCartService } from "@/services/abandoned-cart.service";

const svc = new AbandonedCartService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withShopAuth(request, async (shopId) => {
    try {
      const p = await svc.activate(shopId, id);
      return NextResponse.json(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Activation failed";
      const status = msg.includes("not found") ? 404 : 422;
      return NextResponse.json({ error: msg }, { status });
    }
  });
}


