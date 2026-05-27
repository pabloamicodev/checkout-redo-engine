import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";

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
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const skip = (Math.max(1, page) - 1) * limit;

    const where = {
      shopId,
      type: "POST_PURCHASE" as never,
      ...(status ? { status: status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.personalization.findMany({
        where,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.personalization.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
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

    const { name, offerIds, targetingRules, priority, startsAt, endsAt } = parsed.data;

    // Validate offers belong to this shop
    if (offerIds.length > 0) {
      const found = await prisma.offer.count({ where: { id: { in: offerIds }, shopId } });
      if (found !== offerIds.length) {
        return NextResponse.json(
          { error: "One or more offer IDs are invalid or don't belong to this shop" },
          { status: 400 }
        );
      }
    }

    const status =
      startsAt && new Date(startsAt) > new Date() ? "SCHEDULED" : "DRAFT";

    try {
      const personalization = await prisma.personalization.create({
        data: {
          shopId,
          name,
          type: "POST_PURCHASE" as never,
          status: status as never,
          offerIds,
          targetingRules: (targetingRules ?? []) as never,
          modifications: [],
          priority,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });
      return NextResponse.json(personalization, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create personalization" },
        { status: 400 }
      );
    }
  });
}

