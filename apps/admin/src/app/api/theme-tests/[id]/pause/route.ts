import { NextRequest, NextResponse } from "next/server";
import { ThemeTestService } from "@/services/theme-test.service";
import { withShopAuth } from "@/lib/api-middleware";

const service = new ThemeTestService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const exp = await service.pause(shopId, id);
      return NextResponse.json(exp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pause failed";
      return NextResponse.json(
        { error: msg },
        { status: msg.includes("not found") ? 404 : 422 }
      );
    }
  });
}
