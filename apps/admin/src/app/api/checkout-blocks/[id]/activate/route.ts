import { NextRequest, NextResponse } from "next/server";
import { CheckoutBlockService } from "@/services/checkout-block.service";
import { prisma } from "@/lib/prisma";

const service = new CheckoutBlockService();
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
    const block = await service.activate(shop.id, id);
    return NextResponse.json(block);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to activate checkout block";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

