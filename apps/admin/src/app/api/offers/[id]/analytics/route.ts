import { NextRequest, NextResponse } from "next/server";
import { OfferPersonalizationService } from "@/services/offer-personalization.service";
import { prisma } from "@/lib/prisma";

const service = new OfferPersonalizationService();
const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: DEMO_SHOP },
    select: { id: true },
  });
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;

  // Verify offer belongs to this shop
  const offer = await prisma.offer.findFirst({
    where: { id, shopId: shop.id },
    select: { id: true },
  });
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

  const analytics = await service.getOfferAnalytics(shop.id, id);
  return NextResponse.json(analytics);
}

