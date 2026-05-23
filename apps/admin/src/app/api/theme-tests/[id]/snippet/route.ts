import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopId } from "@/lib/api-shop";
import { getShopifyRestFetch } from "@/lib/shopify-admin-rest";
import { generateThemeAbSnippet, type ThemeAbVariant } from "@/lib/theme-ab-snippet";

// ---------------------------------------------------------------------------
// Types for Shopify theme asset response
// ---------------------------------------------------------------------------

interface ShopifyThemeAsset {
  key: string;
  public_url: string | null;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

// CSS/JS asset keys to look for (covers Dawn, Craft, Sense, Ride, Crave, etc.)
const CSS_ASSET_KEYS = [
  "assets/base.css",
  "assets/theme.css",
  "assets/application.css",
  "assets/global.css",
  "assets/styles.css",
];

const JS_ASSET_KEYS = [
  "assets/theme.js",
  "assets/application.js",
  "assets/global.js",
];

// ---------------------------------------------------------------------------
// GET /api/theme-tests/[id]/snippet
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const shopId = await getShopId(request as import("next/server").NextRequest);
  if (!shopId) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  // Load experiment with shop relation to get shopDomain
  const experiment = await prisma.experiment.findFirst({
    where: { id, shopId, type: "THEME_TEST" },
    select: {
      id: true,
      name: true,
      variants: {
        select: {
          key: true,
          name: true,
          isControl: true,
          settings: true,
        },
      },
      shop: { select: { shopDomain: true } },
    },
  });

  if (!experiment) {
    return NextResponse.json({ error: "Theme test not found" }, { status: 404 });
  }

  const shopDomain = experiment.shop.shopDomain;

  // Map variants to ThemeAbVariant
  const variants: ThemeAbVariant[] = experiment.variants.map((v: (typeof experiment.variants)[number]) => {
    const settings = v.settings as Record<string, unknown> | null;
    return {
      key: v.key,
      name: v.name,
      isControl: v.isControl,
      themeId: settings?.themeId ? Number(settings.themeId) : null,
      themeName: String(settings?.themeName ?? ""),
    };
  });

  const treatmentVariants = variants.filter((v) => !v.isControl && v.themeId !== null);

  if (treatmentVariants.length === 0) {
    return NextResponse.json(
      { error: "No variant themes configured. Assign a Shopify theme to each variant first." },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch real asset public_urls from Shopify Admin API for each variant theme
  // ---------------------------------------------------------------------------

  let cssAssets: string[] = [];
  let jsAssets: string[] = [];

  try {
    const restFetch = await getShopifyRestFetch(shopDomain);

    // Use the first treatment variant's theme to discover asset filenames.
    // All themes from the same base theme (duplicates) share the same asset names.
    const firstVariant = treatmentVariants[0]!;
    const themeId = firstVariant.themeId!;

    // Fetch asset list — Shopify returns all assets for the theme
    const { assets } = await restFetch<{ assets: ShopifyThemeAsset[] }>(
      `/themes/${themeId}/assets.json`
    );

    const assetMap = new Map<string, ShopifyThemeAsset>(
      (assets ?? []).map((a) => [a.key, a])
    );

    // Find CSS assets that actually exist in this theme
    const foundCss = CSS_ASSET_KEYS.filter((key) => assetMap.has(key)).map(
      (key) => assetMap.get(key)!.public_url ?? key.replace("assets/", "")
    );
    const foundJs = JS_ASSET_KEYS.filter((key) => assetMap.has(key)).map(
      (key) => assetMap.get(key)!.public_url ?? key.replace("assets/", "")
    );

    // If we got public_urls, use them directly; otherwise fall back to filenames
    if (foundCss.length > 0) cssAssets = foundCss;
    if (foundJs.length > 0) jsAssets = foundJs;

  } catch (apiErr) {
    console.warn(
      "[snippet] Could not fetch theme assets from Shopify API — using default filenames:",
      apiErr instanceof Error ? apiErr.message : apiErr
    );
    // Fall through: generateThemeAbSnippet uses DEFAULT_CSS_ASSETS / DEFAULT_JS_ASSETS
  }

  // ---------------------------------------------------------------------------
  // Generate the snippet
  // ---------------------------------------------------------------------------

  // Derive shopId for CDN URL — Shopify numeric shop ID is embedded in the session.
  // If unavailable, the snippet generator skips CDN embedding and uses public_urls.
  const snippetInput = {
    experimentId: experiment.id,
    experimentName: experiment.name,
    shopId: shopDomain.replace(".myshopify.com", ""), // fallback identifier
    shopDomain,
    variants,
    ...(cssAssets.length > 0 ? { cssAssets } : {}),
    ...(jsAssets.length > 0 ? { jsAssets } : {}),
  };

  let result;
  try {
    result = generateThemeAbSnippet(snippetInput);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate snippet" },
      { status: 422 }
    );
  }

  return NextResponse.json({
    experimentId: experiment.id,
    experimentName: experiment.name,
    snippet: result.liquidSnippet,
    installationGuide: result.installationGuide,
    debugScript: result.debugScript,
    variants: treatmentVariants.map((v) => ({
      key: v.key,
      name: v.name,
      themeId: v.themeId,
      themeName: v.themeName,
    })),
    cssAssets,
    jsAssets,
    generatedAt: new Date().toISOString(),
  });
}

