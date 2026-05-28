import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withShopAuth } from "@/lib/api-middleware";
import { z } from "zod";

const BodySchema = z.object({
  variants: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(200),
    allocationPercent: z.number().min(0).max(100),
  })).min(2),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const total = parsed.data.variants.reduce((s, v) => s + v.allocationPercent, 0);
    if (Math.abs(total - 100) > 0.1) {
      return NextResponse.json(
        { error: `Variant allocations must sum to 100 (got ${total.toFixed(1)})` },
        { status: 422 }
      );
    }

    const experiment = await prisma.experiment.findFirst({
      where: { id, shopId },
      select: { id: true },
    });
    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    await Promise.all(
      parsed.data.variants.map((v) =>
        prisma.experimentVariant.update({
          where: { id: v.id },
          data: { name: v.name, allocationPercent: v.allocationPercent },
        })
      )
    );

    return NextResponse.json({ ok: true });
  });
}
