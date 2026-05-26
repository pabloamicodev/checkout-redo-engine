import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClickHouseAnalyticsAdapter,
  getAnalyticsAdapter,
} from "./clickhouse-analytics.adapter";

vi.mock("@/lib/statistics", () => ({
  twoProportionZTest: vi.fn(() => ({ isSignificant: true, relativeLift: 0.15, pValue: 0.03 })),
  welchTTest: vi.fn(() => ({ isSignificant: false, relativeLift: 0.05, pValue: 0.2 })),
}));

vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class MockAnalyticsService {
    marker = "analytics";
  },
}));

describe("ClickHouseAnalyticsAdapter", () => {
  let adapter: ClickHouseAnalyticsAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClickHouseAnalyticsAdapter();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.CLICKHOUSE_URL = "https://clickhouse.internal";
    process.env.CLICKHOUSE_USER = "test-user";
    process.env.CLICKHOUSE_PASSWORD = "test-pass";
    delete process.env.USE_CLICKHOUSE;
  });

  it("throws when CLICKHOUSE_URL is missing", async () => {
    delete process.env.CLICKHOUSE_URL;
    await expect(adapter.getExperimentAnalytics("shop-1", "exp-1")).rejects.toThrow(
      "CLICKHOUSE_URL is required when USE_CLICKHOUSE=true"
    );
  });

  it("returns null when experiment is not found", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const result = await adapter.getExperimentAnalytics("shop-1", "exp-1");
    expect(result).toBeNull();
  });

  it("returns null when no daily metrics rows exist", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "exp-1",
            name: "Homepage test",
            launchedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "" });

    const result = await adapter.getExperimentAnalytics("shop-1", "exp-1");
    expect(result).toBeNull();
  });

  it("builds analytics summary, computes winner and applies statistical tests", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "exp-1",
            name: "Hero copy test",
            launchedAt: "2026-01-02T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          [
            {
              variantId: "control",
              variantKey: "control",
              variantName: "Control",
              isControl: 1,
              visitors: "100",
              sessions: "80",
              pageViews: "150",
              addToCarts: "40",
              checkoutsStarted: "30",
              orders: "20",
              revenue: "1000",
              netRevenue: "900",
              discounts: "50",
              shippingRevenue: "20",
              cogs: "300",
              grossProfit: "600",
              revenueVariance: "12",
            },
            {
              variantId: "challenger",
              variantKey: "variant_a",
              variantName: "Variant A",
              isControl: 0,
              visitors: "100",
              sessions: "82",
              pageViews: "155",
              addToCarts: "55",
              checkoutsStarted: "40",
              orders: "30",
              revenue: "1600",
              netRevenue: "1450",
              discounts: "80",
              shippingRevenue: "25",
              cogs: "500",
              grossProfit: "950",
              revenueVariance: "18",
            },
          ]
            .map((row) => JSON.stringify(row))
            .join("\n"),
      });

    const result = await adapter.getExperimentAnalytics("shop-1", "exp-1");

    expect(result).not.toBeNull();
    expect(result?.variants).toHaveLength(2);
    expect(result?.summary.totalVisitors).toBe(200);
    expect(result?.summary.totalOrders).toBe(50);
    expect(result?.summary.hasWinner).toBe(true);
    expect(result?.summary.winnerVariantId).toBe("challenger");
    expect(result?.variants[1]?.conversionRate).toBe(0.3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws descriptive error when ClickHouse responds non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "internal clickhouse error" });

    await expect(adapter.getExperimentAnalytics("shop-1", "exp-1")).rejects.toThrow(
      "ClickHouse query failed (500): internal clickhouse error"
    );
  });

  it("returns segment breakdown and converts visitors to numbers", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        [
          {
            dimensionValue: "mobile",
            variantId: "v1",
            variantKey: "control",
            variantName: "Control",
            visitors: "123",
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n"),
    });

    const rows = await adapter.getSegmentBreakdown("shop-1", "exp-1", "deviceType");
    expect(rows).toEqual([
      {
        dimensionValue: "mobile",
        variantId: "v1",
        variantKey: "control",
        variantName: "Control",
        visitors: 123,
      },
    ]);
  });

  it("returns ClickHouse adapter when USE_CLICKHOUSE=true", async () => {
    process.env.USE_CLICKHOUSE = "true";
    const instance = await getAnalyticsAdapter();
    expect(instance).toBeInstanceOf(ClickHouseAnalyticsAdapter);
  });

  it("returns default AnalyticsService when USE_CLICKHOUSE is not true", async () => {
    delete process.env.USE_CLICKHOUSE;
    const instance = await getAnalyticsAdapter();
    expect((instance as { marker?: string }).marker).toBe("analytics");
  });
});
