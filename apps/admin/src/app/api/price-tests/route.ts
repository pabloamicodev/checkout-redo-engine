import { NextRequest, NextResponse } from "next/server";
import { PriceTestService } from "@/services/price-test.service";
import { withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";
import { z } from "zod";

const service = new PriceTestService();

const PriceOverrideSchema = z.object({
  shopifyVariantId: z.string().min(1),
  shopifyProductId: z.string().min(1),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal"),
  compareAtPrice: z.string().optional().nullable(),
});

const VariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(200),
  isControl: z.boolean(),
  allocationPercent: z.number().min(0).max(100),
  priceOverrides: z.array(PriceOverrideSchema).default([]),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  trafficAllocation: z.number().min(1).max(100).default(100),
  enforcementStrategy: z.enum(["DISPLAY_ONLY", "SHOPIFY_FUNCTION"]).default("DISPLAY_ONLY"),
  variants: z.array(VariantSchema).min(2),
});

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const result = await service.list(shopId, {
      status: searchParams.get("status") ?? undefined,
      page: parseInt(searchParams.get("page") ?? "1", 10),
    });
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "experiments", async () => {
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
      })
    );
  });
}

