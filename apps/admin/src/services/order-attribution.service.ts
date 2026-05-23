import { prisma } from "@/lib/prisma";

interface MoneySet {
  shop_money?: { amount?: string; currency_code?: string };
  presentment_money?: { amount?: string; currency_code?: string };
}

interface ShopifyOrderPayload {
  id?: number;
  name?: string;
  // Shopify sets source_name = "test" for simulated/test transactions
  // and test = true for orders placed via Shopify test mode.
  // Both are excluded from analytics to prevent metric inflation.
  source_name?: string;
  test?: boolean;
  subtotal_price?: string;
  total_price?: string;
  total_discounts?: string;
  total_shipping_price_set?: MoneySet;
  total_price_set?: MoneySet;
  subtotal_price_set?: MoneySet;
  total_discounts_set?: MoneySet;
  total_tax?: string;
  total_tax_set?: MoneySet;
  currency?: string;
  presentment_currency?: string;
  financial_status?: string;
  fulfillment_status?: string;
  cart_token?: string;
  checkout_token?: string;
  customer?: { id?: number };
  note_attributes?: Array<{ name: string; value: string }>;
  line_items?: Array<{
    product_id?: number;
    variant_id?: number;
    quantity?: number;
    price?: string;
    total_discount?: string;
    sku?: string;
  }>;
}

// Use shop_money (already in the shop's currency) when available;
// fall back to the raw amount (which may be in presentment currency).
function shopMoney(set: MoneySet | undefined, fallback: string | undefined): number {
  return parseFloat(set?.shop_money?.amount ?? fallback ?? "0");
}

