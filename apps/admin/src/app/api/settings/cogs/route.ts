import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withShopAuth } from "@/lib/api-middleware";
import { CogsService } from "@/services/cogs.service";

const service = new CogsService();

// GET /api/settings/cogs?search=&page=&limit=
export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const [{ items, total }, coverage] = await Promise.all([
      service.list(shopId, { search, page, limit }),
      service.getCoverage(shopId),
    ]);

    return NextResponse.json({ items, total, page, limit, coverage });
  });
}

const ManualEntrySchema = z.object({
  variantId: z.string().min(1),
  cost: z.number().positive("cost must be positive"),
  sku: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
});

// POST /api/settings/cogs — manual single entry
export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const body = await request.json();
    const parsed = ManualEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { variantId, cost, sku, currencyCode } = parsed.data;
    const record = await service.update(shopId, variantId, cost, { sku, currencyCode });
    return NextResponse.json({ record }, { status: 201 });
  });
}
