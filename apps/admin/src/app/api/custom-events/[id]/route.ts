import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";
import { CustomEventService } from "@/services/custom-event.service";

const svc = new CustomEventService();

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  schema: z.record(z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const event = await svc.get(shopId, id);
      return NextResponse.json({ event });
    } catch {
      return NextResponse.json({ error: "Custom event not found" }, { status: 404 });
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
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const event = await svc.update(shopId, id, parsed.data);
      return NextResponse.json({ event });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
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
      await svc.delete(shopId, id);
      return NextResponse.json({ deleted: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
    }
  });
}
