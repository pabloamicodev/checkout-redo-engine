import { NextRequest, NextResponse } from "next/server";
import { RuntimeConfigService } from "@/services/runtime-config.service";
import { withRuntimeAuth, withRuntimeRateLimit } from "@/lib/api-middleware";
import { recordRuntimeSignal } from "@/lib/runtime-health";

const service = new RuntimeConfigService();

// Public endpoint — called by storefront runtime (no admin auth required)
export async function GET(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain) => {
    return withRuntimeRateLimit(
      `runtime_config:${shopDomain}`,
      "runtime_config",
      async () => {
        const config = await service.get(shopDomain);

        if (!config) {
          return NextResponse.json({ error: "Shop not found" }, { status: 404 });
        }

        // Fire-and-forget: record that this shop's storefront fetched config
        recordRuntimeSignal(shopDomain, "config_fetch");

        const response = NextResponse.json(config);

        // Stale-while-revalidate caching: serve cached for 30s, revalidate up to 60s
        response.headers.set(
          "Cache-Control",
          "public, max-age=30, stale-while-revalidate=60"
        );
        response.headers.set("Vary", "X-Shop-Domain");

        return response;
      }
    );
  });
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
    },
  });
}
