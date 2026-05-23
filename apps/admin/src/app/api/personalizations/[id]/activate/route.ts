import { NextRequest, NextResponse } from "next/server";
import { OfferPersonalizationService } from "@/services/offer-personalization.service";
import { prisma } from "@/lib/prisma";

const service = new OfferPersonalizationService();
const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: DEMO_SHOP },
    select: { id: true },
  });
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    const p = await service.activate(shop.id, id);
    return NextResponse.json(p);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to activate";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
  }
}

