import { NextRequest, NextResponse } from "next/server";
import { CheckoutTestService } from "@/services/checkout-test.service";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const service = new CheckoutTestService();

const UpdateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  hypothesis:  z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const exp = await service.get(shopId, id);
      return NextResponse.json(exp);
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
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    try {
      const exp = await service.update(shopId, id, parsed.data);
      return NextResponse.json(exp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 422 });
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
      await service.get(shopId, id);
      await prisma.experiment.delete({ where: { id } });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 422 });
    }
  });
}


