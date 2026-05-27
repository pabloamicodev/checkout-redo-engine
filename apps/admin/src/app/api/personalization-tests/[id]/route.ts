import { NextRequest, NextResponse } from "next/server";
import { PersonalizationTestService } from "@/services/personalization-test.service";
import { withShopAuth } from "@/lib/api-middleware";
import { z } from "zod";

const service = new PersonalizationTestService();

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hypothesis: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const exp = await service.get(shopId, id);
      return NextResponse.json(exp);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    try {
      const exp = await service.update(shopId, id, parsed.data);
      return NextResponse.json(exp);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      await service.archive(shopId, id);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
    }
  });
}
