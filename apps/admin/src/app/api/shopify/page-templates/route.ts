import { NextRequest, NextResponse } from "next/server";
import { getShopifyRestFetch } from "@/lib/shopify-admin-rest";
import { getSessionShop } from "@/lib/session-shop";

/**
 * GET /api/shopify/page-templates?pageType=product
 *
 * Fetches all JSON template files for a given page type from the merchant's
 * currently published Shopify theme. Used by the Template Test wizard to let
 * merchants pick which templates to A/B test.
 *
 * Shopify OS 2.0 themes store templates as JSON files:
 *   templates/product.json        → default product template
 *   templates/product.alt.json    → alternate product template
 *   templates/collection.json     → default collection template
 *   etc.
 *
 * Response: { templates: PageTemplate[], activeTheme: { id: number; name: string } }
 */

export interface PageTemplate {
  handle: string;       // e.g. "product", "product.alt", "product.minimal"
  name: string;         // human-readable, e.g. "Default", "Alt", "Minimal"
  isDefault: boolean;   // true when handle === pageType (no suffix)
  key: string;          // full asset key, e.g. "templates/product.alt.json"
  updatedAt: string;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  product:    "Product",
  collection: "Collection",
  page:       "Page",
  article:    "Article",
  blog:       "Blog",
  index:      "Home",
  cart:       "Cart",
  "404":      "404",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pageType = searchParams.get("pageType");

  if (!pageType || !PAGE_TYPE_LABELS[pageType]) {
    return NextResponse.json(
      { error: "pageType is required. Valid values: product, collection, page, article, blog, index, cart" },
      { status: 400 }
    );
  }

  const shopDomain = await getSessionShop();

  try {
    const restFetch = await getShopifyRestFetch(shopDomain);

    // 1. Get the published (main) theme ID
    const { themes } = await restFetch<{
      themes: Array<{ id: number; name: string; role: string }>;
    }>("/themes.json");

    const activeTheme = themes.find((t) => t.role === "main");
    if (!activeTheme) {
      return NextResponse.json(
        { error: "No published theme found. Please publish a theme in your Shopify admin." },
        { status: 422 }
      );
    }

    // 2. Fetch all assets from the published theme
    const { assets } = await restFetch<{
      assets: Array<{ key: string; updated_at: string }>;
    }>(`/themes/${activeTheme.id}/assets.json`);

    // 3. Filter to JSON templates for the requested page type
    // OS 2.0: templates/product.json, templates/product.alt.json
    // Exclude customer templates (templates/customers/*)
    const prefix = `templates/${pageType}`;
    const templateAssets = assets.filter(
      (a) =>
        a.key.startsWith(prefix) &&
        a.key.endsWith(".json") &&
        !a.key.includes("/customers/")
    );

    // 4. Parse into PageTemplate objects
    const templates: PageTemplate[] = templateAssets.map((asset) => {
      // "templates/product.alt.json" → "product.alt"
      const handle = asset.key.replace("templates/", "").replace(".json", "");
      const isDefault = handle === pageType;

      // Generate a human-readable name
      let name: string;
      if (isDefault) {
        name = "Default";
      } else {
        // "product.alt" → "Alt"
        // "product.minimal-layout" → "Minimal Layout"
        const suffix = handle.replace(`${pageType}.`, "");
        name = suffix
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }

      return { handle, name, isDefault, key: asset.key, updatedAt: asset.updated_at };
    });

    // Sort: default first, then alphabetically by name
    templates.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      templates,
      activeTheme: { id: activeTheme.id, name: activeTheme.name },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch templates";
    const isAuthError =
      msg.includes("No Shopify session") || msg.includes("Session storage unavailable");
    return NextResponse.json(
      { error: msg, code: isAuthError ? "NO_SESSION" : "API_ERROR" },
      { status: isAuthError ? 401 : 502 }
    );
  }
}
