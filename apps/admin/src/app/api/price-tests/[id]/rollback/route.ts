import { NextRequest, NextResponse } from "next/server";
import { PriceTestService } from "@/services/price-test.service";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

const service = new PriceTestService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true },
    });
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const { id } = await params;
    try {
      const result = await service.rollback(shopId, id, shop.shopDomain);
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollback failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
    }
  });
}

