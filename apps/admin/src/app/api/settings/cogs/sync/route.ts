import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { CogsService } from "@/services/cogs.service";
import { prisma } from "@/lib/prisma";

const service = new CogsService();

// POST /api/settings/cogs/sync
// Pulls costPerItem from Shopify inventoryItem API for all product variants.
// GUARD: requires read_inventory scope — Shopify API will return null unitCost if missing.
// GUARD: MANUAL entries are never overwritten unless overwriteManual=true in body.
export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const shop = await prisma.shop.findFirst({
      where: { id: shopId },
      select: { shopDomain: true },
    });
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const overwriteManual = body.overwriteManual === true;

    try {
      const result = await service.syncFromShopify(shopId, shop.shopDomain, overwriteManual);
      return NextResponse.json({
        message: `Synced ${result.synced} variants from Shopify`,
        ...result,
      });
    } catch (err) {
      // In demo mode there's no real Shopify session — return a clear message
      const msg = err instanceof Error ? err.message : "Sync failed";
      if (msg.includes("session") || msg.includes("OAuth")) {
        return NextResponse.json(
          { synced: 0, skipped: 0, errors: 0, message: "Shopify sync requires a connected store. In demo mode, add costs manually or via CSV." },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
