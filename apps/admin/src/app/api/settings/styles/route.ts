import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const GlobalStylesSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  borderRadius: z.string().optional(),
  buttonStyle: z.enum(["rounded", "pill", "square"]).optional(),
  badgePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  trustBadgeLayout: z.enum(["horizontal", "vertical", "grid"]).optional(),
  customCss: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    const settings = (shop.settings as Record<string, unknown>) ?? {};
    return NextResponse.json((settings.globalStyles as object) ?? {});
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = GlobalStylesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const current = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });
    const currentSettings = (current?.settings as Record<string, unknown>) ?? {};
    const currentStyles = (currentSettings.globalStyles as object) ?? {};

    const merged = { ...currentSettings, globalStyles: { ...currentStyles, ...parsed.data } };

    await prisma.shop.update({
      where: { id: shopId },
      data: { settings: merged },
    });

    return NextResponse.json(parsed.data);
  });
}
