import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { CustomEventService } from "@/services/custom-event.service";

const svc = new CustomEventService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withShopAuth(request, async (shopId) => {
    const { id } = await params;
    try {
      const event = await svc.get(shopId, id);
      const snippet = svc.generateSnippet({
        name: event.name,
        schema: event.schema as Record<string, unknown> | null,
      });
      return NextResponse.json({ snippet });
    } catch {
      return NextResponse.json({ error: "Custom event not found" }, { status: 404 });
    }
  });
}
