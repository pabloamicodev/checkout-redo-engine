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

  // Skip middleware for API routes, static files, and _next internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const sessionShop = request.cookies.get("shopify_session_shop")?.value;

  // Already authenticated via cookie → allow through
  if (sessionShop && SHOPIFY_SHOP_REGEX.test(sessionShop)) {
    return NextResponse.next();
  }

  // No session — check if Shopify provided a shop param
  const shopParam = searchParams.get("shop")?.toLowerCase().trim();

  if (shopParam && SHOPIFY_SHOP_REGEX.test(shopParam)) {
    // Must break OUT of the Shopify iframe to do OAuth.
    // A server-side redirect inside the iframe causes Shopify to redirect
    // the user to the app settings page instead.
    // Solution: serve an HTML page that sets window.top.location (top-level redirect).
    const authUrl = `/api/auth?shop=${encodeURIComponent(shopParam)}`;
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
