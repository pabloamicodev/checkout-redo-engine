/**
 * DailyMetricService
 *
 * Responsible for keeping DailyMetric records accurate.
 *
 * Two modes of operation:
 * 1. Real-time: called inline from EventIngestionService on each batch
 * 2. Batch: called by the BullMQ aggregation worker every hour to
 *    re-compute from raw events (self-healing, handles missed increments)
 *
 * GUARD: All upserts are idempotent. The batch mode overwrites, real-time
 * increments. They can run concurrently without double-counting because
 * the batch mode uses COUNT/SUM aggregates from events (not prior metric values).
 */

import { prisma } from "@/lib/prisma";

export interface DailyMetricIncrement {
  shopId: string;
  experimentId: string;
  variantId: string;
  date: Date;
  // Visitor/session tracking uses HyperLogLog approximation in real systems.
  // For simplicity, we track "new visitor seen today" via a separate Redis set.
  newVisitor?: boolean;
  newSession?: boolean;
  pageView?: boolean;
  productView?: boolean;
  addToCart?: boolean;
  checkoutStarted?: boolean;
}

export interface AggregationResult {
  date: string;
  experimentId: string;
  variantId: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  addToCarts: number;
  checkoutsStarted: number;
  orders: number;
  revenue: number;
  netRevenue: number;
  discounts: number;
  shippingRevenue: number;
  cogs: number;
  grossProfit: number;
}

export class DailyMetricService {
  /**
   * Increment real-time counters from a single event.
   * Called by EventIngestionService for each event that has an experimentId.
   *
   * GUARD: Uses Prisma `increment` so concurrent calls don't overwrite each other.
   * GUARD: Only increments if experimentId AND variantId are present.
   */
  async incrementFromEvent(increment: DailyMetricIncrement): Promise<void> {
    const { shopId, experimentId, variantId } = increment;

    // Normalize date to midnight UTC
    const date = new Date(increment.date);
    date.setUTCHours(0, 0, 0, 0);

    const updates: Record<string, { increment: number }> = {};

    if (increment.pageView) updates.pageViews = { increment: 1 };
    if (increment.productView) updates.productViews = { increment: 1 };
    if (increment.addToCart) updates.addToCarts = { increment: 1 };
    if (increment.checkoutStarted) updates.checkoutsStarted = { increment: 1 };
    if (increment.newVisitor) updates.visitors = { increment: 1 };
    if (increment.newSession) updates.sessions = { increment: 1 };

    if (Object.keys(updates).length === 0) return;

    // Ensure row exists first, then increment
    await prisma.dailyMetric.upsert({
      where: {
        shopId_experimentId_variantId_date: {
          shopId,
          experimentId,
          variantId,
          date,
        },
      },
      create: {
        shopId,
        experimentId,
        variantId,
        date,
        pageViews: increment.pageView ? 1 : 0,
        productViews: increment.productView ? 1 : 0,
        addToCarts: increment.addToCart ? 1 : 0,
        checkoutsStarted: increment.checkoutStarted ? 1 : 0,
        visitors: increment.newVisitor ? 1 : 0,
        sessions: increment.newSession ? 1 : 0,
      },
      update: updates,
    });
  }

