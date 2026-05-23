import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";
import { CogsService } from "@/services/cogs.service";

const service = new CogsService();

const UpdateSchema = z.object({
  cost: z.number().positive("cost must be positive"),
  sku: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
});

// PUT /api/settings/cogs/:id — update cost by DB record id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Resolve the variant GID from the DB record before delegating to service
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.productCost.findFirst({
      where: { id, shopId },
      select: { shopifyVariantId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Cost record not found" }, { status: 404 });
    }

    const record = await service.update(shopId, existing.shopifyVariantId, parsed.data.cost, {
      sku: parsed.data.sku,
      currencyCode: parsed.data.currencyCode,
    });

    return NextResponse.json({ record });
  });
}

// DELETE /api/settings/cogs/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    await service.delete(shopId, id);
    return NextResponse.json({ deleted: true });
  });
}
