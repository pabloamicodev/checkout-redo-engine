import { NextRequest, NextResponse } from "next/server";
import { ShippingTestService } from "@/services/shipping-test.service";
import { withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";
import { z } from "zod";

const service = new ShippingTestService();

const VariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(200),
  isControl: z.boolean(),
  allocationPercent: z.number().min(0).max(100),
  freeShippingThreshold: z.number().min(0).nullable(),
  progressBarMessage: z.string().default("Add {remaining} more for free shipping!"),
  methodOperations: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("hide"), titleContains: z.string().min(1) }),
        z.object({ type: z.literal("rename"), titleFrom: z.string().min(1), titleTo: z.string().min(1) }),
      ])
    )
    .default([]),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  trafficAllocation: z.number().min(0).max(100).default(100),
  progressBarEnabled: z.boolean().default(true),
  progressBarMessageTemplate: z
    .string()
    .default("Add {remaining} more for free shipping!"),
  useDeliveryCustomization: z.boolean().default(false),
  variants: z.array(VariantSchema).min(2),
});

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
    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "experiments", async () => {
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
            { error: err instanceof Error ? err.message : "Failed to create" },
            { status: 400 }
          );
        }
      })
    );
  });
}

