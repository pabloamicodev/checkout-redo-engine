/**
 * GET /api/onboarding/status
 *
 * Returns real-time install health data for the merchant onboarding checklist.
 * Used by the onboarding page to detect what still needs to be set up.
 *
 * All checks fail-open — a check failure returns false, never an error.
 */

import { NextRequest, NextResponse } from "next/server";
import { withShopAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { BillingService } from "@/services/billing.service";

const billingService = new BillingService();

export async function GET(request: NextRequest) {
  return withShopAuth(request, async (shopId) => {
    const [
      shopPlan,
      lastEvent,
      lastOrder,
      lastWebhook,
      runningExperiments,
      shop,
      checkoutBlockCount,
      cogsCount,
      functionExperimentCount,
    ] = await Promise.allSettled([
      billingService.getShopPlan(shopId),
      prisma.event.findFirst({
        where: { shopId },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      }),
      prisma.orderAttribution.findFirst({
        where: { shopId },
        orderBy: { attributedAt: "desc" },
        select: { attributedAt: true },
      }),
      prisma.webhookLog.findFirst({
        where: { shopId, status: "processed" },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true, topic: true },
      }),
      prisma.experiment.count({
        where: { shopId, status: "RUNNING" },
      }),
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { installedAt: true, scopes: true, uninstalledAt: true },
      }),
      prisma.checkoutBlock.count({ where: { shopId } }),
      prisma.productCost.count({ where: { shopId } }),
      prisma.experiment.count({
        where: {
          shopId,
          type: { in: ["PRICE_TEST", "DISCOUNT_TEST", "SHIPPING_TEST"] },
          status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
        },
      }),
    ]);

    const plan = shopPlan.status === "fulfilled" ? shopPlan.value : null;
    const event = lastEvent.status === "fulfilled" ? lastEvent.value : null;
    const order = lastOrder.status === "fulfilled" ? lastOrder.value : null;
    const webhook = lastWebhook.status === "fulfilled" ? lastWebhook.value : null;
    const running = runningExperiments.status === "fulfilled" ? runningExperiments.value : 0;
    const shopData = shop.status === "fulfilled" ? shop.value : null;
    const checkoutBlocks = checkoutBlockCount.status === "fulfilled" ? checkoutBlockCount.value : 0;
    const cogsCoverage = cogsCount.status === "fulfilled" ? cogsCount.value : 0;
    const functionExperiments = functionExperimentCount.status === "fulfilled" ? functionExperimentCount.value : 0;

    // The Theme App Embed cannot be confirmed via API — we use event receipt as a proxy.
    // If at least one storefront event was received, the embed is likely active.
    const eventsFlowing = event !== null;
    const recentEvent = event?.receivedAt
      ? new Date(event.receivedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      : false;

    return NextResponse.json({
      // Billing
      billingActive: plan?.isActive ?? true, // free plan is active by default
      billingPlan: plan?.plan?.key ?? "free",
      billingTrialing: plan?.isTrialing ?? false,

      // App embed / pixel (proxied via event data)
      eventsFlowing,
      lastEventReceivedAt: event?.receivedAt ?? null,
      recentEvent,

      // Webhooks
      webhooksReceiving: webhook !== null,
      lastWebhookReceivedAt: webhook?.receivedAt ?? null,
      lastWebhookTopic: webhook?.topic ?? null,

      // Orders
      ordersAttributing: order !== null,
      lastOrderAttributedAt: order?.attributedAt ?? null,

      // Experiments
      hasRunningExperiment: running > 0,
      runningExperimentCount: running,

      // App
      installedAt: shopData?.installedAt ?? null,
      scopesGranted: (shopData?.scopes ?? []).length > 0,

      // Extensions
      checkoutExtensionActive: checkoutBlocks > 0,
      checkoutBlockCount: checkoutBlocks,
      discountEngineActive: functionExperiments > 0,
      discountFunctionExperimentCount: functionExperiments,

      // COGS
      cogsConfigured: cogsCoverage > 0,
      cogsVariantCount: cogsCoverage,
    });
  });
}
