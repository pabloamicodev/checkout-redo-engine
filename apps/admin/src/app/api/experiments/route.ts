import { NextRequest, NextResponse } from "next/server";
import { ExperimentService } from "@/services/experiment.service";
import { CreateExperimentSchema } from "@/lib/zod-schemas";
import { getShopFromRequest, withShopAuth, withBillingActive, withPlanGuard } from "@/lib/api-middleware";
import { checkRateLimit, applyRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const service = new ExperimentService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { searchParams } = new URL(request.url);

    const { experiments, total } = await service.list(shopId, {
      status: searchParams.get("status") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      search: searchParams.get("q") ?? undefined,
      limit: Math.min(parseInt(searchParams.get("limit") ?? "50") || 50, 500),
      offset: parseInt(searchParams.get("offset") ?? "0"),
    });

    return NextResponse.json({ experiments, total });
  });
}

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId, actorId) => {
    const rl = await checkRateLimit(`${shopId}:create_experiment`, RATE_LIMITS.create_experiment);
    if (!rl.allowed) {
      const headers = new Headers();
      applyRateLimitHeaders(headers, rl);
      return NextResponse.json(
        { error: "Too many experiment creation requests. Please wait before trying again." },
        { status: 429, headers }
      );
    }

    return withBillingActive(shopId, () =>
      withPlanGuard(shopId, "experiments", async () => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = CreateExperimentSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const experiment = await service.create(shopId, parsed.data, actorId);
        return NextResponse.json({ experiment }, { status: 201 });
      })
    );
  });
}
