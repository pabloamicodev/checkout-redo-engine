/**
 * Shared API middleware for MarginLab admin routes.
 *
 * withShopAuth validates the Shopify session from the Authorization header
 * (App Bridge JWT) and resolves shopId from the shop domain.
 *
 * In development (without proper App Bridge flow), it also accepts a
 * X-Shop-Domain header for local testing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { BillingService } from "@/services/billing.service";
import { LimitType } from "@/lib/plans";
import { checkRateLimit, applyRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAllShopifyCredentials } from "@/lib/shopify-apps";

const billingService = new BillingService();

type ApiHandler = (
  shopId: string,
  actorId?: string
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// Shopify App Bridge JWT validation
// ---------------------------------------------------------------------------

interface ShopifyJwtPayload {
  iss: string;   // "https://{shop}/admin"
  dest: string;  // "https://{shop}"
  aud: string;   // Shopify API key
  sub: string;   // User ID (may be "0" for surface-level tokens)
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
}

/**
 * Validates a Shopify App Bridge JWT (HS256) and returns the payload.
 *
 * Tries all configured Shopify apps (primary + secondary) because the JWT's
 * `aud` field identifies which app issued it, and each app has its own secret.
 *
 * Algorithm: HMAC-SHA256 with the API secret as the key.
 * Reference: https://shopify.dev/docs/apps/auth/session-tokens/getting-started
 *
 * Returns null if the token is invalid, expired, or not issued for any known app.
 */
function verifyShopifyJwt(token: string): ShopifyJwtPayload | null {
  const allApps = getAllShopifyCredentials();

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  // Decode payload first to get `aud` — then find the matching app
  let payload: ShopifyJwtPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as ShopifyJwtPayload;
  } catch {
    return null;
  }

  // Find the app whose apiKey matches the JWT's `aud` field
  const matchingApp = allApps.find((app) => app.apiKey && app.apiKey === payload.aud);
  if (!matchingApp) return null;

  // Verify signature using that app's secret
  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", matchingApp.apiSecret)
    .update(signingInput)
    .digest("base64url");

  try {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureB64);
    if (expectedBuf.length !== actualBuf.length) return null;
    if (!timingSafeEqual(expectedBuf, actualBuf)) return null;
  } catch {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // Token must not be expired (allow 30s clock skew)
  if (payload.exp < nowSeconds - 30) return null;

  // Token must not be used before it becomes valid (allow 30s clock skew)
  if (payload.nbf > nowSeconds + 30) return null;

  // dest must be a valid myshopify.com domain
  if (!payload.dest?.includes(".myshopify.com")) return null;

  return payload;
}

/**
 * Extracts the shop domain from a verified Shopify JWT payload.
 * `dest` is "https://store.myshopify.com" — strip the protocol.
 */
function shopDomainFromJwt(payload: ShopifyJwtPayload): string {
  return payload.dest.replace(/^https?:\/\//, "");
}

// ---------------------------------------------------------------------------
// Shop resolution
// ---------------------------------------------------------------------------

export async function getShopFromRequest(request: NextRequest): Promise<{ shopId: string; shopDomain: string; actorId?: string } | null> {
  let shopDomain: string | null = null;
  let actorId: string | undefined;

  // 1. Try App Bridge JWT from Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyShopifyJwt(token);
    if (payload) {
      shopDomain = shopDomainFromJwt(payload);
      actorId = payload.sub !== "0" ? payload.sub : undefined;
    }
    // If JWT present but invalid, fall through to cookie/header fallbacks
  }

  // 2. Fallback: shopify_session_shop cookie (set by OAuth callback, httpOnly + Secure)
  // This is the same source used by server components via getSessionShop().
  // Safe to use in production: the cookie is httpOnly (XSS-proof), set only after
  // successful OAuth, and the shop domain is validated against the DB below.
  if (!shopDomain) {
    const sessionCookie = request.cookies.get("shopify_session_shop")?.value;
    if (sessionCookie && sessionCookie.endsWith(".myshopify.com")) {
      shopDomain = sessionCookie;
    }
  }

  // 3. Fallback: explicit X-Shop-Domain header / query param (dev only)
  if (!shopDomain && process.env.NODE_ENV !== "production") {
    shopDomain =
      request.headers.get("x-shop-domain") ??
      new URL(request.url).searchParams.get("shop") ??
      process.env.DEMO_SHOP_DOMAIN ??
      null;
  }

  if (!shopDomain) return null;

  const shop = await prisma.shop.findUnique({
    where: { shopDomain, uninstalledAt: null },
    select: { id: true, shopDomain: true },
  });

  if (!shop) return null;

  return { shopId: shop.id, shopDomain: shop.shopDomain, actorId };
}

