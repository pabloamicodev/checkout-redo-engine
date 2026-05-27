import { NextRequest, NextResponse } from "next/server";
import { IntegrationService } from "@/services/integration.service";
import { withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";
import { z } from "zod";

const service = new IntegrationService();

const UpsertSchema = z.object({
  type: z.enum(["GA4", "KLAVIYO", "CLARITY", "HEAP", "SEGMENT", "ELEVAR", "SLACK", "OUTBOUND_WEBHOOK"]),
  enabled: z.boolean().default(true),
  credentials: z.record(z.string()).default({}),
  settings: z.record(z.unknown()).default({}),
});

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const items = await service.list(shopId);
    return NextResponse.json({ items });
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "integrations", async () => {
        let body: unknown;
        try { body = await request.json(); }
        catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

        const parsed = UpsertSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

        const integration = await service.upsert(shopId, parsed.data.type, {
          enabled: parsed.data.enabled,
          credentials: parsed.data.credentials,
          settings: parsed.data.settings,
        });
        return NextResponse.json(integration);
      })
    );
  });
}

