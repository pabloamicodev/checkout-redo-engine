/**
 * ClickHouseAnalyticsAdapter — drop-in replacement for AnalyticsService.
 *
 * Enabled by setting USE_CLICKHOUSE=true in the environment.
 * Requires CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD env vars.
 *
 * Uses the same ExperimentAnalytics / VariantMetrics interfaces so callers
 * never need to know which adapter is active.
 */

import { twoProportionZTest, welchTTest } from "@/lib/statistics";
import type {
  ExperimentAnalytics,
  VariantMetrics,
  SegmentDimension,
  SegmentItem,
} from "@/services/analytics.service";

// Guard: ClickHouse adapter is only instantiated when the env var is set
function getClickHouseUrl(): string {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) throw new Error("CLICKHOUSE_URL is required when USE_CLICKHOUSE=true");
  return url;
}

interface ClickHouseQueryResult<T> {
  data: T[];
  rows: number;
}

interface DailyMetricRow {
  variantId: string;
  variantKey: string;
  variantName: string;
  isControl: number;
  visitors: string;
  sessions: string;
  pageViews: string;
  addToCarts: string;
  checkoutsStarted: string;
  orders: string;
  revenue: string;
  netRevenue: string;
  discounts: string;
  shippingRevenue: string;
  cogs: string;
  grossProfit: string;
  // For Welch's t-test approximation
  revenueVariance: string;
}

interface ExperimentInfoRow {
  id: string;
  name: string;
  launchedAt: string | null;
  createdAt: string;
}

async function queryClickHouse<T>(
  sql: string,
  params: Record<string, string | number> = {}
): Promise<ClickHouseQueryResult<T>> {
  const baseUrl = getClickHouseUrl();
  const user = process.env.CLICKHOUSE_USER ?? "default";
  const password = process.env.CLICKHOUSE_PASSWORD ?? "";

  // Substitute named params safely — ClickHouse native params via query params
  const url = new URL(baseUrl);
  url.searchParams.set("query", sql);
  url.searchParams.set("default_format", "JSONEachRow");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`param_${key}`, String(value));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-ClickHouse-User": user,
      "X-ClickHouse-Key": password,
    },
    // GUARD: 30s timeout for analytics queries
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickHouse query failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  const rows = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

  return { data: rows, rows: rows.length };
}

