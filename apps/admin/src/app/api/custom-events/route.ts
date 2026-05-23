import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";
import { CustomEventService } from "@/services/custom-event.service";

const svc = new CustomEventService();

const CreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "name must be lowercase alphanumeric with underscores only"),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schema: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const result = await svc.list(shopId);
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const event = await svc.create(shopId, parsed.data);
      return NextResponse.json({ event }, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create custom event";
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  });
}
