/**
 * Multi-app Shopify credentials resolver.
 *
 * Supports multiple Shopify apps deployed from the same codebase (e.g. one app
 * per Shopify organization). The primary app uses the standard env vars:
 *   SHOPIFY_API_KEY / SHOPIFY_API_SECRET
 *
 * Additional apps are configured with numbered suffixes:
 *   SHOPIFY_API_KEY_2        — API key for secondary app
 *   SHOPIFY_API_SECRET_2     — API secret for secondary app
 *   SHOPIFY_APP_SHOPS_2      — comma-separated shop domains using this app
 *                              e.g. "onesolsupps.myshopify.com,othershop.myshopify.com"
 *   SHOPIFY_APP_SCOPES_2     — (optional) scopes override for this app
 *
 * Add more apps with _3, _4, etc. as needed.
 */

export interface ShopifyAppCredentials {
  apiKey: string;
  apiSecret: string;
  scopes: string;
}

/**
 * Returns the Shopify credentials for a given shop domain.
 * Falls back to the primary app if no secondary app is configured for the shop.
 */
export function getShopifyCredentials(shop?: string): ShopifyAppCredentials {
  const primaryKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";
  const primarySecret = process.env.SHOPIFY_API_SECRET?.trim() ?? "";
  const primaryScopes = process.env.SHOPIFY_APP_SCOPES?.trim() ?? "";

  if (shop) {
    const normalizedShop = shop.toLowerCase().trim();
    let i = 2;
    while (process.env[`SHOPIFY_API_KEY_${i}`]) {
      const shops = (process.env[`SHOPIFY_APP_SHOPS_${i}`] ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (shops.includes(normalizedShop)) {
        return {
          apiKey: process.env[`SHOPIFY_API_KEY_${i}`]!.trim(),
          apiSecret: process.env[`SHOPIFY_API_SECRET_${i}`]!.trim(),
          scopes: process.env[`SHOPIFY_APP_SCOPES_${i}`]?.trim() ?? primaryScopes,
        };
      }
      i++;
    }
  }

  return { apiKey: primaryKey, apiSecret: primarySecret, scopes: primaryScopes };
}

/**
 * Returns all configured app credentials.
 * Used by JWT validation (we don't know which app issued the token until we check `aud`).
 */
export function getAllShopifyCredentials(): ShopifyAppCredentials[] {
  const primaryScopes = process.env.SHOPIFY_APP_SCOPES?.trim() ?? "";
  const result: ShopifyAppCredentials[] = [
    {
      apiKey: process.env.SHOPIFY_API_KEY?.trim() ?? "",
      apiSecret: process.env.SHOPIFY_API_SECRET?.trim() ?? "",
      scopes: primaryScopes,
    },
  ];

  let i = 2;
  while (process.env[`SHOPIFY_API_KEY_${i}`]) {
    result.push({
      apiKey: process.env[`SHOPIFY_API_KEY_${i}`]!.trim(),
      apiSecret: process.env[`SHOPIFY_API_SECRET_${i}`]!.trim(),
      scopes: process.env[`SHOPIFY_APP_SCOPES_${i}`]?.trim() ?? primaryScopes,
    });
    i++;
  }

  return result;
}
