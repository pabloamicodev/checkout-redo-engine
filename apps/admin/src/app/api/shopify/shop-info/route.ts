import { NextRequest, NextResponse } from "next/server";
import { getShopifyRestFetch } from "@/lib/shopify-admin-rest";
import { getSessionShop } from "@/lib/session-shop";

interface ShopifyShop {
  id: number;
  name: string;
  currency: string;
  enabled_presentment_currencies: string[];
  money_format: string;
  plan_name: string;
  plan_display_name: string;
}

/**
 * GET /api/shopify/shop-info
 *
 * Returns lightweight shop metadata:
 *   - currency (primary storefront currency)
 *   - hasMultiCurrency (more than one presentment currency enabled)
 *   - planName (Shopify plan slug, e.g. "enterprise" / "plus" / "partner_test")
 *
 * Used by Price Test Wizard to surface relevant warnings.
 */
export async function GET(_req: NextRequest) {
  const shopDomain = await getSessionShop();

  try {
    const restFetch = await getShopifyRestFetch(shopDomain);
    const data = await restFetch<{ shop: ShopifyShop }>("/shop.json");
    const shop = data.shop;

    const currencies: string[] = shop.enabled_presentment_currencies ?? [shop.currency];
    const hasMultiCurrency = currencies.length > 1;

    return NextResponse.json({
      currency: shop.currency,
      currencies,
      hasMultiCurrency,
      moneyFormat: shop.money_format,
      planName: shop.plan_name,
      planDisplayName: shop.plan_display_name,
    });
  } catch (err) {
    // Soft-fail: return safe defaults so the wizard can still render
    console.error("[shopify/shop-info] fetch failed:", err);
    return NextResponse.json(
      {
        currency: null,
        currencies: [],
        hasMultiCurrency: false,
        moneyFormat: null,
        planName: null,
        planDisplayName: null,
        warning: "Could not fetch shop info — Shopify API unavailable",
      },
      { status: 200 }, // always 200 so the wizard continues
    );
  }
}
