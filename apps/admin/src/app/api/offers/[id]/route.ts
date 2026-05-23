import { NextRequest, NextResponse } from "next/server";
import { OfferService } from "@/services/offer.service";
import { CreateOfferSchema } from "@/lib/zod-schemas";
import { prisma } from "@/lib/prisma";
import { getShopId } from "@/lib/api-shop";

const offerService = new OfferService();
const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    const offer = await offerService.get(shopId, id);
    return NextResponse.json(offer);
  } catch {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateOfferSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const offer = await offerService.update(shopId, id, parsed.data);
    return NextResponse.json(offer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update offer";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    await offerService.delete(shopId, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete offer";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}


