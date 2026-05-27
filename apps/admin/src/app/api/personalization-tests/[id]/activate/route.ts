import { NextRequest, NextResponse } from "next/server";
import { PersonalizationTestService } from "@/services/personalization-test.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new PersonalizationTestService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const exp = await service.activate(shopId, id);
      return NextResponse.json(exp);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
    }
  });
}
