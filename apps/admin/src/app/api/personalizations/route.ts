import { NextRequest, NextResponse } from "next/server";
import { OfferPersonalizationService } from "@/services/offer-personalization.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getShopId } from "@/lib/api-shop";

const service = new OfferPersonalizationService();
const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";


const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  offerIds: z.array(z.string()).min(1, "At least one offer is required"),
  targetingRules: z.array(z.record(z.unknown())).default([]),
  priority: z.number().int().min(0).max(9999).default(100),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const result = await service.list(shopId, { status, page, limit });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const personalization = await service.create(shopId, parsed.data);
    return NextResponse.json(personalization, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create personalization" },
      { status: 400 }
    );
  }
}


