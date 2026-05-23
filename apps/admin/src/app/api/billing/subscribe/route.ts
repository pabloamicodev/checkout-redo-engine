/**
 * POST /api/billing/subscribe
 * Body: { planKey: "growth" | "pro" | "enterprise" }
 *
 * Creates a Shopify recurring charge and returns the confirmation URL.
 * The frontend should redirect the user to this URL.
 *
 * GUARD: Free plan does not create a charge.
 * GUARD: Cannot downgrade while on a higher-tier plan (must cancel first).
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { BillingService } from "@/services/billing.service";
import { PLAN_ORDER, PlanKey } from "@/lib/plans";
import { z } from "zod";

const billingService = new BillingService();

const SubscribeSchema = z.object({
  planKey: z.enum(["growth", "pro", "enterprise"]),
});

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const body = await request.json();
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan key" }, { status: 400 });
    }

    const { planKey } = parsed.data;

    // GUARD: cannot subscribe to a plan lower than current
    const { plan: currentPlan } = await billingService.getShopPlan(shopId);
    const currentIndex = PLAN_ORDER.indexOf(currentPlan.key as PlanKey);
    const targetIndex = PLAN_ORDER.indexOf(planKey);
    if (targetIndex < currentIndex) {
      return NextResponse.json(
        { error: "Cannot downgrade directly. Cancel current plan first." },
        { status: 422 }
      );
    }

    try {
      const { confirmationUrl, chargeId } = await billingService.createCharge(shopId, planKey);
      return NextResponse.json({ confirmationUrl, chargeId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create charge";
      // Demo mode: no Shopify session available
      if (message.includes("session") || message.includes("ENCRYPTION_KEY")) {
        return NextResponse.json(
          { error: "Billing requires a connected Shopify store. Running in demo mode.", demo: true },
          { status: 422 }
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
