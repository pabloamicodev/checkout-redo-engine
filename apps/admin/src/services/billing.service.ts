/**
 * BillingService
 *
 * Manages Shopify recurring application charges and plan enforcement.
 *
 * Flow:
 *  1. createCharge(shopId, planKey) → returns Shopify confirmation URL
 *  2. Merchant approves on Shopify → Shopify redirects to /api/billing/callback?charge_id=xxx
 *  3. activateCharge(shopId, chargeId) → activates the charge, updates ShopPlan
 *  4. app_subscriptions/update webhook keeps plan status in sync
 *
 * GUARD: All plan checks use getShopPlan which returns "free" if no record exists.
 * GUARD: Shopify charge activation is idempotent — safe to call twice.
 */

import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { getPlan, PLAN_ORDER, LimitCheck, LimitType, PlanKey, PLANS } from "@/lib/plans";

export class BillingService {
  /**
   * Get the current plan for a shop. Falls back to "free" if no plan record.
   */
  async getShopPlan(shopId: string) {
    const record = await prisma.shopPlan.findUnique({
      where: { shopId },
    });

    const planKey = record?.planKey ?? "free";
    const plan = getPlan(planKey);

    return {
      ...record,
      plan,
      isTrialing: record?.status === "TRIALING",
      isActive: !record || record.status === "ACTIVE" || record.status === "TRIALING",
    };
  }

  /**
   * Check whether a shop is within its plan limits for a given resource type.
   *
   * GUARD: counts only RUNNING experiments, ACTIVE offers, ACTIVE checkout blocks.
   */
  async checkLimit(shopId: string, limitType: LimitType): Promise<LimitCheck> {
    const { plan } = await this.getShopPlan(shopId);

    let current = 0;
    let max = 0;

    switch (limitType) {
      case "experiments":
        current = await prisma.experiment.count({
          where: { shopId, status: "RUNNING" },
        });
        max = plan.maxRunningExperiments;
        break;

      case "offers":
        current = await prisma.offer.count({
          where: { shopId, status: "ACTIVE" },
        });
        max = plan.maxActiveOffers;
        break;

      case "checkoutBlocks":
        current = await prisma.checkoutBlock.count({
          where: { shopId, status: "ACTIVE" },
        });
        max = plan.maxCheckoutBlocks;
        break;

      case "integrations":
        current = await prisma.integration.count({
          where: { shopId, status: "CONNECTED" },
        });
        max = plan.maxIntegrations;
        break;
    }

    const allowed = max === Infinity || current < max;

    // Find the cheapest plan that would allow this action
    let upgradeRequired: PlanKey | null = null;
    if (!allowed) {
      for (const key of PLAN_ORDER) {
        const candidate = PLANS[key];
        const candidateMax =
          limitType === "experiments" ? candidate.maxRunningExperiments :
          limitType === "offers" ? candidate.maxActiveOffers :
          limitType === "checkoutBlocks" ? candidate.maxCheckoutBlocks :
          candidate.maxIntegrations;

        if (candidateMax > current) {
          upgradeRequired = key;
          break;
        }
      }
    }

    return { allowed, current, max, planKey: plan.key, upgradeRequired };
  }

