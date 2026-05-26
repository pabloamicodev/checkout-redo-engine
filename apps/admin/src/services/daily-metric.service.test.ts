import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyMetricService } from "./daily-metric.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyMetric: { upsert: vi.fn() },
    experiment: { findFirst: vi.fn(), findMany: vi.fn() },
    orderAttribution: { aggregate: vi.fn() },
    event: { count: vi.fn(), groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockDailyUpsert = vi.mocked(prisma.dailyMetric.upsert);
const mockExperimentFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockExperimentFindMany = vi.mocked(prisma.experiment.findMany);
const mockOrderAggregate = vi.mocked(prisma.orderAttribution.aggregate);
const mockEventCount = vi.mocked(prisma.event.count);
const mockEventGroupBy = vi.mocked(prisma.event.groupBy);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

const SHOP_ID = "shop-1";
const EXP_ID = "exp-1";
const VARIANT_ID = "var-1";

describe("DailyMetricService", () => {
  let service: DailyMetricService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DailyMetricService();
    mockDailyUpsert.mockResolvedValue({} as never);
    mockExperimentFindFirst.mockResolvedValue({
      id: EXP_ID,
      variants: [{ id: "var-1" }, { id: "var-2" }],
    } as never);
    mockExperimentFindMany.mockResolvedValue([] as never);
    mockQueryRaw.mockResolvedValue([] as never);
    mockEventCount.mockResolvedValue(0);
    mockEventGroupBy.mockResolvedValue([] as never);
    mockOrderAggregate.mockResolvedValue({
      _count: 0,
      _sum: {
        netRevenue: 0,
        totalPrice: 0,
        totalDiscounts: 0,
        totalShipping: 0,
        cogs: 0,
        grossProfit: 0,
      },
    } as never);
  });

  describe("incrementFromEvent", () => {
    it("returns early when no increment flags are set", async () => {
      await service.incrementFromEvent({
        shopId: SHOP_ID,
        experimentId: EXP_ID,
        variantId: VARIANT_ID,
        date: new Date("2026-03-03T10:00:00.000Z"),
      });

      expect(mockDailyUpsert).not.toHaveBeenCalled();
    });

    it("normalizes date to UTC midnight and increments matching counters", async () => {
      await service.incrementFromEvent({
        shopId: SHOP_ID,
        experimentId: EXP_ID,
        variantId: VARIANT_ID,
        date: new Date("2026-03-03T10:00:00.000Z"),
        pageView: true,
        addToCart: true,
        newVisitor: true,
      });

      expect(mockDailyUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId_experimentId_variantId_date: {
              shopId: SHOP_ID,
              experimentId: EXP_ID,
              variantId: VARIANT_ID,
              date: new Date("2026-03-03T00:00:00.000Z"),
            },
          },
          create: expect.objectContaining({ pageViews: 1, addToCarts: 1, visitors: 1 }),
          update: expect.objectContaining({
            pageViews: { increment: 1 },
            addToCarts: { increment: 1 },
            visitors: { increment: 1 },
          }),
        })
      );
    });
  });

  describe("reAggregateExperiment", () => {
    it("returns when experiment does not exist", async () => {
      mockExperimentFindFirst.mockResolvedValueOnce(null);
      const spy = vi.spyOn(service, "reAggregateVariant");

      await service.reAggregateExperiment(SHOP_ID, EXP_ID, new Date("2026-01-01"), new Date("2026-01-02"));
      expect(spy).not.toHaveBeenCalled();
    });

    it("re-aggregates each variant in the experiment", async () => {
      const spy = vi.spyOn(service, "reAggregateVariant").mockResolvedValue();

      await service.reAggregateExperiment(SHOP_ID, EXP_ID, new Date("2026-01-01"), new Date("2026-01-02"));

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(SHOP_ID, EXP_ID, "var-1", expect.any(Date), expect.any(Date));
      expect(spy).toHaveBeenCalledWith(SHOP_ID, EXP_ID, "var-2", expect.any(Date), expect.any(Date));
    });
  });

  describe("reAggregateVariant", () => {
    it("does nothing when query returns no event dates", async () => {
      mockQueryRaw.mockResolvedValueOnce([] as never);

      await service.reAggregateVariant(SHOP_ID, EXP_ID, VARIANT_ID, new Date("2026-01-01"), new Date("2026-01-31"));
      expect(mockDailyUpsert).not.toHaveBeenCalled();
    });

    it("computes derived metrics safely when visitors/orders are zero", async () => {
      mockQueryRaw.mockResolvedValueOnce([{ date: new Date("2026-04-10T00:00:00.000Z") }] as never);
      mockEventCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockEventGroupBy.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);
      mockOrderAggregate.mockResolvedValueOnce({
        _count: 0,
        _sum: {
          netRevenue: 0,
          totalPrice: 0,
          totalDiscounts: 0,
          totalShipping: 0,
          cogs: 0,
          grossProfit: 0,
        },
      } as never);

      await service.reAggregateVariant(SHOP_ID, EXP_ID, VARIANT_ID, new Date("2026-04-01"), new Date("2026-04-30"));

      expect(mockDailyUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            conversionRate: 0,
            addToCartRate: 0,
            checkoutRate: 0,
            aov: 0,
            revenuePerVisitor: 0,
            profitPerVisitor: 0,
          }),
        })
      );
    });

    it("aggregates event and order totals and calculates rates", async () => {
      mockQueryRaw.mockResolvedValueOnce([{ date: new Date("2026-05-01T00:00:00.000Z") }] as never);
      mockEventCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(20);
      mockEventGroupBy
        .mockResolvedValueOnce(new Array(40).fill({ visitorId: "v" }) as never)
        .mockResolvedValueOnce(new Array(30).fill({ sessionId: "s" }) as never);
      mockOrderAggregate.mockResolvedValueOnce({
        _count: 10,
        _sum: {
          netRevenue: 500,
          totalPrice: 600,
          totalDiscounts: 50,
          totalShipping: 20,
          cogs: 200,
          grossProfit: 300,
        },
      } as never);

      await service.reAggregateVariant(SHOP_ID, EXP_ID, VARIANT_ID, new Date("2026-05-01"), new Date("2026-05-31"));

      expect(mockDailyUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            visitors: 40,
            sessions: 30,
            pageViews: 100,
            productViews: 50,
            addToCarts: 25,
            checkoutsStarted: 20,
            orders: 10,
            revenue: 600,
            netRevenue: 500,
            conversionRate: 0.25,
            addToCartRate: 0.625,
            checkoutRate: 0.5,
            aov: 50,
            revenuePerVisitor: 12.5,
            profitPerVisitor: 7.5,
          }),
        })
      );
    });
  });

  describe("aggregate methods", () => {
    it("aggregateForDate re-aggregates all eligible experiments for the day", async () => {
      mockExperimentFindMany.mockResolvedValueOnce([{ id: "e1" }, { id: "e2" }] as never);
      const spy = vi.spyOn(service, "reAggregateExperiment").mockResolvedValue();

      const result = await service.aggregateForDate(SHOP_ID, new Date("2026-06-15T15:00:00.000Z"));

      expect(result).toEqual({ processed: 2 });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(
        1,
        SHOP_ID,
        "e1",
        new Date("2026-06-15T00:00:00.000Z"),
        new Date("2026-06-15T23:59:59.999Z")
      );
    });

    it("reAggregateShop uses launchedAt as start date and counts processed experiments", async () => {
      mockExperimentFindMany.mockResolvedValueOnce([
        { id: "e1", launchedAt: new Date("2026-01-01T00:00:00.000Z") },
        { id: "e2", launchedAt: new Date("2026-02-01T00:00:00.000Z") },
      ] as never);
      const spy = vi.spyOn(service, "reAggregateExperiment").mockResolvedValue();

      const result = await service.reAggregateShop(SHOP_ID);

      expect(result).toEqual({ processed: 2 });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(SHOP_ID, "e1", new Date("2026-01-01T00:00:00.000Z"), expect.any(Date));
      expect(spy).toHaveBeenCalledWith(SHOP_ID, "e2", new Date("2026-02-01T00:00:00.000Z"), expect.any(Date));
    });
  });
});
