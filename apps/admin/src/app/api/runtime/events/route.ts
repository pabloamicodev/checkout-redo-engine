import { NextRequest, NextResponse } from "next/server";
import { EventIngestionService } from "@/services/event-ingestion.service";
import { RuntimeEventSchema } from "@/lib/zod-schemas";
import { withRuntimeAuth, withRuntimeRateLimit } from "@/lib/api-middleware";
import { recordRuntimeSignal } from "@/lib/runtime-health";

const service = new EventIngestionService();

// Public endpoint — called by storefront runtime (no admin auth required)
export async function POST(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain, shopId) => {
    return withRuntimeRateLimit(
      `runtime_event:${shopDomain}`,
      "runtime_event",
      async () => {
        const body = await request.json() as unknown;

        const parsed = RuntimeEventSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid event payload", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        if (parsed.data.shopDomain !== shopDomain) {
          return NextResponse.json({ error: "Shop domain mismatch" }, { status: 403 });
        }

        const result = await service.ingest(shopId, parsed.data);

        // Fire-and-forget: record that events are flowing for this shop
        recordRuntimeSignal(shopDomain, "event_ingested");

        return NextResponse.json(
          { ok: true, ...(result.warnings?.length ? { warnings: result.warnings } : {}) },
          { status: 202 }
        );
      }
    );
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
    },
  });
}
