import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopFromRequest } from "@/lib/api-middleware";

const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";

/**
 * Resolves the shopId for API route handlers.
 *
 * Pass `request` to authenticate via App Bridge JWT (required in production).
 * Without `request`, falls back to DEMO_SHOP_DOMAIN (dev-only).
 *
 * Migration: replace `await getShopId()` → `await getShopId(request)` in route files.
 * This ensures every admin API call is authenticated by a real Shopify session.
 */
export async function getShopId(request?: NextRequest): Promise<string | null> {
  if (request) {
    const shop = await getShopFromRequest(request);
    return shop?.shopId ?? null;
  }

  // Dev-only fallback — blocked in production
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "getShopId() called without a request in production. " +
      "Pass the NextRequest object: await getShopId(request)."
    );
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: DEMO_SHOP },
    select: { id: true },
  });
  return shop?.id ?? null;
}
