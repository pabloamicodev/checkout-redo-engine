import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { BillingService } from "@/services/billing.service";
import { PLANS, PLAN_ORDER } from "@/lib/plans";

const billingService = new BillingService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { plan: currentPlan, isTrialing, isActive } = await billingService.getShopPlan(shopId);
    const { usage } = await billingService.getUsageStats(shopId);

    const plans = PLAN_ORDER.map((key) => ({
      ...PLANS[key],
      isCurrent: PLANS[key].key === currentPlan.key,
      maxRunningExperiments:
        PLANS[key].maxRunningExperiments === Infinity ? null : PLANS[key].maxRunningExperiments,
      maxActiveOffers:
        PLANS[key].maxActiveOffers === Infinity ? null : PLANS[key].maxActiveOffers,
      maxCheckoutBlocks:
        PLANS[key].maxCheckoutBlocks === Infinity ? null : PLANS[key].maxCheckoutBlocks,
      maxIntegrations:
        PLANS[key].maxIntegrations === Infinity ? null : PLANS[key].maxIntegrations,
    }));

    return NextResponse.json({ plans, currentPlan, isTrialing, isActive, usage });
  });
}
