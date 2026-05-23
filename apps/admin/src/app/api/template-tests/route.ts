import { NextRequest, NextResponse } from "next/server";
import { TemplateTestService } from "@/services/template-test.service";
import { getShopId } from "@/lib/api-shop";
import { z } from "zod";

const service = new TemplateTestService();

const CreateTemplateTestSchema = z.object({
  name: z.string().min(1),
  hypothesis: z.string().optional(),
  templateId: z.string().optional(),
  trafficAllocation: z.number().min(1).max(100).optional(),
  variants: z.array(z.object({
    name: z.string().min(1),
    isControl: z.boolean(),
    allocation: z.number().min(0).max(100),
    settings: z.record(z.unknown()).optional(),
  })).min(2),
  targetingRules: z.array(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = (page - 1) * limit;

  const result = await service.list(shopId, { status, limit, offset });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateTemplateTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const experiment = await service.create(shopId, parsed.data);
    return NextResponse.json(experiment, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create template test" },
      { status: 400 }
    );
  }
}

