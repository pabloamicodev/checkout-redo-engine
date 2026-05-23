import { NextRequest, NextResponse } from "next/server";
import { SplitUrlTestService } from "@/services/split-url-test.service";
import { getShopId } from "@/lib/api-shop";

const service = new SplitUrlTestService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    const exp = await service.pause(shopId, id);
    return NextResponse.json(exp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pause failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 422 });
  }
}

