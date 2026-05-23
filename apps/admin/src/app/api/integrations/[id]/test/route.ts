import { NextRequest, NextResponse } from "next/server";
import { IntegrationService } from "@/services/integration.service";
import { prisma } from "@/lib/prisma";

const service = new IntegrationService();
const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await prisma.shop.findUnique({ where: { shopDomain: DEMO_SHOP }, select: { id: true } });
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    const result = await service.testConnection(shop.id, id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Test failed" }, { status: 400 });
  }
}

