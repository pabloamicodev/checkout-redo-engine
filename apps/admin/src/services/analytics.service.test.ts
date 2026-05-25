import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "./analytics.service";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
    },
    dailyMetric: {
      findMany: vi.fn(),
    },
    experimentAssignment: {
      groupBy: vi.fn(),
    },
    event: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { ANALYTICS_DAILY: 300 },
}));

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

const mockExperimentFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockDailyMetricFindMany = vi.mocked(prisma.dailyMetric.findMany);
const mockAssignmentGroupBy = vi.mocked(prisma.experimentAssignment.groupBy);
const mockEventGroupBy = vi.mocked(prisma.event.groupBy);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockQueryRawUnsafe = vi.mocked(prisma.$queryRawUnsafe);
const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);

// ─── Factories ────────────────────────────────────────────────────────────────

const SHOP_ID = "shop-1";
const EXP_ID = "exp-1";
const CTRL_VAR_ID = "var-ctrl";
const TEST_VAR_ID = "var-test";

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    shopId: SHOP_ID,
    name: "Price Test",
    createdAt: new Date("2024-01-01"),
    launchedAt: new Date("2024-01-01"),
    variants: [
      { id: CTRL_VAR_ID, key: "control", name: "Control", isControl: true },
      { id: TEST_VAR_ID, key: "variant-a", name: "Variant A", isControl: false },
    ],
    ...overrides,
  };
}

function makeDailyMetric(variantId: string, overrides: Record<string, unknown> = {}) {
  return {
    variantId,
    visitors: 1000,
    sessions: 900,
    pageViews: 3000,
    addToCarts: 300,
    checkoutsStarted: 100,
    orders: 30,
    revenue: 3000,
    netRevenue: 2700,
    discounts: 200,
    shippingRevenue: 100,
    cogs: 900,
    grossProfit: 1800,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
});

// ─── getExperimentAnalytics ───────────────────────────────────────────────────

describe("AnalyticsService.getExperimentAnalytics", () => {
  const service = new AnalyticsService();

  it("returns null when experiment is not found", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(null);
    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result).toBeNull();
  });

  it("returns cached result when cache is populated", async () => {
    const cached = { experimentId: EXP_ID, experimentName: "cached", variants: [], summary: {} };
    mockCacheGet.mockResolvedValueOnce(cached as never);
    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result).toEqual(cached);
    expect(mockExperimentFindFirst).not.toHaveBeenCalled();
  });

  it("computes conversion rates correctly", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, orders: 30 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, orders: 40 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);

    expect(result).not.toBeNull();
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.conversionRate).toBeCloseTo(0.03, 3);
    expect(test.conversionRate).toBeCloseTo(0.04, 3);
  });

  it("computes revenuePerVisitor correctly", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, netRevenue: 2000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, netRevenue: 2500 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.revenuePerVisitor).toBeCloseTo(2.0, 2);
    expect(test.revenuePerVisitor).toBeCloseTo(2.5, 2);
  });

  it("computes profitPerVisitor correctly", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, grossProfit: 800 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, grossProfit: 900 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.profitPerVisitor).toBeCloseTo(0.8, 2);
    expect(test.profitPerVisitor).toBeCloseTo(0.9, 2);
  });

  it("computes AOV correctly", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { orders: 10, netRevenue: 1000 }),
      makeDailyMetric(TEST_VAR_ID, { orders: 20, netRevenue: 2200 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.aov).toBeCloseTo(100, 1);
    expect(test.aov).toBeCloseTo(110, 1);
  });

  it("accumulates metrics from multiple daily metric rows", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    // Two days of data for control
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 500, orders: 15, netRevenue: 1000 }),
      makeDailyMetric(CTRL_VAR_ID, { visitors: 500, orders: 15, netRevenue: 1000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, orders: 40, netRevenue: 2500 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;

    expect(ctrl.visitors).toBe(1000);
    expect(ctrl.orders).toBe(30);
    expect(ctrl.netRevenue).toBe(2000);
  });

  it("detects winner when variant has significantly higher conversion rate", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 10000, orders: 300, netRevenue: 9000, grossProfit: 3000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 10000, orders: 390, netRevenue: 11700, grossProfit: 3900 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.summary.hasWinner).toBe(true);
    expect(result!.summary.winnerVariantId).toBe(TEST_VAR_ID);
  });

  it("sets peekingWarning when winner declared but fewer than 7 days running", async () => {
    const recentLaunch = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment({ launchedAt: recentLaunch }) as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 10000, orders: 300, netRevenue: 9000, grossProfit: 3000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 10000, orders: 390, netRevenue: 11700, grossProfit: 3900 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.summary.peekingWarning).toBe(true);
  });

  it("does not set peekingWarning when no winner", async () => {
    const recentLaunch = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment({ launchedAt: recentLaunch }) as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 100, orders: 3, netRevenue: 300, grossProfit: 100 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 100, orders: 4, netRevenue: 400, grossProfit: 130 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.summary.peekingWarning).toBe(false);
  });

  it("control variant appears first in the sorted list", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, netRevenue: 5000 }), // higher RPV
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, netRevenue: 2000 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.variants[0]!.isControl).toBe(true);
  });

  it("visitorsNeeded is null when variant has enough visitors", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    // 15% CVR → minimum sample size ~26k; 100k visitors safely exceeds that
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 100000, orders: 15000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 100000, orders: 16000 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    expect(ctrl.visitorsNeeded).toBeNull();
  });

  it("visitorsNeeded is positive when not enough visitors", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 100, orders: 3 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 100, orders: 4 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    expect(ctrl.visitorsNeeded).toBeGreaterThan(0);
  });

  it("handles zero-visitor variants without throwing", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 0, orders: 0 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 0, orders: 0 }),
    ] as never);

    await expect(service.getExperimentAnalytics(SHOP_ID, EXP_ID)).resolves.not.toThrow();
  });

  it("caches result after first fetch", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID),
      makeDailyMetric(TEST_VAR_ID),
    ] as never);

    await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(mockCacheSet).toHaveBeenCalledOnce();
  });

  it("computes summary totals as sum across all variants", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, orders: 30, netRevenue: 2000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1100, orders: 44, netRevenue: 2500 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.summary.totalVisitors).toBe(2100);
    expect(result!.summary.totalOrders).toBe(74);
    expect(result!.summary.totalRevenue).toBe(4500);
  });

  it("skips metrics rows with null variantId", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      { variantId: null, visitors: 999, orders: 50, netRevenue: 5000 },
      makeDailyMetric(CTRL_VAR_ID, { visitors: 1000, orders: 30 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 1000, orders: 40 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    expect(result!.summary.totalVisitors).toBe(2000); // null row excluded
  });

  it("attaches statistical test results to non-control variants", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDailyMetricFindMany.mockResolvedValueOnce([
      makeDailyMetric(CTRL_VAR_ID, { visitors: 10000, orders: 300, netRevenue: 9000, grossProfit: 3000 }),
      makeDailyMetric(TEST_VAR_ID, { visitors: 10000, orders: 390, netRevenue: 11700, grossProfit: 3900 }),
    ] as never);

    const result = await service.getExperimentAnalytics(SHOP_ID, EXP_ID);
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.conversionRateTest).toBeUndefined();
    expect(test.conversionRateTest).toBeDefined();
    expect(test.revenuePerVisitorTest).toBeDefined();
  });
});

