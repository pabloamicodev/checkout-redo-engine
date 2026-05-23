import { NextRequest, NextResponse } from "next/server";
import { OfferTestService } from "@/services/offer-test.service";
import { getShopId } from "@/lib/api-shop";
import { z } from "zod";

const service = new OfferTestService();

const OfferModificationSchema = z.object({
  offerType: z.enum(["BANNER", "POPUP", "CART_DRAWER", "PRODUCT_PAGE"]),
  headline: z.string().min(1, "Headline is required"),
  body: z.string().optional(),
  ctaText: z.string().optional(),
  triggerDelay: z.number().min(0).optional(),
});

const VariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with dashes/underscores"),
  name: z.string().min(1).max(200),
  isControl: z.boolean(),
  allocationPercent: z.number().min(0).max(100),
  modification: OfferModificationSchema.optional().nullable(),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  trafficAllocation: z.number().min(1).max(100).default(100),
  primaryMetric: z.string().optional(),
  variants: z.array(VariantSchema).min(2),
});

export async function GET(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const result = await service.list(shopId, { status, page, limit });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const experiment = await service.create(shopId, {
      ...parsed.data,
      variants: parsed.data.variants.map((v) => ({
        ...v,
        modification: v.modification ?? undefined,
      })),
    });
    return NextResponse.json(experiment, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create offer test" },
      { status: 400 }
    );
  }
}

