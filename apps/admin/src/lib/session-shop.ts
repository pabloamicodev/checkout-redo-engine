/**
 * Resolves the current shop domain for server-side rendering.
 *
 * Resolution order:
 *  1. `shopify_session_shop` cookie (set during OAuth callback)
 *  2. DEMO_SHOP_DOMAIN env var (dev / demo mode)
 *  3. "demo.myshopify.com" hardcoded fallback
 *
 * This is the single source of truth for all dashboard pages.
 * API routes use withShopAuth (in api-middleware.ts) instead.
 */

import { cookies } from "next/headers";

export async function getSessionShop(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const sessionShop = cookieStore.get("shopify_session_shop")?.value;
    if (sessionShop && sessionShop.endsWith(".myshopify.com")) {
      return sessionShop;
    }
  } catch {
    // cookies() throws outside of request context (e.g. during build)
  }
  return process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";
}
