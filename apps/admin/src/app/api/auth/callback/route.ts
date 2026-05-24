/**
 * Shopify OAuth — Callback
 *
 * Shopify redirects here after the merchant authorizes the app.
 * GET /api/auth/callback?code=xxx&shop=xxx&hmac=xxx&state=xxx&timestamp=xxx
 *
 * Steps:
 *  1. Validate state cookie (CSRF guard)
 *  2. Validate HMAC signature (authenticity guard)
 *  3. Exchange code for access token
 *  4. Encrypt and persist the token
 *  5. Create/update Shop record
 *  6. Register required webhooks
 *  7. Ensure billing plan record exists (free tier)
 *  8. Redirect to the app dashboard
 *
 * GUARD: State mismatch → 403 (CSRF attempt)
 * GUARD: HMAC invalid → 403 (tampered request)
 * GUARD: Shopify token exchange failure → 500
 * GUARD: Token and shop record writes are idempotent (upsert)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { BillingService } from "@/services/billing.service";

const SHOPIFY_SHOP_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
const billingService = new BillingService();

const REQUIRED_WEBHOOKS = [
  { topic: "orders/create", path: "/api/webhooks/shopify" },
  { topic: "orders/updated", path: "/api/webhooks/shopify" },
  { topic: "refunds/create", path: "/api/webhooks/shopify" },
  { topic: "app/uninstalled", path: "/api/webhooks/shopify" },
  { topic: "app_subscriptions/update", path: "/api/webhooks/shopify" },
  { topic: "customers/data_request", path: "/api/webhooks/shopify" },
  { topic: "customers/redact", path: "/api/webhooks/shopify" },
  { topic: "shop/redact", path: "/api/webhooks/shopify" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop")?.toLowerCase().trim();
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  // GUARD: all required params
  if (!code || !shop || !state || !hmac) {
    return NextResponse.json({ error: "Missing required OAuth parameters" }, { status: 400 });
  }

  // GUARD: valid shop domain
  if (!SHOPIFY_SHOP_REGEX.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  // GUARD: CSRF — state must match cookie
  const storedState = request.cookies.get("shopify_oauth_state")?.value;
  if (!storedState || state !== storedState) {
    return NextResponse.json({ error: "State mismatch — possible CSRF" }, { status: 403 });
  }

  // GUARD: HMAC validation
  const apiSecret = process.env.SHOPIFY_API_SECRET?.replace(/[\r\n\s]+/g, "");
  if (!apiSecret) {
    return NextResponse.json({ error: "App not configured" }, { status: 500 });
  }

  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "hmac") params[key] = value;
  });

  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  const digestBuf = Buffer.from(digest);
  const hmacBuf = Buffer.from(hmac);

  if (
    digestBuf.length !== hmacBuf.length ||
    !timingSafeEqual(digestBuf, hmacBuf)
  ) {
    return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 403 });
  }

  // Exchange code for permanent access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY?.trim().replace(/[\r\n]+$/, ""),
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[OAuth] Token exchange failed:", err);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }

  const { access_token, scope } = (await tokenRes.json()) as {
    access_token: string;
    scope: string;
  };

  if (!access_token) {
    return NextResponse.json({ error: "No access token returned" }, { status: 500 });
  }

  // Encrypt token before storing
  const accessTokenEncrypted = encrypt(access_token);

  // Fetch shop info from Shopify
  const shopInfoRes = await fetch(
    `https://${shop}/admin/api/2025-04/shop.json`,
    { headers: { "X-Shopify-Access-Token": access_token } }
  );
  const shopInfo = shopInfoRes.ok
    ? ((await shopInfoRes.json()) as { shop: { currency: string; iana_timezone: string } }).shop
    : null;

  // Upsert Shop record
  const shopRecord = await prisma.shop.upsert({
    where: { shopDomain: shop },
    create: {
      shopDomain: shop,
      accessTokenEncrypted,
      scopes: scope.split(","),
      currencyCode: shopInfo?.currency ?? "USD",
      timezone: shopInfo?.iana_timezone ?? "UTC",
      uninstalledAt: null,
    },
    update: {
      accessTokenEncrypted,
      scopes: scope.split(","),
      uninstalledAt: null,
      ...(shopInfo ? { currencyCode: shopInfo.currency, timezone: shopInfo.iana_timezone } : {}),
    },
  });

  // Ensure free plan record exists
  await billingService.ensurePlanRecord(shopRecord.id);

  // Register webhooks (best-effort, non-blocking)
  registerWebhooks(shop, access_token).catch((err) =>
    console.error("[OAuth] Webhook registration failed:", err)
  );

  // Redirect back into Shopify admin embedded context, clearing the state cookie.
  // We must redirect to admin.shopify.com (not our app host directly) so Shopify
  // re-embeds the app in the iframe with a valid session.
  // The `host` query param Shopify sends is base64(shop-admin-URL) — use it if present,
  // otherwise fall back to the canonical admin URL.
  const hostParam = new URL(request.url).searchParams.get("host");
  let redirectTarget: string;
  if (hostParam) {
    try {
      const decoded = Buffer.from(hostParam, "base64").toString("utf8");
      // decoded is like "admin.shopify.com/store/hpn-supplements"
      redirectTarget = `https://${decoded}/apps/checkout-redo-engine`;
    } catch {
      redirectTarget = `https://${shop}/admin/apps/checkout-redo-engine`;
    }
  } else {
    redirectTarget = `https://${shop}/admin/apps/checkout-redo-engine`;
  }

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.delete("shopify_oauth_state");
  // Set session shop cookie so server components can resolve the shop
  response.cookies.set("shopify_session_shop", shop, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}

async function registerWebhooks(shop: string, accessToken: string): Promise<void> {
  const host = process.env.HOST!;

  for (const wh of REQUIRED_WEBHOOKS) {
    try {
      await fetch(`https://${shop}/admin/api/2025-04/webhooks.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic: wh.topic,
            address: `${host}${wh.path}`,
            format: "json",
          },
        }),
      });
    } catch (err) {
      console.error(`[OAuth] Failed to register webhook ${wh.topic}:`, err);
    }
  }
}
