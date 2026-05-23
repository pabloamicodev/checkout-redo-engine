/**
 * GET  /api/settings/general → returns full ShopInfo + settings JSON
 * POST /api/settings/general → merges provided fields into shop.settings JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { ShopSettingsSchema } from "@/lib/zod-schemas";

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true, currencyCode: true, timezone: true, settings: true },
    });
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    return NextResponse.json(shop);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const body = await request.json();
    const parsed = ShopSettingsSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const current = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const merged = {
      ...((current?.settings as object) ?? {}),
      ...parsed.data,
    };

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { settings: merged },
      select: { settings: true },
    });

    return NextResponse.json({ settings: shop.settings });
  });
}
