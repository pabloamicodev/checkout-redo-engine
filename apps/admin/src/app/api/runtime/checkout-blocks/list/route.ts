import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRuntimeAuth } from "@/lib/api-middleware";

/**
 * Returns all checkout blocks for a shop — used by the checkout editor
 * picker so merchants can select a block to preview without copying IDs.
 *
 * GET /api/runtime/checkout-blocks/list
 * Header: X-Shop-Domain: shop.myshopify.com
 */
export async function GET(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain) => {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true },
    });
    if (!shop) return NextResponse.json({ blocks: [] });

    const blocks = await prisma.checkoutBlock.findMany({
      where: { shopId: shop.id },
      select: { id: true, name: true, type: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const response = NextResponse.json({ blocks });
    response.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    response.headers.set("Vary", "X-Shop-Domain");
    return response;
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
    },
  });
}
