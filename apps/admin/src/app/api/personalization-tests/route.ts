import { NextRequest, NextResponse } from "next/server";
import { PersonalizationTestService } from "@/services/personalization-test.service";
import { getShopId } from "@/lib/api-shop";
import { z } from "zod";

const service = new PersonalizationTestService();

const ActionSchema = z.object({
  type: z.string().min(1),
  selector: z.string().optional(),
  content: z.string().optional(),
  offerId: z.string().optional(),
});

const VariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(200),
  isControl: z.boolean(),
  allocationPercent: z.number().min(0).max(100),
  actions: z.array(ActionSchema).default([]),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  hypothesis: z.string().optional(),
  targetingRules: z.array(z.record(z.unknown())).default([]),
  ruleOperator: z.enum(["AND", "OR"]).default("AND"),
  trafficAllocation: z.number().min(1).max(100).default(100),
  variants: z.array(VariantSchema).min(1),
});

export async function GET(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const result = await service.list(shopId, {
    status: searchParams.get("status") ?? undefined,
    page: parseInt(searchParams.get("page") ?? "1", 10),
    limit: parseInt(searchParams.get("limit") ?? "50", 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const exp = await service.create(shopId, parsed.data);
    return NextResponse.json(exp, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

