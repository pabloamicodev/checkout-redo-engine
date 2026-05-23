/**
 * GET  /api/personalizations/abandoned-cart  — list
 * POST /api/personalizations/abandoned-cart  — create
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { AbandonedCartService, AbandonedCartInput } from "@/services/abandoned-cart.service";

type PersonalizationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "SCHEDULED" | "ARCHIVED";

const svc = new AbandonedCartService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PersonalizationStatus | null;
    const page = parseInt(searchParams.get("page") ?? "1", 10);

    const result = await svc.list(shopId, {
      status: status ?? undefined,
      page,
    });

    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Basic shape validation
    const input = body as Record<string, unknown>;

    if (!input.name || typeof input.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }
    if (!input.message || typeof input.message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 422 });
    }

    try {
      const personalization = await svc.create(shopId, input as unknown as AbandonedCartInput);
      return NextResponse.json(personalization, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  });
}


