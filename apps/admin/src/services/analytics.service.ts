/**
 * AnalyticsService — queries DailyMetric aggregates and raw events
 * for experiment performance dashboards.
 *
 * For high-volume stores this can be replaced with a ClickHouse adapter
 * by implementing the same interface with ClickHouse queries.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { twoProportionZTest, welchTTest, minimumSampleSize } from "@/lib/statistics";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/redis";

export interface VariantMetrics {
  variantId: string;
  variantKey: string;
  variantName: string;
  isControl: boolean;

  visitors: number;
  sessions: number;
  pageViews: number;
  addToCarts: number;
  checkoutsStarted: number;
  orders: number;
  revenue: number;
  netRevenue: number;
  discounts: number;
  shippingRevenue: number;
  cogs: number;
  grossProfit: number;

  conversionRate: number;
  addToCartRate: number;
  checkoutRate: number;
  aov: number;
  revenuePerVisitor: number;
  profitPerVisitor: number;

  // Minimum additional visitors needed to reach statistical power (null = already sufficient)
  visitorsNeeded: number | null;

  // Statistical results vs control (null for control itself)
  conversionRateTest?: ReturnType<typeof twoProportionZTest>;
  revenuePerVisitorTest?: ReturnType<typeof welchTTest>;
}

export interface ExperimentAnalytics {
  experimentId: string;
  experimentName: string;
  dateRange: { start: Date; end: Date };
  variants: VariantMetrics[];
  summary: {
    totalVisitors: number;
    totalOrders: number;
    totalRevenue: number;
    daysRunning: number;
    hasWinner: boolean;
    winnerVariantId: string | null;
    // True when a "winner" was detected but the test has run fewer than 7 days.
    // Merchants should be warned against calling a winner too early.
    peekingWarning: boolean;
  };
}

// Segment breakdown — unique visitors grouped by a dimension per variant
export interface SegmentItem {
  dimensionValue: string;
  variantId: string;
  variantKey: string;
  variantName: string;
  visitors: number;
}

export type SegmentDimension = "deviceType" | "country" | "utmSource";

// Allowlist guards against SQL injection when used with Prisma.raw()
const SEGMENT_COLUMN_MAP: Record<SegmentDimension, string> = {
  deviceType: "deviceType",
  country: "country",
  utmSource: "utmSource",
} as const;

export class AnalyticsService {
  async getExperimentAnalytics(
    shopId: string,
    experimentId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<ExperimentAnalytics | null> {
    const cacheKey = `analytics:experiment:${experimentId}:${dateRange?.start?.toISOString() ?? "all"}`;
    const cached = await cacheGet<ExperimentAnalytics>(cacheKey);
    if (cached) return cached;

    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId },
      include: { variants: true },
    });

    if (!experiment) return null;

    const startDate = dateRange?.start ?? experiment.launchedAt ?? experiment.createdAt;
    const endDate = dateRange?.end ?? new Date();

    const metrics = await prisma.dailyMetric.findMany({
      where: {
        shopId,
        experimentId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Build per-variant accumulators
    const accMap = new Map<
      string,
      {
        variantId: string;
        variantKey: string;
        variantName: string;
        isControl: boolean;
        visitors: number;
        sessions: number;
        pageViews: number;
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
    >();

    for (const variant of experiment.variants) {
      accMap.set(variant.id, {
        variantId: variant.id,
        variantKey: variant.key,
        variantName: variant.name,
        isControl: variant.isControl,
        visitors: 0,
        sessions: 0,
        pageViews: 0,
        addToCarts: 0,
        checkoutsStarted: 0,
        orders: 0,
        revenue: 0,
        netRevenue: 0,
        discounts: 0,
        shippingRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }

    for (const m of metrics) {
      if (!m.variantId) continue;
      const acc = accMap.get(m.variantId);
      if (!acc) continue;

      acc.visitors += m.visitors;
      acc.sessions += m.sessions;
      acc.pageViews += m.pageViews;
      acc.addToCarts += m.addToCarts;
      acc.checkoutsStarted += m.checkoutsStarted;
      acc.orders += m.orders;
      acc.revenue += m.revenue;
      acc.netRevenue += m.netRevenue;
      acc.discounts += m.discounts;
      acc.shippingRevenue += m.shippingRevenue;
      acc.cogs += m.cogs;
      acc.grossProfit += m.grossProfit;
    }

    const variantList: VariantMetrics[] = [];
    let controlVariant: VariantMetrics | null = null;

    for (const [, acc] of accMap) {
      const { visitors, orders, netRevenue, grossProfit, addToCarts, checkoutsStarted } = acc;

      // Estimate minimum visitors needed to reach 80% power at 5% MDE, 95% confidence.
      // Use the control's observed conversion rate (or this variant's if control not yet known).
      const baselineCvr = visitors > 0 ? orders / visitors : 0.02;
      const neededPerVariant = minimumSampleSize(baselineCvr, 0.05);
      const visitorsNeeded = visitors >= neededPerVariant ? null : neededPerVariant - visitors;

      const computed: VariantMetrics = {
        ...acc,
        conversionRate: visitors > 0 ? orders / visitors : 0,
        addToCartRate: visitors > 0 ? addToCarts / visitors : 0,
        checkoutRate: visitors > 0 ? checkoutsStarted / visitors : 0,
        aov: orders > 0 ? netRevenue / orders : 0,
        revenuePerVisitor: visitors > 0 ? netRevenue / visitors : 0,
        profitPerVisitor: visitors > 0 ? grossProfit / visitors : 0,
        visitorsNeeded,
      };

      variantList.push(computed);
      if (computed.isControl) controlVariant = computed;
    }

    // Run statistical tests vs control
    if (controlVariant) {
      for (const v of variantList) {
        if (v.isControl) continue;

        v.conversionRateTest = twoProportionZTest(
          {
            visitors: controlVariant.visitors,
            conversions: controlVariant.orders,
            totalRevenue: controlVariant.netRevenue,
            totalProfit: controlVariant.grossProfit,
          },
          {
            visitors: v.visitors,
            conversions: v.orders,
            totalRevenue: v.netRevenue,
            totalProfit: v.grossProfit,
          }
        );

        // Approximate variance from RPV (used for Welch t-test)
        const cRpv = controlVariant.revenuePerVisitor;
        const vRpv = v.revenuePerVisitor;

        v.revenuePerVisitorTest = welchTTest(
          cRpv,
          Math.pow(cRpv * 0.5, 2),
          controlVariant.visitors,
          vRpv,
          Math.pow(vRpv * 0.5, 2),
          v.visitors
        );
      }
    }

    // Control first, then sorted by RPV desc
    variantList.sort((a, b) => {
      if (a.isControl) return -1;
      if (b.isControl) return 1;
      return b.revenuePerVisitor - a.revenuePerVisitor;
    });

    const totalVisitors = variantList.reduce((s, v) => s + v.visitors, 0);
    const totalOrders = variantList.reduce((s, v) => s + v.orders, 0);
    const totalRevenue = variantList.reduce((s, v) => s + v.netRevenue, 0);

    const winners = variantList.filter(
      (v) =>
        !v.isControl &&
        v.conversionRateTest?.isSignificant &&
        v.conversionRateTest.recommendation === "variant"
    );
    const hasWinner = winners.length > 0;
    const winnerVariantId = hasWinner
      ? (winners.sort((a, b) => b.revenuePerVisitor - a.revenuePerVisitor)[0]?.variantId ?? null)
      : null;

    const daysRunning = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Peeking warning: winner declared but test ran fewer than 7 days.
    // Early stopping inflates Type I error rate — merchants should be warned.
    const peekingWarning = hasWinner && daysRunning < 7;

    const result: ExperimentAnalytics = {
      experimentId,
      experimentName: experiment.name,
      dateRange: { start: startDate, end: endDate },
      variants: variantList,
      summary: {
        totalVisitors,
        totalOrders,
        totalRevenue,
        daysRunning,
        hasWinner,
        winnerVariantId,
        peekingWarning,
      },
    };

    await cacheSet(cacheKey, result, CACHE_TTL.ANALYTICS_DAILY);
    return result;
  }

  async getTimeSeriesData(
    shopId: string,
    experimentId: string,
    metric: string,
    dateRange?: { start: Date; end: Date }
  ) {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId },
      include: { variants: true },
    });
    if (!experiment) return null;

    const startDate = dateRange?.start ?? experiment.launchedAt ?? experiment.createdAt;
    const endDate = dateRange?.end ?? new Date();

    const metrics = await prisma.dailyMetric.findMany({
      where: {
        shopId,
        experimentId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    const variantMap = new Map(
      experiment.variants.map((v) => [v.id, { key: v.key, name: v.name, isControl: v.isControl }])
    );

    const byDate = new Map<string, Record<string, number>>();

    for (const m of metrics) {
      if (!m.variantId) continue;
      const variant = variantMap.get(m.variantId);
      if (!variant) continue;

      const dateKey = m.date.toISOString().split("T")[0]!;
      if (!byDate.has(dateKey)) byDate.set(dateKey, { date: m.date.getTime() });

      const dayData = byDate.get(dateKey)!;
      const value = (m as Record<string, unknown>)[metric] as number ?? 0;
      dayData[variant.key] = value;
    }

    return Array.from(byDate.values()).sort((a, b) => (a["date"] ?? 0) - (b["date"] ?? 0));
  }

  // Returns unique visitor counts per dimension value per variant.
  // GUARD: dimension is validated against an allowlist before raw SQL interpolation.
  async getSegmentBreakdown(
    shopId: string,
    experimentId: string,
    dimension: SegmentDimension,
    dateRange?: { start: Date; end: Date }
  ): Promise<SegmentItem[] | null> {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId },
      include: { variants: true },
    });
    if (!experiment) return null;

    // GUARD: only allow known dimension columns
    const col = SEGMENT_COLUMN_MAP[dimension];
    if (!col) return null;

    const startDate = dateRange?.start ?? experiment.launchedAt ?? experiment.createdAt;
    const endDate = dateRange?.end ?? new Date();

    const rows = await prisma.$queryRaw<
      Array<{ variantId: string; dimensionValue: string; visitors: bigint }>
    >(Prisma.sql`
      SELECT
        "variantId",
        ${Prisma.raw(`"${col}"`)} AS "dimensionValue",
        COUNT(DISTINCT "visitorId") AS visitors
      FROM "Event"
      WHERE "shopId" = ${shopId}
        AND "experimentId" = ${experimentId}
        AND ${Prisma.raw(`"${col}"`)} IS NOT NULL
        AND "occurredAt" >= ${startDate}
        AND "occurredAt" <= ${endDate}
      GROUP BY "variantId", ${Prisma.raw(`"${col}"`)}
      ORDER BY visitors DESC
      LIMIT 100
    `);

    const variantMap = new Map(
      experiment.variants.map((v) => [v.id, { key: v.key, name: v.name }])
    );

    return rows.map((r) => ({
      dimensionValue: r.dimensionValue,
      variantId: r.variantId,
      variantKey: variantMap.get(r.variantId)?.key ?? r.variantId,
      variantName: variantMap.get(r.variantId)?.name ?? r.variantId,
      visitors: Number(r.visitors),
    }));
  }

  /**
   * Custom event metrics — count occurrences and unique visitors per variant
   * for a registered custom event name within an experiment.
   *
   * Returns per-variant stats + a two-proportion z-test vs. the control variant
   * so the custom event can serve as a primary or secondary success metric.
   */
  async getCustomEventMetrics(
    shopId: string,
    experimentId: string,
    eventName: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    eventName: string;
    variants: Array<{
      variantId: string;
      variantKey: string;
      variantName: string;
      isControl: boolean;
      totalVisitors: number;
      eventCount: number;
      uniqueVisitors: number;
      conversionRate: number;
      test?: ReturnType<typeof twoProportionZTest>;
    }>;
  } | null> {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, shopId },
      include: { variants: true },
    });
    if (!experiment) return null;

    const startDate = dateRange?.start ?? experiment.launchedAt ?? experiment.createdAt;
    const endDate = dateRange?.end ?? new Date();

    // Total visitors per variant (from assignments, same date window)
    const visitorCounts = await prisma.experimentAssignment.groupBy({
      by: ["variantId"],
      where: {
        shopId,
        experimentId,
        firstSeenAt: { gte: startDate, lte: endDate },
      },
      _count: { visitorId: true },
    });
    const visitorMap = new Map(
      visitorCounts.map((r) => [r.variantId, r._count.visitorId])
    );

    // Custom event occurrences per variant
    const eventCounts = await prisma.event.groupBy({
      by: ["variantId"],
      where: {
        shopId,
        experimentId,
        eventName,
        occurredAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });
    const eventCountMap = new Map(
      eventCounts.map((r) => [r.variantId ?? "", r._count.id])
    );

    // Unique visitors who triggered the event per variant
    const uniqueRows = await prisma.$queryRaw<Array<{ variantId: string; uniqueVisitors: bigint }>>`
      SELECT "variantId", COUNT(DISTINCT "visitorId") AS "uniqueVisitors"
      FROM "Event"
      WHERE "shopId" = ${shopId}
        AND "experimentId" = ${experimentId}
        AND "eventName" = ${eventName}
        AND "occurredAt" >= ${startDate}
        AND "occurredAt" <= ${endDate}
      GROUP BY "variantId"
    `;
    const uniqueMap = new Map(
      uniqueRows.map((r) => [r.variantId, Number(r.uniqueVisitors)])
    );

    const variantStats = experiment.variants.map((v) => {
      const totalVisitors = visitorMap.get(v.id) ?? 0;
      const eventCount = eventCountMap.get(v.id) ?? 0;
      const uniqueVisitors = uniqueMap.get(v.id) ?? 0;
      const conversionRate = totalVisitors > 0 ? uniqueVisitors / totalVisitors : 0;
      return { variantId: v.id, variantKey: v.key, variantName: v.name, isControl: v.isControl, totalVisitors, eventCount, uniqueVisitors, conversionRate };
    });

    // Compute z-test vs control for each non-control variant
    const control = variantStats.find((v) => v.isControl);
    const results = variantStats.map((v) => {
      if (v.isControl || !control) return { ...v };
      const test = twoProportionZTest(
        { visitors: control.totalVisitors, conversions: control.uniqueVisitors, totalRevenue: 0, totalProfit: 0 },
        { visitors: v.totalVisitors, conversions: v.uniqueVisitors, totalRevenue: 0, totalProfit: 0 }
      );
      return { ...v, test };
    });

    return { eventName, variants: results };
  }
}
