/**
 * POST /api/test/seed
 *
 * Crea (o devuelve) un shop record en la DB para tests E2E.
 * Protegido por TEST_AUTH_TOKEN — solo funciona si esa var está definida.
 *
 * Body: { shopDomain: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const testToken = process.env.TEST_AUTH_TOKEN;
  if (!testToken) {
    return NextResponse.json(
      { error: "TEST_AUTH_TOKEN not configured" },
      { status: 403 }
    );
  }

  const incomingToken = request.headers.get("x-test-auth");
  if (incomingToken !== testToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { shopDomain?: string };
  try {
    body = await request.json() as { shopDomain?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { shopDomain } = body;
  if (!shopDomain?.endsWith(".myshopify.com")) {
    return NextResponse.json(
      { error: "shopDomain must end in .myshopify.com" },
      { status: 400 }
    );
  }

  // Upsert shop
  const shop = await prisma.shop.upsert({
    where: { shopDomain },
    update: {},
    create: {
      shopDomain,
      accessToken: "test_token",
      installedAt: new Date(),
      currencyCode: "USD",
      timezone: "America/New_York",
      settings: {},
    },
    select: { id: true, shopDomain: true, installedAt: true },
  });

  return NextResponse.json({ shop }, { status: 200 });
}
