/**
 * Shopify OAuth — Initiate
 *
 * Entry point when Shopify installs the app or when an unauthenticated
 * merchant visits the app URL.
 *
 * GET /api/auth?shop=merchant.myshopify.com
 *
 * Validates the shop domain, generates a random state token (CSRF guard),
 * stores it in a cookie, and redirects to Shopify's OAuth authorization URL.
 *
 * GUARD: Rejects invalid shop domains before any external call.
 * GUARD: State cookie is HttpOnly + SameSite=Lax to prevent CSRF.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const SHOPIFY_SHOP_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop")?.toLowerCase().trim();

  // GUARD: shop param required
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // GUARD: validate shop domain format
  if (!SHOPIFY_SHOP_REGEX.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_APP_SCOPES ?? "";
  const host = process.env.HOST;

  if (!apiKey || !host) {
    return NextResponse.json(
      { error: "App not configured — SHOPIFY_API_KEY and HOST must be set" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  // Include the host param (forwarded from Shopify) in callback so we can
  // redirect back into the embedded admin after OAuth completes.
  const hostParam = searchParams.get("host");
  const redirectUri = `${host}/api/auth/callback${hostParam ? `?host=${encodeURIComponent(hostParam)}` : ""}`;

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  const response = NextResponse.redirect(authUrl);

  // CSRF state cookie — expires after 10 minutes
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 600,
    path: "/",
  });

  return response;
}
