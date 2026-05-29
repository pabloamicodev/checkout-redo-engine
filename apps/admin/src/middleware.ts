/**
 * Next.js Middleware — Shopify Embedded App Auth Guard
 *
 * Runs on every non-API, non-static request.
 *
 * When Shopify loads the embedded app it appends:
 *   ?shop=merchant.myshopify.com&host=<base64>&embedded=1
 *
 * If the request has a valid `shopify_session_shop` cookie → allow through.
 * If not, but `shop` param is present → redirect to /api/auth?shop=xxx (OAuth).
 * If neither → serve the page as-is (demo mode / direct URL visit).
 */

import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_SHOP_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Propagate or generate a request ID for log correlation
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestWithId = new Request(request, {
    headers: new Headers({ ...Object.fromEntries(request.headers), "x-request-id": requestId }),
  });

  // Skip middleware for API routes, static files, and _next internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const sessionShop = request.cookies.get("shopify_session_shop")?.value;

  void requestWithId; // available for future use; requestId flows via x-request-id header

  // Check if Shopify provided shop/host/embedded params in the URL
  const shopParam = searchParams.get("shop")?.toLowerCase().trim();
  const isEmbedded = searchParams.get("embedded") === "1";
  const hostParam = searchParams.get("host")?.trim();

  /**
   * Multi-tenant isolation — forward the active shop via an x-shop request header.
   *
   * PROBLEM: The `shopify_session_shop` cookie is shared across all stores on the
   * same Vercel domain.  When a merchant has the app installed in 4 stores and
   * opens them all in the same browser, the LAST OAuth flow overwrites the cookie,
   * making every store render data for that last shop.
   *
   * SOLUTION: When Shopify loads the embedded app it always passes ?shop=&host=&embedded=1.
   * We inject an `x-shop` REQUEST header so that server components can read it via
   * `headers()` in the SAME request — regardless of the stale cookie value.
   * The cookie is still updated for the next request (non-embedded navigations).
   *
   * Note: `NextResponse.next({ request: { headers } })` forwards modified headers
   * to the origin — server components see them via `import { headers } from "next/headers"`.
   */
  if (shopParam && SHOPIFY_SHOP_REGEX.test(shopParam) && isEmbedded && hostParam) {
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-request-id", requestId);
    reqHeaders.set("x-shop", shopParam);

    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("x-request-id", requestId);

    // Also keep the cookie up-to-date for subsequent non-embedded navigations
    if (shopParam !== sessionShop) {
      res.cookies.set("shopify_session_shop", shopParam, {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return res;
  }

  // Already authenticated via cookie → allow through
  if (sessionShop && SHOPIFY_SHOP_REGEX.test(sessionShop)) {
    const res = NextResponse.next();
    res.headers.set("x-request-id", requestId);
    return res;
  }

  if (shopParam && SHOPIFY_SHOP_REGEX.test(shopParam)) {
    // Embedded load with valid Shopify context but no session cookie.
    // Some browsers/users block third-party cookies in iframes, which can
    // prevent `shopify_session_shop` from being sent and cause an OAuth loop.
    // In that case, allow the request and let App Bridge-authenticated API calls
    // establish authorization instead of forcing /api/auth repeatedly.
    if (isEmbedded && hostParam) {
      const res = NextResponse.next();
      res.headers.set("x-request-id", requestId);
      return res;
    }

    // Must break OUT of the Shopify iframe to do OAuth.
    // A server-side 302 redirect inside the iframe causes Shopify to redirect
    // the user to the app settings page instead.
    // Solution: serve an HTML page that sets window.top.location (top-level redirect).
    // IMPORTANT: must use ABSOLUTE URL — relative URLs resolve against admin.shopify.com
    // (the parent frame), not against our app domain.
    const appHost = (process.env.HOST ?? "https://checkout-redo-engine.vercel.app").trim().replace(/[\r\n]+$/, "");
    const authUrl = `${appHost}/api/auth?shop=${encodeURIComponent(shopParam)}`;
    const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      // Break out of Shopify iframe and navigate top-level to OAuth
      if (window.top && window.top !== window) {
        window.top.location.href = ${JSON.stringify(authUrl)};
      } else {
        window.location.href = ${JSON.stringify(authUrl)};
      }
    </script>
    <p>Redirecting to authorization&hellip;</p>
  </body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  // No shop param and no session → allow through (demo mode)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api routes
     * - _next static files
     * - _next image optimization
     * - favicon
     */
    "/((?!api|_next/static|_next/image|favicon).*)",
  ],
};
