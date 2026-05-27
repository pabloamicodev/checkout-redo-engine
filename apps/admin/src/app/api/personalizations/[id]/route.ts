import { NextRequest, NextResponse } from "next/server";
import { OfferPersonalizationService } from "@/services/offer-personalization.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";

const service = new OfferPersonalizationService();


const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  offerIds: z.array(z.string()).min(1).optional(),
  targetingRules: z.array(z.record(z.unknown())).optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const p = await service.get(shopId, id);
      return NextResponse.json(p);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    try {
      const p = await service.update(shopId, id, parsed.data);
      return NextResponse.json(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      await service.delete(shopId, id);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
    }
  });
}

