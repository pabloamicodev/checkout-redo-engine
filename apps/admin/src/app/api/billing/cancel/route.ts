/**
 * POST /api/billing/cancel
 *
 * Downgrades the shop to the free plan in our database.
 * The merchant still needs to cancel via Shopify admin — this just removes
 * premium access from our side immediately.
 *
 * GUARD: Cannot cancel if already on free plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { BillingService } from "@/services/billing.service";

const billingService = new BillingService();

export async function POST(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const { plan } = await billingService.getShopPlan(shopId);

    if (plan.key === "free") {
      return NextResponse.json({ error: "Already on free plan" }, { status: 422 });
    }

    await billingService.cancelSubscription(shopId);
    return NextResponse.json({ ok: true, message: "Downgraded to free plan" });
  });
}