export async function withShopAuth(
  request: NextRequest,
  handler: ApiHandler
): Promise<NextResponse> {
  try {
    // Body size guard for admin POST/PUT/PATCH routes (512 KB)
    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      const cl = Number(request.headers.get("content-length") ?? "0");
      if (cl > 512 * 1024) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
    }

    const shop = await getShopFromRequest(request);

    if (!shop) {
      return NextResponse.json(
        { error: "Unauthorized: shop not found" },
        { status: 401 }
      );
    }

    // Admin API rate limit — 300 req/min per shop
    const rl = await checkRateLimit(`admin:${shop.shopId}`, RATE_LIMITS.admin_api);
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      res.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      return res;
    }

    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const { requestStorage } = await import("@/lib/request-context");
    return await requestStorage.run(
      { requestId, shopId: shop.shopId, shopDomain: shop.shopDomain },
      () => handler(shop.shopId, shop.actorId)
    );
  } catch (error) {
    if (error instanceof Error) {
      // Domain validation errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.includes("Cannot update") ||
        error.message.includes("must sum") ||
        error.message.includes("Exactly one")
      ) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
    }

    Sentry.captureException(error);
    logger.error("[API Error]", error instanceof Error ? error : undefined, {
      path: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Plan limit guard — call before creating experiments, offers, checkout blocks, or integrations.
 *
 * Returns a 402 Payment Required response if the shop has exceeded its plan limits,
 * with the upgradeRequired plan key in the body.
 *
 * GUARD: Fails open (allows request) if billing service throws unexpectedly.
 */
export async function withPlanGuard(
  shopId: string,
  limitType: LimitType,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const check = await billingService.checkLimit(shopId, limitType);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: `Plan limit reached for ${limitType}. Upgrade to continue.`,
          limitType,
          current: check.current,
          max: check.max,
          upgradeRequired: check.upgradeRequired,
          planKey: check.planKey,
        },
        { status: 402 }
      );
    }
  } catch {
    // Fail open — don't block legitimate requests due to billing errors
  }
  return handler();
}

/**
 * Billing active guard — call before any action that requires an active subscription.
 *
 * A FROZEN, EXPIRED, or DECLINED plan blocks new creates but does NOT delete data.
 * A CANCELLED plan is downgraded to free — still allows free-tier operations.
 *
 * Returns 402 if plan is suspended. Fails open on billing service errors.
 */
export async function withBillingActive(
  shopId: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const { plan: _plan, isActive } = await billingService.getShopPlan(shopId);
    if (!isActive) {
      return NextResponse.json(
        {
          error: "Your subscription is inactive. Please update your billing in Settings → Billing.",
          billingRequired: true,
        },
        { status: 402 }
      );
    }
  } catch {
    // Fail open
  }
  return handler();
}

/**
 * Admin API rate limiting — sliding window per shop.
 * Fails open if Redis is unavailable.
 */
export async function withAdminRateLimit(
  shopId: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const result = await checkRateLimit(`admin:${shopId}`, RATE_LIMITS.admin_api);
  if (!result.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
    return response;
  }
  return handler();
}

export async function withRuntimeAuth(
  request: NextRequest,
  handler: (shopDomain: string, shopId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Bot filter — crawlers and scrapers should not receive runtime experiment data.
    // Return a benign 200 so bots do not retry aggressively.
    const ua = request.headers.get("user-agent") ?? "";
    const BOT_UA_RE =
      /Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver|wget|libwww-perl|python-requests|Go-http-client/i;
    if (BOT_UA_RE.test(ua)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Payload size guard for POST/PUT/PATCH — reject bodies larger than 64 KB
    // to prevent memory exhaustion and oversized event attacks.
    const MAX_BODY_BYTES = 64 * 1024;
    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      const cl = Number(request.headers.get("content-length") ?? "0");
      if (cl > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
    }

    const shopDomain =
      request.headers.get("x-shop-domain") ??
      new URL(request.url).searchParams.get("shop") ??
      null;

    if (!shopDomain) {
      return NextResponse.json({ error: "Missing shop domain" }, { status: 400 });
    }

    // GUARD: shop must exist in our database — prevents enumeration / SSRF by unknown domains.
    // Return 401 (not 404) to avoid leaking whether a shop domain exists.
    // shopId is passed to the handler so routes don't need a second findUnique.
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await handler(shopDomain, shop.id);

    // CORS — runtime endpoints are called cross-origin from the merchant storefront
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Shop-Domain");
    // Defensive security headers on every runtime response
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[Runtime API Error]", error instanceof Error ? error : undefined, {
      path: request.nextUrl.pathname,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Runtime rate limit guard — wraps a runtime handler with a per-key sliding window check.
 *
 * Key is typically `runtime_<endpoint>:<shopDomain>` or `runtime_<endpoint>:<visitorId>`.
 * Fails open if Redis is unavailable (to keep storefront unaffected by Redis outages).
 */
export async function withRuntimeRateLimit(
  key: string,
  limitKey: keyof typeof RATE_LIMITS,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const result = await checkRateLimit(key, RATE_LIMITS[limitKey]);
  const response = result.allowed
    ? await handler()
    : NextResponse.json({ error: "Too many requests" }, { status: 429 });
  applyRateLimitHeaders(response.headers, result);
  return response;
}
