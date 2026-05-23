import { NextRequest, NextResponse } from "next/server";
import { PriceTestService } from "@/services/price-test.service";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const service = new PriceTestService();

const RolloutSchema = z.object({
  winnerVariantId: z.string().min(1),
  confirmationToken: z.string().min(1),
});

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
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = RolloutSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    try {
      const result = await service.rollout(
        shopId, id, parsed.data.winnerVariantId, parsed.data.confirmationToken, shop.shopDomain
      );
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollout failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
    }
  });
}