  /**
   * Create a Shopify recurring application charge and return the confirmation URL.
   * The merchant must visit this URL to approve the charge.
   *
   * GUARD: Requires a valid Shopify access token for the shop.
   */
  async createCharge(
    shopId: string,
    planKey: PlanKey
  ): Promise<{ confirmationUrl: string; chargeId: string }> {
    const plan = getPlan(planKey);
    if (plan.price === 0) throw new Error("Free plan does not require a charge");

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true, accessTokenEncrypted: true },
    });
    if (!shop) throw new Error("Shop not found");

    const accessToken = decrypt(shop.accessTokenEncrypted);

    const returnUrl = `${process.env.HOST}/api/billing/callback?shop=${shop.shopDomain}&plan=${planKey}`;

    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
        appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, trialDays: $trialDays, test: $test) {
          appSubscription { id }
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2025-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            name: `MarginLab ${plan.name}`,
            returnUrl,
            trialDays: plan.trialDays > 0 ? plan.trialDays : undefined,
            test: process.env.NODE_ENV !== "production",
            lineItems: [
              {
                plan: {
                  appRecurringPricingDetails: {
                    price: { amount: plan.price, currencyCode: plan.currency },
                    interval: "EVERY_30_DAYS",
                  },
                },
              },
            ],
          },
        }),
      }
    );

    const json = (await response.json()) as {
      data?: {
        appSubscriptionCreate?: {
          appSubscription?: { id: string };
          confirmationUrl?: string;
          userErrors?: { field: string; message: string }[];
        };
      };
    };

    const result = json.data?.appSubscriptionCreate;
    if (!result) throw new Error("Shopify billing API returned no data");

    const errors = result.userErrors ?? [];
    if (errors.length > 0) throw new Error(errors.map((e) => e.message).join(", "));

    if (!result.confirmationUrl || !result.appSubscription?.id) {
      throw new Error("Shopify did not return a confirmation URL");
    }

    // Strip the gid:// prefix → store numeric ID
    const chargeId = result.appSubscription.id.replace(/^gid:\/\/shopify\/AppSubscription\//, "");

    // Create/update the plan record as PENDING until confirmed
    await prisma.shopPlan.upsert({
      where: { shopId },
      create: { shopId, planKey, status: "PENDING", shopifyChargeId: chargeId },
      update: { planKey, status: "PENDING", shopifyChargeId: chargeId },
    });

    return { confirmationUrl: result.confirmationUrl, chargeId };
  }

  /**
   * Activate a charge after the merchant approves it on Shopify.
   * Called from /api/billing/callback.
   *
   * GUARD: Verifies the charge belongs to this shop before activating.
   */
  async activateCharge(shopId: string, chargeId: string): Promise<void> {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopDomain: true, accessTokenEncrypted: true },
    });
    if (!shop) throw new Error("Shop not found");

    const accessToken = decrypt(shop.accessTokenEncrypted);

    // Verify charge status via REST (simpler for activation check)
    const checkRes = await fetch(
      `https://${shop.shopDomain}/admin/api/2025-04/recurring_application_charges/${chargeId}.json`,
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );

    const checkJson = (await checkRes.json()) as {
      recurring_application_charge?: {
        id: number;
        status: string;
        name: string;
        price: string;
        trial_days: number;
        billing_on: string;
        activated_on: string | null;
        trial_ends_on: string | null;
      };
    };

    const charge = checkJson.recurring_application_charge;
    if (!charge) throw new Error("Charge not found on Shopify");
    if (charge.status === "declined") throw new Error("Charge was declined by merchant");
    if (charge.status === "expired") throw new Error("Charge has expired");

    // Activate if pending
    if (charge.status === "pending") {
      await fetch(
        `https://${shop.shopDomain}/admin/api/2025-04/recurring_application_charges/${chargeId}/activate.json`,
        {
          method: "POST",
          headers: { "X-Shopify-Access-Token": accessToken },
        }
      );
    }

    const planRecord = await prisma.shopPlan.findUnique({ where: { shopId } });
    const planKey = planRecord?.planKey ?? "free";
    const trialEndsAt = charge.trial_ends_on ? new Date(charge.trial_ends_on) : null;
    const isTrialing = trialEndsAt ? new Date() < trialEndsAt : false;

    await prisma.shopPlan.upsert({
      where: { shopId },
      create: {
        shopId,
        planKey,
        status: isTrialing ? "TRIALING" : "ACTIVE",
        shopifyChargeId: String(charge.id),
        trialEndsAt,
        currentPeriodStart: charge.activated_on ? new Date(charge.activated_on) : new Date(),
      },
      update: {
        status: isTrialing ? "TRIALING" : "ACTIVE",
        shopifyChargeId: String(charge.id),
        trialEndsAt,
        currentPeriodStart: charge.activated_on ? new Date(charge.activated_on) : new Date(),
      },
    });
  }

  /**
   * Cancel the subscription — downgrades shop to free plan.
   * Does NOT cancel on Shopify (merchant must do that in Shopify admin).
   */
  async cancelSubscription(shopId: string): Promise<void> {
    await prisma.shopPlan.upsert({
      where: { shopId },
      create: { shopId, planKey: "free", status: "ACTIVE", cancelledAt: new Date() },
      update: { planKey: "free", status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  /**
   * Handle app_subscriptions/update webhook from Shopify.
   * Syncs subscription status to our database.
   */
  async processSubscriptionWebhook(
    shopId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const status = (payload.status as string | undefined)?.toUpperCase();
    const chargeId = String(payload.id ?? "");

    // Map Shopify statuses to our PlanStatus enum
    const statusMap: Record<string, string> = {
      ACTIVE: "ACTIVE",
      PENDING: "PENDING",
      ACCEPTED: "ACTIVE",
      DECLINED: "DECLINED",
      EXPIRED: "EXPIRED",
      FROZEN: "FROZEN",
      CANCELLED: "CANCELLED",
    };

    const mappedStatus = statusMap[status ?? ""] ?? "ACTIVE";

    const existing = await prisma.shopPlan.findUnique({ where: { shopId } });

    if (existing) {
      await prisma.shopPlan.update({
        where: { shopId },
        data: {
          status: mappedStatus as never,
          ...(mappedStatus === "CANCELLED" ? { cancelledAt: new Date(), planKey: "free" } : {}),
        },
      });
    }

    // If cancelled/frozen/expired, log the event
    if (["CANCELLED", "FROZEN", "EXPIRED"].includes(mappedStatus)) {
      console.info(`[Billing] Subscription ${mappedStatus} for shop ${shopId}, charge ${chargeId}`);
    }
  }

  /**
   * Ensure the shop has a plan record. Creates a free plan if none exists.
   * Called after OAuth install.
   */
  async ensurePlanRecord(shopId: string): Promise<void> {
    await prisma.shopPlan.upsert({
      where: { shopId },
      create: { shopId, planKey: "free", status: "ACTIVE" },
      update: {},
    });
  }

  /**
   * Get usage stats for a shop (current counts vs. plan limits).
   */
  async getUsageStats(shopId: string) {
    const { plan } = await this.getShopPlan(shopId);

    const [runningExperiments, activeOffers, activeBlocks, connectedIntegrations] =
      await prisma.$transaction([
        prisma.experiment.count({ where: { shopId, status: "RUNNING" } }),
        prisma.offer.count({ where: { shopId, status: "ACTIVE" } }),
        prisma.checkoutBlock.count({ where: { shopId, status: "ACTIVE" } }),
        prisma.integration.count({ where: { shopId, status: "CONNECTED" } }),
      ]);

    return {
      plan,
      usage: {
        experiments: { current: runningExperiments, max: plan.maxRunningExperiments },
        offers: { current: activeOffers, max: plan.maxActiveOffers },
        checkoutBlocks: { current: activeBlocks, max: plan.maxCheckoutBlocks },
        integrations: { current: connectedIntegrations, max: plan.maxIntegrations },
      },
    };
  }
}
