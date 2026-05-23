import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

const SettingsSchema = z.object({
  estimatedShippingCost: z.number().min(0).optional(),
  transactionFeePercent: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true, currencyCode: true },
    });
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    const settings = (shop.settings ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      estimatedShippingCost: (settings["estimatedShippingCost"] as number) ?? 0,
      transactionFeePercent: (settings["transactionFeePercent"] as number) ?? 2.9,
      currencyCode: shop.currencyCode,
    });
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { settings: true } });
    const existing = (shop?.settings ?? {}) as Record<string, unknown>;

    const updated = {
      ...existing,
      ...(parsed.data.estimatedShippingCost !== undefined ? { estimatedShippingCost: parsed.data.estimatedShippingCost } : {}),
      ...(parsed.data.transactionFeePercent !== undefined ? { transactionFeePercent: parsed.data.transactionFeePercent } : {}),
    };

    await prisma.shop.update({ where: { id: shopId }, data: { settings: updated as never } });
    return NextResponse.json({ ok: true, settings: updated });
  });
}
