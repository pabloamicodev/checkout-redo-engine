/**
 * GET    /api/personalizations/abandoned-cart/[id]  — fetch one
 * PATCH  /api/personalizations/abandoned-cart/[id]  — update
 * DELETE /api/personalizations/abandoned-cart/[id]  — delete (DRAFT only)
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { AbandonedCartService, AbandonedCartUpdateInput } from "@/services/abandoned-cart.service";

const svc = new AbandonedCartService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withShopAuth(request, async (shopId) => {
    try {
      const p = await svc.get(shopId, id);
      const analytics = await svc.getAnalytics(shopId, id);
      return NextResponse.json({ ...p, analytics });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Not found";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withShopAuth(request, async (shopId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const updated = await svc.update(shopId, id, body as AbandonedCartUpdateInput);
      return NextResponse.json(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      const status = msg.includes("not found") ? 404 : 422;
      return NextResponse.json({ error: msg }, { status });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withShopAuth(request, async (shopId) => {
    try {
      await svc.delete(shopId, id);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      const status = msg.includes("not found") ? 404 : 422;
      return NextResponse.json({ error: msg }, { status });
    }
  });
}


