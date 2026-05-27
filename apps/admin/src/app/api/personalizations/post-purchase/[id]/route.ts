import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";

const DEMO_SHOP = process.env.DEMO_SHOP_DOMAIN ?? "demo.myshopify.com";


const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  offerIds: z.array(z.string()).min(1).optional(),
  targetingRules: z.array(z.record(z.unknown())).optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;

    const existing = await prisma.personalization.findFirst({
      where: { id, shopId, type: "POST_PURCHASE" as never },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    const { name, offerIds, targetingRules, priority, startsAt, endsAt } = parsed.data;

    if (offerIds && offerIds.length > 0) {
      const found = await prisma.offer.count({ where: { id: { in: offerIds }, shopId } });
      if (found !== offerIds.length) {
        return NextResponse.json(
          { error: "One or more offer IDs are invalid or don't belong to this shop" },
          { status: 400 }
        );
      }
    }

    try {
      const updated = await prisma.personalization.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(offerIds !== undefined ? { offerIds } : {}),
          ...(targetingRules !== undefined ? { targetingRules: targetingRules as never } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
          ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
        },
      });
      return NextResponse.json(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;

    const existing = await prisma.personalization.findFirst({
      where: { id, shopId, type: "POST_PURCHASE" as never },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Cannot delete an ACTIVE personalization — pause it first" },
        { status: 400 }
      );
    }

    try {
      await prisma.personalization.delete({ where: { id } });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  });
}

