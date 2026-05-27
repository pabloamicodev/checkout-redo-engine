import { NextRequest, NextResponse } from "next/server";
import { AssignmentRequestSchema } from "@/lib/zod-schemas";
import { withRuntimeAuth, withRuntimeRateLimit } from "@/lib/api-middleware";
import { assignVariant, forceVariant } from "@/lib/assignment";
import { evaluateTargetingRules } from "@/lib/targeting";
import { RuntimeConfigService } from "@/services/runtime-config.service";
import { prisma } from "@/lib/prisma";
import { recordRuntimeSignal } from "@/lib/runtime-health";
import type { TargetingGroup } from "@/lib/targeting";

const configService = new RuntimeConfigService();

export async function POST(request: NextRequest) {
  return withRuntimeAuth(request, async (shopDomain) => {
    const body = await request.json() as unknown;

    const parsed = AssignmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.shopDomain !== shopDomain) {
      return NextResponse.json({ error: "Shop domain mismatch" }, { status: 403 });
    }

    const { visitorId, sessionId, context } = parsed.data;

    return withRuntimeRateLimit(
      `runtime_assign_shop:${shopDomain}`,
      "runtime_assign_shop",
      () => withRuntimeRateLimit(
      `runtime_assign:${visitorId}`,
      "runtime_assign",
      async () => {

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const config = await configService.get(shopDomain);
    if (!config) {
      return NextResponse.json({ assignments: [] });
    }

    // Check for existing assignments first
    const existingAssignments = await prisma.experimentAssignment.findMany({
      where: {
        shopId: shop.id,
        visitorId,
        experiment: { status: { in: ["RUNNING", "PREVIEW", "QA"] } },
      },
      include: {
        experiment: { select: { slug: true, status: true } },
        variant: { select: { key: true, modifications: true, priceOverrides: true, redirectUrl: true, checkoutBlockIds: true, offerIds: true } },
      },
    });

    const assignments: Record<string, {
      experimentId: string;
      experimentSlug: string;
      variantId: string;
      variantKey: string;
      modifications: unknown[];
      priceOverrides: unknown[];
      redirectUrl: string | null;
      checkoutBlockIds: string[];
      offerIds: string[];
    }> = {};

    // Restore existing assignments
    for (const a of existingAssignments) {
      assignments[a.experimentId] = {
        experimentId: a.experimentId,
        experimentSlug: a.experiment.slug,
        variantId: a.variantId,
        variantKey: a.variant.key,
        modifications: a.variant.modifications as unknown[],
        priceOverrides: a.variant.priceOverrides as unknown[],
        redirectUrl: a.variant.redirectUrl,
        checkoutBlockIds: a.variant.checkoutBlockIds,
        offerIds: a.variant.offerIds,
      };
    }

    const existingExperimentIds = new Set(Object.keys(assignments));

    // Evaluate new assignments for experiments not yet assigned
    const newAssignments: {
      shopId: string;
      experimentId: string;
      variantId: string;
      visitorId: string;
      sessionId: string | null;
      source: "SERVER_SIDE";
      landingPage: string | null;
      country: string | null;
      deviceType: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
    }[] = [];

    for (const exp of config.experiments) {
      if (existingExperimentIds.has(exp.id)) continue;
      if (!["RUNNING", "PREVIEW", "QA"].includes(exp.status)) continue;

      // Evaluate targeting
      const meetsTargeting = evaluateTargetingRules(
        exp.targetingRules as TargetingGroup[],
        {
          deviceType: context.deviceType,
          country: context.country,
          currency: context.currency,
          url: context.url,
          path: context.url,
          utmSource: context.utmSource,
          utmMedium: context.utmMedium,
          utmCampaign: context.utmCampaign,
          cartValue: context.cartValue,
          cartProductIds: context.cartProductIds,
          isNewVisitor: context.isNewVisitor,
          isCustomerLoggedIn: context.isCustomerLoggedIn,
        }
      );

      if (!meetsTargeting) continue;

      // Check for forced variant (preview/QA mode)
      const forced = context.forceVariants?.[exp.slug];

      let assignedVariant;
      if (forced) {
        assignedVariant = forceVariant(forced, exp.variants);
      } else {
        assignedVariant = assignVariant(
          visitorId,
          exp.id,
          exp.trafficAllocation,
          exp.variants
        );
      }

      if (!assignedVariant) continue;

      const fullVariant = exp.variants.find((v) => v.id === assignedVariant!.id);
      if (!fullVariant) continue;

      assignments[exp.id] = {
        experimentId: exp.id,
        experimentSlug: exp.slug,
        variantId: assignedVariant.id,
        variantKey: assignedVariant.key,
        modifications: fullVariant.modifications as unknown[],
        priceOverrides: fullVariant.priceOverrides as unknown[],
        redirectUrl: fullVariant.redirectUrl,
        checkoutBlockIds: fullVariant.checkoutBlockIds,
        offerIds: fullVariant.offerIds,
      };

      newAssignments.push({
        shopId: shop.id,
        experimentId: exp.id,
        variantId: assignedVariant.id,
        visitorId,
        sessionId: sessionId ?? null,
        source: "SERVER_SIDE",
        landingPage: context.url ?? null,
        country: context.country ?? null,
        deviceType: context.deviceType ?? null,
        utmSource: context.utmSource ?? null,
        utmMedium: context.utmMedium ?? null,
        utmCampaign: context.utmCampaign ?? null,
      });
    }

    // Persist new assignments
    if (newAssignments.length > 0) {
      await prisma.experimentAssignment.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
    }

        recordRuntimeSignal(shopDomain, "assignment");

        return NextResponse.json({ assignments: Object.values(assignments) });
      } // end per-visitor withRuntimeRateLimit handler
      ) // end per-visitor withRuntimeRateLimit
    ); // end per-shop withRuntimeRateLimit
  }); // end withRuntimeAuth
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