export class ClickHouseAnalyticsAdapter {
  async getExperimentAnalytics(
    shopId: string,
    experimentId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<ExperimentAnalytics | null> {
    const startDate = dateRange?.start?.toISOString() ?? "1970-01-01 00:00:00";
    const endDate = dateRange?.end?.toISOString() ?? new Date().toISOString();

    // Fetch experiment metadata
    const expResult = await queryClickHouse<ExperimentInfoRow>(
      `SELECT id, name, launchedAt, createdAt
       FROM experiments
       WHERE id = {experimentId:String} AND shopId = {shopId:String}
       LIMIT 1`,
      { experimentId, shopId }
    );

    if (!expResult.data.length) return null;
    const exp = expResult.data[0]!;

    const effectiveStart = exp.launchedAt ?? exp.createdAt;

    // Fetch aggregated daily metrics per variant
    const metricsResult = await queryClickHouse<DailyMetricRow>(
      `SELECT
         v.id AS variantId,
         v.key AS variantKey,
         v.name AS variantName,
         v.isControl AS isControl,
         SUM(dm.visitors) AS visitors,
         SUM(dm.sessions) AS sessions,
         SUM(dm.pageViews) AS pageViews,
         SUM(dm.addToCarts) AS addToCarts,
         SUM(dm.checkoutsStarted) AS checkoutsStarted,
         SUM(dm.orders) AS orders,
         SUM(dm.revenue) AS revenue,
         SUM(dm.netRevenue) AS netRevenue,
         SUM(dm.discounts) AS discounts,
         SUM(dm.shippingRevenue) AS shippingRevenue,
         SUM(dm.cogs) AS cogs,
         SUM(dm.grossProfit) AS grossProfit,
         varPop(dm.revenuePerVisitor) AS revenueVariance
       FROM daily_metrics dm
       JOIN variants v ON v.id = dm.variantId
       WHERE dm.shopId = {shopId:String}
         AND dm.experimentId = {experimentId:String}
         AND dm.date BETWEEN {startDate:String} AND {endDate:String}
       GROUP BY v.id, v.key, v.name, v.isControl`,
      { shopId, experimentId, startDate, endDate }
    );

    if (!metricsResult.data.length) return null;

    // Build VariantMetrics from rows
    const variantMetrics: VariantMetrics[] = metricsResult.data.map((row) => {
      const visitors = Number(row.visitors);
      const orders = Number(row.orders);
      const revenue = Number(row.revenue);
      const netRevenue = Number(row.netRevenue);
      const grossProfit = Number(row.grossProfit);
      const addToCarts = Number(row.addToCarts);
      const checkoutsStarted = Number(row.checkoutsStarted);

      const conversionRate = visitors > 0 ? orders / visitors : 0;
      const aov = orders > 0 ? revenue / orders : 0;
      const revenuePerVisitor = visitors > 0 ? revenue / visitors : 0;
      const profitPerVisitor = visitors > 0 ? grossProfit / visitors : 0;

      return {
        variantId: row.variantId,
        variantKey: row.variantKey,
        variantName: row.variantName,
        isControl: Boolean(row.isControl),
        visitors,
        sessions: Number(row.sessions),
        pageViews: Number(row.pageViews),
        addToCarts,
        checkoutsStarted,
        orders,
        revenue,
        netRevenue,
        discounts: Number(row.discounts),
        shippingRevenue: Number(row.shippingRevenue),
        cogs: Number(row.cogs),
        grossProfit,
        conversionRate,
        addToCartRate: visitors > 0 ? addToCarts / visitors : 0,
        checkoutRate: visitors > 0 ? checkoutsStarted / visitors : 0,
        aov,
        revenuePerVisitor,
        profitPerVisitor,
        visitorsNeeded: null, // ClickHouse path: calculated post-hoc if needed
        revenueVariance: Number(row.revenueVariance),
      } as VariantMetrics & { revenueVariance: number };
    });

    // Compute statistical tests vs control
    const control = variantMetrics.find((v) => v.isControl);
    if (control) {
      const controlVariance = (control as VariantMetrics & { revenueVariance?: number }).revenueVariance ?? 0;
      for (const v of variantMetrics) {
        if (v.isControl) continue;
        v.conversionRateTest = twoProportionZTest(
          { visitors: control.visitors, conversions: control.orders, totalRevenue: control.revenue, totalProfit: control.grossProfit },
          { visitors: v.visitors, conversions: v.orders, totalRevenue: v.revenue, totalProfit: v.grossProfit }
        );
        const vVariance = (v as VariantMetrics & { revenueVariance?: number }).revenueVariance ?? 0;
        v.revenuePerVisitorTest = welchTTest(
          control.revenuePerVisitor, controlVariance, control.visitors,
          v.revenuePerVisitor, vVariance, v.visitors
        );
      }
    }

    const totalVisitors = variantMetrics.reduce((s, v) => s + v.visitors, 0);
    const totalOrders = variantMetrics.reduce((s, v) => s + v.orders, 0);
    const totalRevenue = variantMetrics.reduce((s, v) => s + v.revenue, 0);

    const launchedAt = exp.launchedAt ? new Date(exp.launchedAt) : new Date(exp.createdAt);
    const now = new Date();
    const daysRunning = Math.max(1, Math.ceil((now.getTime() - launchedAt.getTime()) / 86400000));

    const winner = variantMetrics.find(
      (v) => !v.isControl && v.conversionRateTest?.isSignificant && v.conversionRateTest.relativeLift > 0
    );

    return {
      experimentId,
      experimentName: exp.name,
      dateRange: { start: new Date(effectiveStart), end: new Date(endDate) },
      variants: variantMetrics,
      summary: {
        totalVisitors,
        totalOrders,
        totalRevenue,
        daysRunning,
        hasWinner: !!winner,
        winnerVariantId: winner?.variantId ?? null,
        peekingWarning: !!winner && daysRunning < 7,
      },
    };
  }

  async getSegmentBreakdown(
    shopId: string,
    experimentId: string,
    dimension: SegmentDimension,
    dateRange?: { start: Date; end: Date }
  ): Promise<SegmentItem[]> {
    const startDate = dateRange?.start?.toISOString() ?? "1970-01-01 00:00:00";
    const endDate = dateRange?.end?.toISOString() ?? new Date().toISOString();

    const columnMap: Record<SegmentDimension, string> = {
      deviceType: "a.deviceType",
      country: "a.country",
      utmSource: "a.utmSource",
    };
    const column = columnMap[dimension];

    const result = await queryClickHouse<{
      dimensionValue: string;
      variantId: string;
      variantKey: string;
      variantName: string;
      visitors: string;
    }>(
      `SELECT
         ${column} AS dimensionValue,
         v.id AS variantId,
         v.key AS variantKey,
         v.name AS variantName,
         count(DISTINCT a.visitorId) AS visitors
       FROM assignments a
       JOIN variants v ON v.id = a.variantId
       WHERE a.shopId = {shopId:String}
         AND a.experimentId = {experimentId:String}
         AND a.assignedAt BETWEEN {startDate:String} AND {endDate:String}
         AND ${column} IS NOT NULL
         AND ${column} != ''
       GROUP BY dimensionValue, v.id, v.key, v.name
       ORDER BY visitors DESC
       LIMIT 500`,
      { shopId, experimentId, startDate, endDate }
    );

    return result.data.map((row) => ({
      dimensionValue: row.dimensionValue,
      variantId: row.variantId,
      variantKey: row.variantKey,
      variantName: row.variantName,
      visitors: Number(row.visitors),
    }));
  }
}

/**
 * Returns the appropriate analytics adapter based on the USE_CLICKHOUSE env var.
 * Import this factory instead of instantiating adapters directly.
 */
export async function getAnalyticsAdapter(): Promise<
  import("@/services/analytics.service").AnalyticsService | ClickHouseAnalyticsAdapter
> {
  if (process.env.USE_CLICKHOUSE === "true") {
    return new ClickHouseAnalyticsAdapter();
  }
  const { AnalyticsService } = await import("@/services/analytics.service");
  return new AnalyticsService();
}
