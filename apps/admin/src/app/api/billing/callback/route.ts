/**
 * GET /api/billing/callback?shop=xxx&charge_id=xxx&plan=xxx
 *
 * Shopify redirects the merchant here after they approve/decline a charge.
 * We activate the charge and update the ShopPlan record.
 *
 * GUARD: charge_id must match what we stored for the shop.
 * GUARD: declined charge → redirect back to billing page with error.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BillingService } from "@/services/billing.service";

const billingService = new BillingService();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const chargeId = searchParams.get("charge_id");

  if (!shop || !chargeId) {
    return NextResponse.redirect(`${process.env.HOST}/billing?error=missing_params`);
  }

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
    select: { id: true },
  });

  if (!shopRecord) {
    return NextResponse.redirect(`${process.env.HOST}/billing?error=shop_not_found`);
  }

  try {
    await billingService.activateCharge(shopRecord.id, chargeId);
    return NextResponse.redirect(`${process.env.HOST}/billing?success=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    const code = message.includes("declined") ? "declined" : "activation_failed";
    return NextResponse.redirect(`${process.env.HOST}/billing?error=${code}`);
  }
}