export class OrderAttributionService {
  async processOrder(shopId: string, payload: Record<string, unknown>): Promise<void> {
    const order = payload as ShopifyOrderPayload;
    const shopifyOrderId = String(order.id ?? "");
    const shopifyOrderName = order.name ?? "";

    if (!shopifyOrderId) return;

    // Skip test/simulated orders — they inflate analytics and are not real revenue.
    // Shopify sets source_name="test" for orders from the Shopify test payment gateway
    // and test=true for any order placed while the store is in test mode.
    if (order.source_name === "test" || order.test === true) return;

    // Check idempotency — skip if already attributed
    const existing = await prisma.orderAttribution.findUnique({
      where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
    });
    if (existing) {
      // On order/updated, update financial/fulfillment status only
      await prisma.orderAttribution.update({
        where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
        data: {
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status ?? null,
        },
      });
      return;
    }

    const cartToken = order.cart_token ?? null;
    const checkoutToken = order.checkout_token ?? null;
    const customerId = order.customer?.id ? String(order.customer.id) : null;

    // Revenue — prefer shop_money fields (already in shop currency) for multi-currency accuracy
    const subtotalPrice = shopMoney(order.subtotal_price_set, order.subtotal_price);
    const totalPrice = shopMoney(order.total_price_set, order.total_price);
    const totalDiscounts = shopMoney(order.total_discounts_set, order.total_discounts);
    const totalShipping = shopMoney(order.total_shipping_price_set, undefined);
    const totalTax = shopMoney(order.total_tax_set, order.total_tax);
    const netRevenue = totalPrice - totalTax;
    // Store the shop currency code (from shop_money), not the buyer's presentment currency
    const currencyCode =
      order.total_price_set?.shop_money?.currency_code ?? order.currency ?? "USD";
    const presentmentCurrencyCode = order.presentment_currency ?? currencyCode;

    // Attribution lookup hierarchy:
    // 1. Cart token
    // 2. Checkout token
    // 3. Customer ID
    // 4. Note attributes (fallback from cart attributes written to order)
    let assignment: {
      experimentId: string | null;
      variantId: string | null;
      personalizationId: string | null;
      visitorId: string | null;
      sessionId: string | null;
    } = {
      experimentId: null,
      variantId: null,
      personalizationId: null,
      visitorId: null,
      sessionId: null,
    };

    if (cartToken) {
      const found = await prisma.experimentAssignment.findFirst({
        where: { shopId, cartToken },
        orderBy: { firstSeenAt: "desc" },
      });
      if (found) {
        assignment = {
          experimentId: found.experimentId,
          variantId: found.variantId,
          personalizationId: null,
          visitorId: found.visitorId,
          sessionId: found.sessionId,
        };
      }
    }

    if (!assignment.experimentId && checkoutToken) {
      const found = await prisma.experimentAssignment.findFirst({
        where: { shopId, checkoutToken },
        orderBy: { firstSeenAt: "desc" },
      });
      if (found) {
        assignment = {
          experimentId: found.experimentId,
          variantId: found.variantId,
          personalizationId: null,
          visitorId: found.visitorId,
          sessionId: found.sessionId,
        };
      }
    }

    if (!assignment.experimentId && customerId) {
      const found = await prisma.experimentAssignment.findFirst({
        where: { shopId, customerId },
        orderBy: { lastSeenAt: "desc" },
      });
      if (found) {
        assignment = {
          experimentId: found.experimentId,
          variantId: found.variantId,
          personalizationId: null,
          visitorId: found.visitorId,
          sessionId: found.sessionId,
        };
      }
    }

    // Check note attributes for MarginLab cart attributes
    const noteAttributes = order.note_attributes ?? [];
    const visitorIdAttr = noteAttributes.find((a) => a.name === "_ml_visitor_id");
    if (visitorIdAttr && !assignment.visitorId) {
      assignment.visitorId = visitorIdAttr.value;
    }

    // Multi-experiment attribution: collect ALL active assignments for this visitor.
    // The primary attribution (one DB record) uses the first experiment found above.
    // Additional experiments get their DailyMetrics updated even without a separate
    // OrderAttribution record (full multi-attribution requires schema migration:
    //   @@unique([shopId, shopifyOrderId, experimentId]) instead of @@unique([shopId, shopifyOrderId])).
    const allAssignments: Array<{ experimentId: string; variantId: string }> = [];
    if (assignment.experimentId && assignment.variantId) {
      allAssignments.push({ experimentId: assignment.experimentId, variantId: assignment.variantId });
    }
    const visitorOrCustomerFilter = [
      ...(cartToken ? [{ cartToken }] : []),
      ...(checkoutToken ? [{ checkoutToken }] : []),
      ...(assignment.visitorId ? [{ visitorId: assignment.visitorId }] : []),
      ...(customerId ? [{ customerId }] : []),
    ];
    if (visitorOrCustomerFilter.length > 0) {
      const extra = await prisma.experimentAssignment.findMany({
        where: {
          shopId,
          OR: visitorOrCustomerFilter,
          experimentId: { notIn: allAssignments.map((a) => a.experimentId).filter(Boolean) },
        },
        select: { experimentId: true, variantId: true },
        distinct: ["experimentId"],
        take: 20,
      });
      for (const e of extra) {
        if (e.experimentId && e.variantId) {
          allAssignments.push({ experimentId: e.experimentId, variantId: e.variantId });
        }
      }
    }

    // Compute COGS from ProductCost table
    let totalCogs = 0;
    if (order.line_items) {
      for (const item of order.line_items) {
        if (!item.variant_id) continue;
        const cost = await prisma.productCost.findUnique({
          where: { shopifyVariantId: String(item.variant_id) },
          select: { cost: true },
        });
        if (cost) {
          totalCogs += cost.cost * (item.quantity ?? 1);
        }
      }
    }

    // Estimate transaction fee (default 2.9% + $0.30 for Shopify Payments)
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });
    const shopSettings = (shop?.settings ?? {}) as Record<string, unknown>;
    const transactionFeePercent = (shopSettings.transactionFeePercent as number) ?? 2.9;
    const transactionFee = totalPrice * (transactionFeePercent / 100);

    const estimatedShippingCost =
      (shopSettings.estimatedShippingCost as number) ?? 0;
    const grossProfit =
      netRevenue - totalCogs - estimatedShippingCost - transactionFee;
    const contributionMargin =
      netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // Enrich lineItems with multi-attribution metadata so data is not lost
    // even before the schema migration adds @@unique([shopId, shopifyOrderId, experimentId]).
    const enrichedLineItems = {
      items: order.line_items ?? [],
      _ml_all_attributions: allAssignments,
      _ml_presentment_currency: presentmentCurrencyCode,
    };

    await prisma.orderAttribution.create({
      data: {
        shopId,
        shopifyOrderId,
        shopifyOrderName,
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
        personalizationId: assignment.personalizationId,
        visitorId: assignment.visitorId,
        sessionId: assignment.sessionId,
        cartToken,
        checkoutToken,
        customerId,
        subtotalPrice,
        totalPrice,
        totalDiscounts,
        totalShipping,
        totalTax,
        netRevenue,
        currencyCode,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status ?? null,
        cogs: totalCogs,
        estimatedShippingCost,
        transactionFee,
        grossProfit,
        contributionMargin,
        lineItems: enrichedLineItems as never,
      },
    });

    // Update DailyMetric for ALL attributed experiments (multi-experiment attribution).
    const metricPayload = {
      orders: 1,
      revenue: totalPrice,
      netRevenue,
      discounts: totalDiscounts,
      shippingRevenue: totalShipping,
      tax: totalTax,
      cogs: totalCogs,
      grossProfit,
    };
    for (const attr of allAssignments) {
      await this.updateDailyMetric(shopId, attr.experimentId, attr.variantId, metricPayload);
    }
  }

  // Handle refunds/create webhook.
  // Reduces netRevenue and grossProfit on the existing OrderAttribution record.
  // GUARD: no-op if the order was never attributed.
  async processRefund(shopId: string, payload: Record<string, unknown>): Promise<void> {
    interface ShopifyRefundPayload {
      order_id?: number | string;
      transactions?: Array<{ amount?: string; kind?: string }>;
    }
    const refund = payload as ShopifyRefundPayload;
    const shopifyOrderId = String(refund.order_id ?? "");
    if (!shopifyOrderId) return;

    const attribution = await prisma.orderAttribution.findUnique({
      where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
    });
    if (!attribution) return;

    // Sum all refund transactions
    let refundAmount = 0;
    for (const tx of refund.transactions ?? []) {
      if (tx.kind === "refund") {
        refundAmount += parseFloat(tx.amount ?? "0");
      }
    }
    if (refundAmount <= 0) return;

    const newNetRevenue = Math.max(0, attribution.netRevenue - refundAmount);
    const newGrossProfit =
      attribution.grossProfit !== null
        ? attribution.grossProfit - refundAmount
        : null;

    await prisma.orderAttribution.update({
      where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
      data: {
        netRevenue: newNetRevenue,
        grossProfit: newGrossProfit,
        financialStatus: "refunded",
      },
    });
  }

  private async updateDailyMetric(
    shopId: string,
    experimentId: string,
    variantId: string,
    metrics: {
      orders: number;
      revenue: number;
      netRevenue: number;
      discounts: number;
      shippingRevenue: number;
      tax: number;
      cogs: number;
      grossProfit: number;
    }
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyMetric.upsert({
      where: {
        shopId_experimentId_variantId_date: {
          shopId,
          experimentId,
          variantId,
          date: today,
        },
      },
      update: {
        orders: { increment: metrics.orders },
        revenue: { increment: metrics.revenue },
        netRevenue: { increment: metrics.netRevenue },
        discounts: { increment: metrics.discounts },
        shippingRevenue: { increment: metrics.shippingRevenue },
        tax: { increment: metrics.tax },
        cogs: { increment: metrics.cogs },
        grossProfit: { increment: metrics.grossProfit },
      },
      create: {
        shopId,
        experimentId,
        variantId,
        date: today,
        orders: metrics.orders,
        revenue: metrics.revenue,
        netRevenue: metrics.netRevenue,
        discounts: metrics.discounts,
        shippingRevenue: metrics.shippingRevenue,
        tax: metrics.tax,
        cogs: metrics.cogs,
        grossProfit: metrics.grossProfit,
      },
    });
  }
}
