/**
 * Resolves the current shop domain for server-side rendering.
 *
 * Resolution order:
 *  1. `shopParam` argument (passed from page `searchParams.shop`) — highest priority
 *  2. `x-shop` request header (injected by middleware from `?shop=` URL param) — correct
 *     per-store value even when multiple stores share the same browser session
 *  3. `shopify_session_shop` cookie (set during OAuth callback) — fallback
 *  4. DEMO_SHOP_DOMAIN env var (dev / demo mode)
 *  5. "demo.myshopify.com" hardcoded fallback
 *
 * The `x-shop` header is the primary fix for multi-tenant isolation: Shopify always
 * passes `?shop=` in embedded app URLs, which the middleware forwards as a request
 * header so server components read the correct store without touching the cookie.
 *
 * API routes use withShopAuth (in api-middleware.ts) instead.
 */

import { cookies, headers } from "next/headers";

const MYSHOPIFY_RE = /^[a-zA-Z0-9-]+\.myshopify\.com$/;

export async function getSessionShop(shopParam?: string | null): Promise<string> {
  // 1. Explicit shop param (e.g. from page searchParams.shop)
  if (shopParam && MYSHOPIFY_RE.test(shopParam.trim())) {
    return shopParam.trim().toLowerCase();
  }

  // 2. x-shop header — injected by middleware from Shopify's ?shop= URL param
  //    This is the correct value for the current embedded request, regardless of cookie.
  try {
    const headerStore = await headers();
    const shopHeader = headerStore.get("x-shop");
    if (shopHeader && MYSHOPIFY_RE.test(shopHeader.trim())) {
      return shopHeader.trim().toLowerCase();
    }
  } catch {
    // headers() throws outside of request context (e.g. during build)
  }

  // 3. Cookie fallback (non-embedded SSR, OAuth callback pages, etc.)
  try {
    const cookieStore = await cookies();
    const sessionShop = cookieStore.get("shopify_session_shop")?.value;
    if (sessionShop && sessionShop.endsWith(".myshopify.com")) {
      return sessionShop;
    }
  } catch {
    // cookies() throws outside of request context (e.g. during build)
  }

  // 4. Demo / dev fallback
  return process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";
}
