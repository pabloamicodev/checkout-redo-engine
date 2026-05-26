import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderAttributionService } from "./order-attribution.service";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderAttribution: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    experimentAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    productCost: {
      findUnique: vi.fn(),
    },
    shop: {
      findUnique: vi.fn(),
    },
    dailyMetric: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockAttributionFindUnique = vi.mocked(prisma.orderAttribution.findUnique);
const mockAttributionCreate = vi.mocked(prisma.orderAttribution.create);
const mockAttributionUpdate = vi.mocked(prisma.orderAttribution.update);
const mockAssignmentFindFirst = vi.mocked(prisma.experimentAssignment.findFirst);
const mockAssignmentFindMany = vi.mocked(prisma.experimentAssignment.findMany);
const mockProductCostFindUnique = vi.mocked(prisma.productCost.findUnique);
const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const mockDailyMetricUpsert = vi.mocked(prisma.dailyMetric.upsert);

const SHOP_ID = "shop-1";

function makeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1001,
    name: "#1001",
    source_name: "web",
    test: false,
    subtotal_price: "90.00",
    total_price: "100.00",
    total_discounts: "0.00",
    total_tax: "10.00",
    financial_status: "paid",
    fulfillment_status: null,
    cart_token: "cart-abc",
    checkout_token: "checkout-xyz",
    customer: { id: 42 },
    note_attributes: [],
    line_items: [],
    ...overrides,
  };
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    experimentId: "exp-1",
    variantId: "var-1",
    visitorId: "visitor-1",
    sessionId: "sess-1",
    cartToken: "cart-abc",
    checkoutToken: "checkout-xyz",
    customerId: null,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAttributionFindUnique.mockResolvedValue(null);
  mockAttributionCreate.mockResolvedValue({} as never);
  mockAttributionUpdate.mockResolvedValue({} as never);
  mockAssignmentFindFirst.mockResolvedValue(null);
  mockAssignmentFindMany.mockResolvedValue([] as never);
  mockProductCostFindUnique.mockResolvedValue(null);
  mockShopFindUnique.mockResolvedValue({ settings: {} } as never);
  mockDailyMetricUpsert.mockResolvedValue({} as never);
});

// ─── Test order skipping ──────────────────────────────────────────────────────

describe("OrderAttributionService.processOrder — skipping", () => {
  const service = new OrderAttributionService();

  it("skips orders with no id", async () => {
    await service.processOrder(SHOP_ID, { name: "#999" });
    expect(mockAttributionCreate).not.toHaveBeenCalled();
  });

  it("skips test orders (source_name === 'test')", async () => {
    await service.processOrder(SHOP_ID, makeOrder({ source_name: "test" }));
    expect(mockAttributionCreate).not.toHaveBeenCalled();
  });

  it("skips test orders (test === true)", async () => {
    await service.processOrder(SHOP_ID, makeOrder({ test: true }));
    expect(mockAttributionCreate).not.toHaveBeenCalled();
  });

  it("updates status only when order already attributed (idempotency)", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce({ id: "attr-1", shopId: SHOP_ID, shopifyOrderId: "1001" } as never);
    await service.processOrder(SHOP_ID, makeOrder({ financial_status: "refunded" }));
    expect(mockAttributionCreate).not.toHaveBeenCalled();
    expect(mockAttributionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ financialStatus: "refunded" }),
      })
    );
  });
});

// ─── Attribution lookup hierarchy ─────────────────────────────────────────────

