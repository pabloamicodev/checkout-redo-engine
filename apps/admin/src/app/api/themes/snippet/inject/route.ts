/**
 * POST /api/themes/snippet/inject
 *
 * Writes the MarginLab runtime Liquid snippet into the merchant's currently
 * published Shopify theme via the Admin Asset API, and optionally patches
 * layout/theme.liquid to render it automatically before </body>.
 *
 * Two assets are written:
 *   snippets/marginlab-runtime.liquid — the <script> tag + shop config
 *   layout/theme.liquid — patched to include {% render 'marginlab-runtime' %}
 *
 * Idempotent: safe to call multiple times (PUT overwrites in place).
 *
 * Body (JSON):
 *   patchThemeLiquid?: boolean  — default true; set false to skip patching theme.liquid
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withShopAuth } from "@/lib/api-middleware";
import { getShopifyRestFetch } from "@/lib/shopify-admin-rest";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface ShopifyTheme {
  id: number;
  name: string;
  role: string;
}

interface ShopifyAssetResponse {
  asset: {
    key: string;
    value?: string;
    updated_at: string;
  };
}

const SNIPPET_KEY = "snippets/marginlab-runtime.liquid";
const RENDER_TAG = "{% render 'marginlab-runtime' %}";
const THEME_LIQUID_KEY = "layout/theme.liquid";

function buildSnippet(shopDomain: string): string {
  const appHost = (process.env.HOST ?? "https://checkout-redo-engine.vercel.app")
    .trim()
    .replace(/\/+$/, "");
  const scriptUrl = `${appHost}/api/runtime/script.js`;

  return `{% comment %}MarginLab A/B Testing Runtime — managed by the MarginLab app. Do not edit manually.{% endcomment %}
<script>
  window.marginlabConfig = window.marginlabConfig || {};
  window.marginlabConfig.shopDomain = {{ shop.permanent_domain | json }};
</script>
<script src="${scriptUrl}?shop=${shopDomain}" defer></script>`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withShopAuth(request, async (shopId) => {
    let patchThemeLiquid = true;
    try {
      const body = await request.json() as { patchThemeLiquid?: boolean };
      if (typeof body.patchThemeLiquid === "boolean") {
        patchThemeLiquid = body.patchThemeLiquid;
      }
    } catch {
      // no body or invalid JSON — use defaults
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const { shopDomain } = shop;

    let restFetch: Awaited<ReturnType<typeof getShopifyRestFetch>>;
    try {
      restFetch = await getShopifyRestFetch(shopDomain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create Shopify REST client";
      return NextResponse.json({ error: msg, code: "NO_SESSION" }, { status: 401 });
    }

    // Find the published theme
    let publishedTheme: ShopifyTheme;
    try {
      const { themes } = await restFetch<{ themes: ShopifyTheme[] }>("/themes.json");
      const main = themes.find((t) => t.role === "main");
      if (!main) {
        return NextResponse.json({ error: "No published theme found" }, { status: 404 });
      }
      publishedTheme = main;
    } catch (err) {
      Sentry.captureException(err, { tags: { shopDomain, action: "inject-snippet/list-themes" } });
      logger.error("[InjectSnippet] Failed to fetch themes", err instanceof Error ? err : undefined, { shopDomain });
      return NextResponse.json({ error: "Failed to fetch Shopify themes" }, { status: 502 });
    }

    const themeId = publishedTheme.id;

    // Write the runtime snippet
    const snippetValue = buildSnippet(shopDomain);
    try {
      await restFetch<ShopifyAssetResponse>(`/themes/${themeId}/assets.json`, {
        method: "PUT",
        body: { asset: { key: SNIPPET_KEY, value: snippetValue } },
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { shopDomain, action: "inject-snippet/write-snippet" } });
      logger.error("[InjectSnippet] Failed to write snippet", err instanceof Error ? err : undefined, {
        shopDomain,
        themeId,
        snippetKey: SNIPPET_KEY,
      });
      return NextResponse.json({ error: "Failed to write snippet to theme" }, { status: 502 });
    }

    let themeLiquidPatched = false;
    let alreadyPresent = false;

    if (patchThemeLiquid) {
      try {
        // Read the current theme.liquid
        const { asset } = await restFetch<ShopifyAssetResponse>(
          `/themes/${themeId}/assets.json?asset[key]=${THEME_LIQUID_KEY}`
        );
        const current = asset.value ?? "";

        if (current.includes(RENDER_TAG)) {
          alreadyPresent = true;
        } else {
          // Inject before the closing </body> tag
          const patched = current.replace("</body>", `  ${RENDER_TAG}\n</body>`);
          if (patched === current) {
            // No </body> found — append at end
            await restFetch<ShopifyAssetResponse>(`/themes/${themeId}/assets.json`, {
              method: "PUT",
              body: { asset: { key: THEME_LIQUID_KEY, value: `${current}\n${RENDER_TAG}` } },
            });
          } else {
            await restFetch<ShopifyAssetResponse>(`/themes/${themeId}/assets.json`, {
              method: "PUT",
              body: { asset: { key: THEME_LIQUID_KEY, value: patched } },
            });
          }
          themeLiquidPatched = true;
        }
      } catch (err) {
        // theme.liquid patch failure is non-fatal — snippet is already written
        Sentry.captureException(err, { tags: { shopDomain, action: "inject-snippet/patch-theme-liquid" } });
        logger.warn("[InjectSnippet] Failed to patch theme.liquid — snippet written but not rendered automatically", {
          shopDomain,
          themeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("[InjectSnippet] Snippet injected", {
      shopDomain,
      themeId,
      themeName: publishedTheme.name,
      snippetKey: SNIPPET_KEY,
      themeLiquidPatched,
      alreadyPresent,
    });

    return NextResponse.json({
      ok: true,
      themeId,
      themeName: publishedTheme.name,
      snippetKey: SNIPPET_KEY,
      themeLiquidPatched,
      alreadyPresent,
      message: alreadyPresent
        ? "Snippet already present in theme.liquid — no changes made to theme.liquid."
        : themeLiquidPatched
          ? "Snippet written and theme.liquid patched. The MarginLab runtime will load on every storefront page."
          : "Snippet written. Add {% render 'marginlab-runtime' %} to your theme.liquid before </body> to activate.",
    });
  });
}
