/**
 * Shopify Admin REST API helper.
 *
 * Wraps the authenticated session's access token so any service can make
 * REST calls to the Shopify Admin API without reimplementing auth.
 *
 * Usage:
 *   const rest = await getShopifyRestFetch(shopDomain);
 *   const data = await rest<{ themes: ShopifyTheme[] }>("/themes.json");
 */

import { sessionStorage } from "./shopify";

export interface ShopifyTheme {
  id: number;
  name: string;
  role: "main" | "unpublished" | "demo";
  theme_store_id: number | null;
  previewable: boolean;
  processing: boolean;
  admin_graphql_api_id: string;
  created_at: string;
  updated_at: string;
}

/** Returns a typed fetch wrapper scoped to the shop's Admin REST API. */
export async function getShopifyRestFetch(shopDomain: string) {
  if (!sessionStorage) {
    throw new Error("Session storage unavailable — run prisma generate then restart.");
  }

  const sessions = await sessionStorage.findSessionsByShop(shopDomain);
  const session = sessions[0];

  if (!session?.accessToken) {
    throw new Error(
      `No Shopify session for "${shopDomain}". Re-install the app via OAuth to refresh the session.`
    );
  }

  const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-04";
  const base = `https://${shopDomain}/admin/api/${API_VERSION}`;
  const headers = {
    "X-Shopify-Access-Token": session.accessToken,
    "Content-Type": "application/json",
  };

  return async function restFetch<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Shopify REST ${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  };
}
