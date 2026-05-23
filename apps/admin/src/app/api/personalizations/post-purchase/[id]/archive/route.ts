import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.personalization.findFirst({
    where: { id, shopId: shop.id, type: "POST_PURCHASE" as never },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const p = await prisma.personalization.update({
      where: { id },
      data: { status: "ARCHIVED" as never },
    });
    return NextResponse.json(p);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to archive";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

