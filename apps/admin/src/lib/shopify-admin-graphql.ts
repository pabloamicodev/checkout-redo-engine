/**
 * Shopify Admin GraphQL helper.
 *
 * Uses the per-shop OAuth access token stored in session storage, exactly
 * like shopify-admin-rest.ts does for REST calls. Never uses a global
 * SHOPIFY_ADMIN_TOKEN env var — that approach breaks multi-tenant deployments.
 */

import { sessionStorage } from "./shopify";

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-04";

export async function shopifyAdminGraphQL(
  shopDomain: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (!sessionStorage) {
    throw new Error("Session storage unavailable — run prisma generate then restart.");
  }

  const sessions = await sessionStorage.findSessionsByShop(shopDomain);
  const token = sessions[0]?.accessToken;

  if (!token) {
    throw new Error(
      `No Shopify session for "${shopDomain}". Re-install the app via OAuth to refresh the session.`
    );
  }

  const res = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!res.ok) {
    throw new Error(`Shopify Admin GraphQL ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: unknown[];
  };

  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data ?? {};
}
