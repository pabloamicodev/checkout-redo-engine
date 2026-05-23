import { NextRequest, NextResponse } from "next/server";
import { PersonalizationTestService } from "@/services/personalization-test.service";
import { getShopId } from "@/lib/api-shop";

const service = new PersonalizationTestService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId(request);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const { id } = await params;
  try {
    const exp = await service.activate(shopId, id);
    return NextResponse.json(exp);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