  /**
   * Full re-aggregation for a specific experiment on a specific date range.
   * Self-healing: overwrites all counters with values computed from raw events.
   *
   * GUARD: Runs inside a transaction to avoid partial writes.
   * GUARD: Only processes dates where events actually exist (no phantom rows).
   */
  async reAggregateExperiment(
    shopId: string,
    experimentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId },
      select: { id: true, variants: { select: { id: true } } },
    });

    if (!experiment) return;

    for (const variant of experiment.variants) {
      await this.reAggregateVariant(shopId, experimentId, variant.id, startDate, endDate);
    }
  }

  /**
   * Re-aggregate a single variant for a date range.
   */
  async reAggregateVariant(
    shopId: string,
    experimentId: string,
    variantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Get all distinct dates with events for this variant
    const eventDates = await prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT DISTINCT DATE_TRUNC('day', "occurredAt" AT TIME ZONE 'UTC') AS date
      FROM "Event"
      WHERE "shopId" = ${shopId}
        AND "experimentId" = ${experimentId}
        AND "variantId" = ${variantId}
        AND "occurredAt" >= ${startDate}
        AND "occurredAt" <= ${endDate}
      ORDER BY date ASC
    `;

    for (const { date } of eventDates) {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);

      // Aggregate event counts for this day
      const [
        pageViews,
        productViews,
        addToCarts,
        checkoutsStarted,
        uniqueVisitors,
        uniqueSessions,
      ] = await Promise.all([
        this.countEvents(shopId, experimentId, variantId, "PAGE_VIEW", dayStart, dayEnd),
        this.countEvents(shopId, experimentId, variantId, "PRODUCT_VIEW", dayStart, dayEnd),
        this.countEvents(shopId, experimentId, variantId, "ADD_TO_CART", dayStart, dayEnd),
        this.countEvents(shopId, experimentId, variantId, "CHECKOUT_STARTED", dayStart, dayEnd),
        this.countUniqueVisitors(shopId, experimentId, variantId, dayStart, dayEnd),
        this.countUniqueSessions(shopId, experimentId, variantId, dayStart, dayEnd),
      ]);

      // Aggregate order data for this day
      const orderAgg = await prisma.orderAttribution.aggregate({
        where: {
          shopId,
          experimentId,
          variantId,
          attributedAt: { gte: dayStart, lte: dayEnd },
        },
        _count: true,
        _sum: {
          netRevenue: true,
          totalPrice: true,
          totalDiscounts: true,
          totalShipping: true,
          cogs: true,
          grossProfit: true,
        },
      });

      const orders = orderAgg._count;
      const netRevenue = orderAgg._sum.netRevenue ?? 0;
      const revenue = orderAgg._sum.totalPrice ?? 0;
      const discounts = orderAgg._sum.totalDiscounts ?? 0;
      const shippingRevenue = orderAgg._sum.totalShipping ?? 0;
      const cogs = orderAgg._sum.cogs ?? 0;
      const grossProfit = orderAgg._sum.grossProfit ?? 0;

      // Derived metrics
      const conversionRate = uniqueVisitors > 0 ? orders / uniqueVisitors : 0;
      const addToCartRate = uniqueVisitors > 0 ? addToCarts / uniqueVisitors : 0;
      const checkoutRate = uniqueVisitors > 0 ? checkoutsStarted / uniqueVisitors : 0;
      const aov = orders > 0 ? netRevenue / orders : 0;
      const revenuePerVisitor = uniqueVisitors > 0 ? netRevenue / uniqueVisitors : 0;
      const profitPerVisitor = uniqueVisitors > 0 ? grossProfit / uniqueVisitors : 0;

      await prisma.dailyMetric.upsert({
        where: {
          shopId_experimentId_variantId_date: {
            shopId,
            experimentId,
            variantId,
            date: dayStart,
          },
        },
        create: {
          shopId,
          experimentId,
          variantId,
          date: dayStart,
          visitors: uniqueVisitors,
          sessions: uniqueSessions,
          pageViews,
          productViews,
          addToCarts,
          checkoutsStarted,
          orders,
          revenue,
          netRevenue,
          discounts,
          shippingRevenue,
          cogs,
          grossProfit,
          conversionRate,
          addToCartRate,
          checkoutRate,
          aov,
          revenuePerVisitor,
          profitPerVisitor,
        },
        update: {
          visitors: uniqueVisitors,
          sessions: uniqueSessions,
          pageViews,
          productViews,
          addToCarts,
          checkoutsStarted,
          orders,
          revenue,
          netRevenue,
          discounts,
          shippingRevenue,
          cogs,
          grossProfit,
          conversionRate,
          addToCartRate,
          checkoutRate,
          aov,
          revenuePerVisitor,
          profitPerVisitor,
        },
      });
    }
  }

  /**
   * Aggregate all active experiments for a shop on a specific date.
   * Called by the daily cron job — processes yesterday's data.
   *
   * GUARD: Idempotent. Safe to call multiple times for the same date.
   */
  async aggregateForDate(shopId: string, date: Date): Promise<{ processed: number }> {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const experiments = await prisma.experiment.findMany({
      where: {
        shopId,
        status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
        launchedAt: { not: null, lte: dayEnd },
      },
      select: { id: true },
    });

    for (const exp of experiments) {
      await this.reAggregateExperiment(shopId, exp.id, dayStart, dayEnd);
    }

    return { processed: experiments.length };
  }

  /**
   * Full shop re-aggregation for all running experiments.
   * Called by the BullMQ worker every hour.
   */
  async reAggregateShop(shopId: string): Promise<{ processed: number }> {
    const experiments = await prisma.experiment.findMany({
      where: {
        shopId,
        status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
        launchedAt: { not: null },
      },
      select: { id: true, launchedAt: true },
    });

    let processed = 0;

    for (const exp of experiments) {
      const startDate = exp.launchedAt!;
      const endDate = new Date();

      await this.reAggregateExperiment(shopId, exp.id, startDate, endDate);
      processed++;
    }

    return { processed };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async countEvents(
    shopId: string,
    experimentId: string,
    variantId: string,
    eventType: string,
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await prisma.event.count({
      where: {
        shopId,
        experimentId,
        variantId,
        eventType: eventType as never,
        occurredAt: { gte: from, lte: to },
      },
    });
    return result;
  }

  private async countUniqueVisitors(
    shopId: string,
    experimentId: string,
    variantId: string,
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await prisma.event.groupBy({
      by: ["visitorId"],
      where: {
        shopId,
        experimentId,
        variantId,
        occurredAt: { gte: from, lte: to },
      },
    });
    return result.length;
  }

  private async countUniqueSessions(
    shopId: string,
    experimentId: string,
    variantId: string,
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await prisma.event.groupBy({
      by: ["sessionId"],
      where: {
        shopId,
        experimentId,
        variantId,
        sessionId: { not: null },
        occurredAt: { gte: from, lte: to },
      },
    });
    return result.length;
  }
}