describe("OrderAttributionService.processOrder — attribution lookup", () => {
  const service = new OrderAttributionService();

  it("attributes order via cart token (first priority)", async () => {
    mockAssignmentFindFirst.mockResolvedValueOnce(makeAssignment({ cartToken: "cart-abc" }) as never);
    mockAssignmentFindMany.mockResolvedValueOnce([] as never);

    await service.processOrder(SHOP_ID, makeOrder({ cart_token: "cart-abc" }));

    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experimentId: "exp-1",
          variantId: "var-1",
          cartToken: "cart-abc",
        }),
      })
    );
  });

  it("falls back to checkout token when cart token finds nothing", async () => {
    // First findFirst (cart token) returns null
    mockAssignmentFindFirst.mockResolvedValueOnce(null);
    // Second findFirst (checkout token) returns assignment
    mockAssignmentFindFirst.mockResolvedValueOnce(makeAssignment({ checkoutToken: "checkout-xyz" }) as never);
    mockAssignmentFindMany.mockResolvedValueOnce([] as never);

    await service.processOrder(SHOP_ID, makeOrder({ cart_token: null, checkout_token: "checkout-xyz" }));

    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experimentId: "exp-1", variantId: "var-1" }),
      })
    );
  });

  it("falls back to customer ID when cart and checkout tokens find nothing", async () => {
    // cart_token and checkout_token are null so those findFirst calls are skipped;
    // only one findFirst call happens — for the customer ID lookup.
    mockAssignmentFindFirst.mockResolvedValueOnce(makeAssignment({ customerId: "42" }) as never);
    mockAssignmentFindMany.mockResolvedValueOnce([] as never);

    await service.processOrder(SHOP_ID, makeOrder({ cart_token: null, checkout_token: null, customer: { id: 42 } }));

    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experimentId: "exp-1" }),
      })
    );
  });

  it("extracts visitorId from note_attributes when not set by assignment", async () => {
    mockAssignmentFindFirst.mockResolvedValue(null);
    mockAssignmentFindMany.mockResolvedValue([] as never);

    await service.processOrder(SHOP_ID, makeOrder({
      cart_token: null,
      checkout_token: null,
      customer: null,
      note_attributes: [{ name: "_ml_visitor_id", value: "visitor-from-notes" }],
    }));

    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visitorId: "visitor-from-notes" }),
      })
    );
  });

  it("creates attribution with null experimentId when nothing matches", async () => {
    await service.processOrder(SHOP_ID, makeOrder({ cart_token: null, checkout_token: null, customer: null }));
    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experimentId: null, variantId: null }),
      })
    );
  });

  it("falls back to checkout token when cart token assignment has no experimentId", async () => {
    // Cart token matches a record that has no experiment linked (experimentId: null)
    mockAssignmentFindFirst.mockResolvedValueOnce(
      makeAssignment({ experimentId: null, variantId: null, cartToken: "cart-abc" }) as never
    );
    // Checkout token lookup then finds the real experiment
    mockAssignmentFindFirst.mockResolvedValueOnce(
      makeAssignment({ checkoutToken: "checkout-xyz", cartToken: null }) as never
    );
    mockAssignmentFindMany.mockResolvedValueOnce([] as never);

    await service.processOrder(SHOP_ID, makeOrder());

    expect(mockAssignmentFindFirst).toHaveBeenCalledTimes(2);
    expect(mockAttributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experimentId: "exp-1", variantId: "var-1" }),
      })
    );
  });
});

// ─── Revenue calculations ─────────────────────────────────────────────────────

describe("OrderAttributionService.processOrder — revenue calculations", () => {
  const service = new OrderAttributionService();

  it("prefers shop_money over raw amount for multi-currency accuracy", async () => {
    const order = makeOrder({
      total_price: "100.00",
      total_price_set: { shop_money: { amount: "95.00", currency_code: "USD" } },
      total_tax: "0.00",
      cart_token: null,
      checkout_token: null,
      customer: null,
    });

    await service.processOrder(SHOP_ID, order);

    const createCall = mockAttributionCreate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    expect(createCall.data.totalPrice).toBe(95.00);
    expect(createCall.data.currencyCode).toBe("USD");
  });

  it("computes netRevenue as totalPrice minus totalTax", async () => {
    const order = makeOrder({
      total_price: "110.00",
      total_tax: "10.00",
      cart_token: null,
      checkout_token: null,
      customer: null,
    });

    await service.processOrder(SHOP_ID, order);

    const createCall = mockAttributionCreate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    expect(createCall.data.netRevenue).toBeCloseTo(100.0, 2);
  });

  it("adds COGS from ProductCost table for line items", async () => {
    mockProductCostFindUnique.mockResolvedValueOnce({ cost: 5.0 } as never);

    const order = makeOrder({
      line_items: [{ variant_id: 99, quantity: 3, price: "20.00" }],
      cart_token: null,
      checkout_token: null,
      customer: null,
    });

    await service.processOrder(SHOP_ID, order);

    const createCall = mockAttributionCreate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    expect(createCall.data.cogs).toBeCloseTo(15.0, 2); // 5 * 3
  });

  it("skips line items with no variant_id for COGS", async () => {
    const order = makeOrder({
      line_items: [{ product_id: 1, quantity: 2, price: "10.00" }], // no variant_id
      cart_token: null,
      checkout_token: null,
      customer: null,
    });

    await service.processOrder(SHOP_ID, order);
    expect(mockProductCostFindUnique).not.toHaveBeenCalled();
  });

  it("transaction fee defaults to 2.9% when not in shop settings", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ settings: {} } as never);

    const order = makeOrder({
      total_price: "100.00",
      total_tax: "0.00",
      cart_token: null,
      checkout_token: null,
      customer: null,
    });

    await service.processOrder(SHOP_ID, order);

    const createCall = mockAttributionCreate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    // transactionFee = 100 * 2.9% = 2.9
    expect(createCall.data.transactionFee).toBeCloseTo(2.9, 2);
  });
});

