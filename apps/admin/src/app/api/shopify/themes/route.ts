import { NextRequest, NextResponse } from "next/server";
import { getShopifyRestFetch, type ShopifyTheme } from "@/lib/shopify-admin-rest";
import { getSessionShop } from "@/lib/session-shop";

/**
 * GET /api/shopify/themes
 *
 * Proxies the Shopify Admin REST API `GET /themes.json` for the authenticated
 * shop and returns the full list of themes (published + unpublished).
 *
 * Response: { themes: ShopifyTheme[] }
 */
export async function GET(_req: NextRequest) {
  const shopDomain = await getSessionShop();

  try {
    const restFetch = await getShopifyRestFetch(shopDomain);
    const data = await restFetch<{ themes: ShopifyTheme[] }>("/themes.json");

    // Annotate the response to make it easy to identify the published theme
    const themes = data.themes.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      isPublished: t.role === "main",
      previewable: t.previewable,
      processing: t.processing,
      updatedAt: t.updated_at,
      adminGraphqlApiId: t.admin_graphql_api_id,
    }));

    // Sort: published first, then alphabetically
    themes.sort((a, b) => {
      if (a.isPublished) return -1;
      if (b.isPublished) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ themes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch themes";
    // Distinguish between auth errors and other errors
    const isAuthError =
      msg.includes("No Shopify session") || msg.includes("Session storage unavailable");
    return NextResponse.json(
      { error: msg, code: isAuthError ? "NO_SESSION" : "API_ERROR" },
      { status: isAuthError ? 401 : 502 }
    );
  }
}