// ─── getSegmentBreakdown ──────────────────────────────────────────────────────

describe("AnalyticsService.getSegmentBreakdown", () => {
  const service = new AnalyticsService();

  it("returns null when experiment is not found", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(null);
    const result = await service.getSegmentBreakdown(SHOP_ID, EXP_ID, "deviceType");
    expect(result).toBeNull();
  });

  it("returns null for invalid dimension (SQL injection guard)", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    const result = await service.getSegmentBreakdown(SHOP_ID, EXP_ID, "'; DROP TABLE events; --" as never);
    expect(result).toBeNull();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it("accepts valid dimensions: deviceType, country, utmSource", async () => {
    const validDimensions = ["deviceType", "country", "utmSource"] as const;
    for (const dim of validDimensions) {
      mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
      mockQueryRawUnsafe.mockResolvedValueOnce([] as never);
      const result = await service.getSegmentBreakdown(SHOP_ID, EXP_ID, dim);
      expect(result).not.toBeNull();
    }
  });

  it("maps variant IDs to keys/names in result", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockQueryRawUnsafe.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, dimensionValue: "mobile", visitors: BigInt(200) },
      { variantId: TEST_VAR_ID, dimensionValue: "desktop", visitors: BigInt(500) },
    ] as never);

    const result = await service.getSegmentBreakdown(SHOP_ID, EXP_ID, "deviceType");
    expect(result).toHaveLength(2);
    expect(result![0]!.variantKey).toBe("control");
    expect(result![1]!.variantKey).toBe("variant-a");
    expect(result![0]!.visitors).toBe(200); // BigInt converted to number
  });
});

// ─── getCustomEventMetrics ────────────────────────────────────────────────────

describe("AnalyticsService.getCustomEventMetrics", () => {
  const service = new AnalyticsService();

  it("returns null when experiment is not found", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(null);
    const result = await service.getCustomEventMetrics(SHOP_ID, EXP_ID, "signup");
    expect(result).toBeNull();
  });

  it("computes conversionRate per variant", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    // Total visitors per variant
    mockAssignmentGroupBy.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, _count: { visitorId: 1000 } },
      { variantId: TEST_VAR_ID, _count: { visitorId: 1000 } },
    ] as never);
    // Event count per variant
    mockEventGroupBy.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, _count: { id: 50 } },
      { variantId: TEST_VAR_ID, _count: { id: 80 } },
    ] as never);
    // Unique visitors who triggered the event
    mockQueryRaw.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, uniqueVisitors: BigInt(40) },
      { variantId: TEST_VAR_ID, uniqueVisitors: BigInt(70) },
    ] as never);

    const result = await service.getCustomEventMetrics(SHOP_ID, EXP_ID, "signup");
    expect(result).not.toBeNull();
    expect(result!.eventName).toBe("signup");

    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.conversionRate).toBeCloseTo(0.04, 3); // 40/1000
    expect(test.conversionRate).toBeCloseTo(0.07, 3); // 70/1000
  });

  it("attaches z-test to non-control variants", async () => {
    mockExperimentFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockAssignmentGroupBy.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, _count: { visitorId: 10000 } },
      { variantId: TEST_VAR_ID, _count: { visitorId: 10000 } },
    ] as never);
    mockEventGroupBy.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, _count: { id: 300 } },
      { variantId: TEST_VAR_ID, _count: { id: 400 } },
    ] as never);
    mockQueryRaw.mockResolvedValueOnce([
      { variantId: CTRL_VAR_ID, uniqueVisitors: BigInt(300) },
      { variantId: TEST_VAR_ID, uniqueVisitors: BigInt(400) },
    ] as never);

    const result = await service.getCustomEventMetrics(SHOP_ID, EXP_ID, "custom_click");
    const ctrl = result!.variants.find((v) => v.isControl)!;
    const test = result!.variants.find((v) => !v.isControl)!;

    expect(ctrl.test).toBeUndefined();
    expect(test.test).toBeDefined();
    expect(test.test!.isSignificant).toBe(true);
  });
});