// ─── DailyMetric updates ──────────────────────────────────────────────────────

describe("OrderAttributionService.processOrder — DailyMetric updates", () => {
  const service = new OrderAttributionService();

  it("upserts DailyMetric after creating attribution", async () => {
    mockAssignmentFindFirst.mockResolvedValueOnce(makeAssignment() as never);
    mockAssignmentFindMany.mockResolvedValueOnce([] as never);

    await service.processOrder(SHOP_ID, makeOrder());
    expect(mockDailyMetricUpsert).toHaveBeenCalledOnce();
  });

  it("does not upsert DailyMetric when no experiment attributed", async () => {
    // No assignment found → no allAssignments
    await service.processOrder(SHOP_ID, makeOrder({ cart_token: null, checkout_token: null, customer: null }));
    expect(mockDailyMetricUpsert).not.toHaveBeenCalled();
  });
});

// ─── processRefund ────────────────────────────────────────────────────────────

describe("OrderAttributionService.processRefund", () => {
  const service = new OrderAttributionService();

  it("skips refund when order was never attributed", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce(null);
    await service.processRefund(SHOP_ID, { order_id: 9999, transactions: [{ kind: "refund", amount: "50.00" }] });
    expect(mockAttributionUpdate).not.toHaveBeenCalled();
  });

  it("skips refund when no order_id", async () => {
    await service.processRefund(SHOP_ID, { transactions: [] });
    expect(mockAttributionFindUnique).not.toHaveBeenCalled();
  });

  it("reduces netRevenue by refund amount", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce({
      shopId: SHOP_ID,
      shopifyOrderId: "1001",
      netRevenue: 100,
      grossProfit: 40,
    } as never);

    await service.processRefund(SHOP_ID, {
      order_id: 1001,
      transactions: [{ kind: "refund", amount: "30.00" }],
    });

    expect(mockAttributionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          netRevenue: 70,
          grossProfit: 10,
          financialStatus: "refunded",
        }),
      })
    );
  });

  it("clamps netRevenue to 0 (cannot go negative)", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce({
      shopId: SHOP_ID,
      shopifyOrderId: "1001",
      netRevenue: 20,
      grossProfit: 5,
    } as never);

    await service.processRefund(SHOP_ID, {
      order_id: 1001,
      transactions: [{ kind: "refund", amount: "50.00" }],
    });

    const updateCall = mockAttributionUpdate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    expect(updateCall.data.netRevenue).toBe(0);
  });

  it("ignores non-refund transactions (e.g. capture)", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce({
      shopId: SHOP_ID,
      shopifyOrderId: "1001",
      netRevenue: 100,
      grossProfit: 40,
    } as never);

    await service.processRefund(SHOP_ID, {
      order_id: 1001,
      transactions: [{ kind: "capture", amount: "100.00" }],
    });

    // refundAmount is 0 → should skip update
    expect(mockAttributionUpdate).not.toHaveBeenCalled();
  });

  it("sums multiple refund transactions", async () => {
    mockAttributionFindUnique.mockResolvedValueOnce({
      shopId: SHOP_ID,
      shopifyOrderId: "1001",
      netRevenue: 100,
      grossProfit: 40,
    } as never);

    await service.processRefund(SHOP_ID, {
      order_id: 1001,
      transactions: [
        { kind: "refund", amount: "20.00" },
        { kind: "refund", amount: "15.00" },
      ],
    });

    const updateCall = mockAttributionUpdate.mock.calls[0]![0]! as { data: Record<string, unknown> };
    expect(updateCall.data.netRevenue).toBeCloseTo(65, 2); // 100 - 35
  });
});
