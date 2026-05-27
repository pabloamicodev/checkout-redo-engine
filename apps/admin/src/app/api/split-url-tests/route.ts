import { NextRequest, NextResponse } from "next/server";
import { SplitUrlTestService } from "@/services/split-url-test.service";
import { withShopAuth } from "@/lib/api-middleware";
import { z } from "zod";

const service = new SplitUrlTestService();

const VariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with dashes/underscores"),
  name: z.string().min(1).max(200),
  isControl: z.boolean(),
  allocationPercent: z.number().min(0).max(100),
  redirectUrl: z.string().nullable(),
});

const SplitUrlConfigSchema = z.object({
  baseUrl: z.string().min(1),
  preserveQueryParams: z.boolean().optional(),
  preserveUtm: z.boolean().optional(),
});

const TargetingSchema = z.record(z.unknown()).optional();

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  trafficAllocation: z.number().min(1).max(100).default(100),
  // Accept both flat baseUrl (legacy) and nested splitUrlConfig (wizard)
  baseUrl: z.string().optional(),
  splitUrlConfig: SplitUrlConfigSchema.optional(),
  targeting: TargetingSchema,
  variants: z.array(VariantSchema).min(2),
}).transform((data) => ({
  ...data,
  baseUrl: data.splitUrlConfig?.baseUrl ?? data.baseUrl ?? "",
}));

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);

    const result = await service.list(shopId, { status, page });
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
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    try {
      const experiment = await service.create(shopId, parsed.data);
      return NextResponse.json(experiment, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create split URL test" },
        { status: 400 }
      );
    }
  });
}
