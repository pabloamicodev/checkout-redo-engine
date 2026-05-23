import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion, Session } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY ?? "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "",
  scopes: (process.env.SHOPIFY_APP_SCOPES ?? "").split(","),
  hostName: (process.env.HOST ?? "localhost").replace(/^https?:\/\//, ""),
  apiVersion: ApiVersion.April25,
  isEmbeddedApp: true,
});

function createSessionStorage() {
  try {
    return new PrismaSessionStorage(prisma);
  } catch {
    return null;
  }
}

export const sessionStorage = createSessionStorage();

export async function getShopifyAdminClient(shopDomain: string) {
  if (!sessionStorage) {
    throw new Error(`Session storage unavailable — run prisma generate then restart the server.`);
  }
  const sessions = await sessionStorage.findSessionsByShop(shopDomain);
  const session = sessions[0];
  if (!session) throw new Error(`No Shopify session for shop: ${shopDomain}. Connect the app via OAuth first.`);

  const client = new shopify.clients.Graphql({ session });
  return client;
}

export async function validateHmac(
  query: Record<string, string | string[]>
): Promise<boolean> {
  try {
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) return false;

    const { hmac: queryHmac, ...rest } = query as Record<string, string>;
    if (!queryHmac) return false;

    const sorted = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${Array.isArray(rest[k]) ? (rest[k] as string[]).join(",") : String(rest[k])}`)
      .join("&");

    const digest = createHmac("sha256", secret).update(sorted).digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(queryHmac);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function validateWebhook(
  rawBody: string,
  hmacHeader: string
): Promise<boolean> {
  try {
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) return false;

    const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type { Session };
