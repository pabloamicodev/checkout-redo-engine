import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventIngestionService } from "./event-ingestion.service";

// ─── Hoisted mocks (must be defined before vi.mock() hoisting) ────────────────

const mockIncrementFromEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customEvent: {
      findMany: vi.fn(),
    },
    event: {
      createMany: vi.fn(),
    },
    experimentAssignment: {
      updateMany: vi.fn(),
    },
    dailyMetric: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    sadd: vi.fn().mockResolvedValue(1), // always new visitor by default
    expire: vi.fn().mockResolvedValue(1),
  },
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDelPattern: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimitHeaders: vi.fn(),
  RATE_LIMITS: { admin_api: {}, runtime_assign: {}, runtime_events: {} },
}));

vi.mock("./daily-metric.service", () => ({
  DailyMetricService: vi.fn().mockImplementation(() => ({
    incrementFromEvent: mockIncrementFromEvent,
  })),
}));

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const mockCustomEventFindMany = vi.mocked(prisma.customEvent.findMany);
const mockEventCreateMany = vi.mocked(prisma.event.createMany);
const mockAssignmentUpdateMany = vi.mocked(prisma.experimentAssignment.updateMany);
const mockRedisAdd = vi.mocked(redis.sadd);

const SHOP_ID = "shop-1";

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventType: "PAGE_VIEW",
    eventName: "page_view",
    occurredAt: new Date().toISOString(),
    experimentId: "exp-1",
    variantId: "var-1",
    url: "https://shop.myshopify.com/products/widget",
    path: "/products/widget",
    deviceType: "mobile",
    country: "US",
    ...overrides,
  };
}

function makeBatch(events: ReturnType<typeof makeEvent>[], visitorId = "visitor-1") {
  return {
    visitorId,
    sessionId: "sess-1",
    events,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCustomEventFindMany.mockResolvedValue([] as never);
  mockEventCreateMany.mockResolvedValue({ count: 1 } as never);
  mockAssignmentUpdateMany.mockResolvedValue({ count: 0 } as never);
  mockRedisAdd.mockResolvedValue(1 as never); // new visitor by default
  mockIncrementFromEvent.mockResolvedValue(undefined);
});

// ─── Basic ingestion ──────────────────────────────────────────────────────────

describe("EventIngestionService.ingest — basic", () => {
  const service = new EventIngestionService();

  it("creates event records for each event in batch", async () => {
    const batch = makeBatch([makeEvent(), makeEvent({ eventType: "ADD_TO_CART", eventName: "add_to_cart" })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockEventCreateMany).toHaveBeenCalledOnce();
    const call = mockEventCreateMany.mock.calls[0]![0]! as { data: unknown[]; skipDuplicates: boolean };
    expect(call.data).toHaveLength(2);
    expect(call.skipDuplicates).toBe(true);
  });

  it("returns empty object when no warnings", async () => {
    const batch = makeBatch([makeEvent()]);
    const result = await service.ingest(SHOP_ID, batch as never);
    expect(result).toEqual({});
  });

  it("normalizes eventType to uppercase", async () => {
    const batch = makeBatch([makeEvent({ eventType: "page_view" })]);
    await service.ingest(SHOP_ID, batch as never);
    const call = mockEventCreateMany.mock.calls[0]![0]! as { data: Array<Record<string, unknown>> };
    expect(call.data[0]!.eventType).toBe("PAGE_VIEW");
  });

  it("sets receivedAt on every event", async () => {
    const batch = makeBatch([makeEvent()]);
    await service.ingest(SHOP_ID, batch as never);
    const call = mockEventCreateMany.mock.calls[0]![0]! as { data: Array<Record<string, unknown>> };
    expect(call.data[0]!.receivedAt).toBeInstanceOf(Date);
  });

  it("uses visitorId from batch (not individual event)", async () => {
    const batch = makeBatch([makeEvent()], "specific-visitor");
    await service.ingest(SHOP_ID, batch as never);
    const call = mockEventCreateMany.mock.calls[0]![0]! as { data: Array<Record<string, unknown>> };
    expect(call.data[0]!.visitorId).toBe("specific-visitor");
  });

  it("maps unknown eventType to CUSTOM", async () => {
    const batch = makeBatch([makeEvent({ eventType: "UNKNOWN_TYPE", eventName: "something" })]);
    await service.ingest(SHOP_ID, batch as never);
    const call = mockEventCreateMany.mock.calls[0]![0]! as { data: Array<Record<string, unknown>> };
    expect(call.data[0]!.eventType).toBe("CUSTOM");
  });

  it("processes large batches in chunks of 100", async () => {
    const events = Array.from({ length: 250 }, () => makeEvent());
    const batch = makeBatch(events);
    await service.ingest(SHOP_ID, batch as never);
    // 250 events → 3 chunks (100, 100, 50)
    expect(mockEventCreateMany).toHaveBeenCalledTimes(3);
  });
});

// ─── Custom event validation ──────────────────────────────────────────────────

describe("EventIngestionService.ingest — custom event warnings", () => {
  const service = new EventIngestionService();

  it("returns warning for unregistered CUSTOM events", async () => {
    mockCustomEventFindMany.mockResolvedValueOnce([] as never); // no registered events
    const batch = makeBatch([makeEvent({ eventType: "CUSTOM", eventName: "my_event" })]);
    const result = await service.ingest(SHOP_ID, batch as never);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain("my_event");
  });

  it("returns no warning when CUSTOM event is registered", async () => {
    // Use a unique shopId to bypass the module-level in-process cache
    const freshShopId = `shop-custom-registered-${Date.now()}`;
    mockCustomEventFindMany.mockResolvedValueOnce([{ name: "my_event" }] as never);
    const batch = makeBatch([makeEvent({ eventType: "CUSTOM", eventName: "my_event" })]);
    const result = await service.ingest(freshShopId, batch as never);
    expect(result.warnings).toBeUndefined();
  });

  it("does not check custom events when batch has no CUSTOM type events", async () => {
    const batch = makeBatch([makeEvent({ eventType: "PAGE_VIEW" })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockCustomEventFindMany).not.toHaveBeenCalled();
  });

  it("still ingests unregistered CUSTOM events (non-blocking warning)", async () => {
    mockCustomEventFindMany.mockResolvedValueOnce([] as never);
    const batch = makeBatch([makeEvent({ eventType: "CUSTOM", eventName: "unregistered" })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockEventCreateMany).toHaveBeenCalledOnce();
  });
});

// ─── Assignment update ────────────────────────────────────────────────────────

describe("EventIngestionService.ingest — assignment lastSeenAt update", () => {
  const service = new EventIngestionService();

  it("updates lastSeenAt for experiments referenced in batch", async () => {
    const batch = makeBatch([makeEvent({ experimentId: "exp-1", variantId: "var-1" })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockAssignmentUpdateMany).toHaveBeenCalledOnce();
    const call = mockAssignmentUpdateMany.mock.calls[0]![0]! as { where: Record<string, unknown> };
    expect(call.where.experimentId).toEqual({ in: ["exp-1"] });
  });

  it("does not call updateMany when no events have experimentId", async () => {
    const batch = makeBatch([makeEvent({ experimentId: undefined, variantId: undefined })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockAssignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("deduplicates experimentIds before updating assignments", async () => {
    const batch = makeBatch([
      makeEvent({ experimentId: "exp-1", variantId: "var-1" }),
      makeEvent({ experimentId: "exp-1", variantId: "var-1" }), // duplicate
    ]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockAssignmentUpdateMany).toHaveBeenCalledOnce();
    const call = mockAssignmentUpdateMany.mock.calls[0]![0]! as { where: { experimentId: { in: string[] } } };
    expect(call.where.experimentId.in).toHaveLength(1);
  });
});

// ─── DailyMetric updates ──────────────────────────────────────────────────────

describe("EventIngestionService.ingest — DailyMetric / unique visitor tracking", () => {
  const service = new EventIngestionService();

  it("checks Redis to deduplicate unique visitors", async () => {
    const batch = makeBatch([makeEvent({ eventType: "PAGE_VIEW" })]);
    await service.ingest(SHOP_ID, batch as never);
    // Redis SADD called for visitor and session keys
    expect(mockRedisAdd).toHaveBeenCalled();
  });

  it("does not update DailyMetric for events without experimentId+variantId", async () => {
    const batch = makeBatch([makeEvent({ experimentId: null, variantId: null })]);
    await service.ingest(SHOP_ID, batch as never);
    expect(mockIncrementFromEvent).not.toHaveBeenCalled();
  });

  it("groups funnel events by experiment+variant before DailyMetric update", async () => {
    // Two events for same experiment+variant, one for different variant
    const batch = makeBatch([
      makeEvent({ eventType: "PAGE_VIEW", experimentId: "exp-1", variantId: "var-1" }),
      makeEvent({ eventType: "ADD_TO_CART", experimentId: "exp-1", variantId: "var-1" }),
      makeEvent({ eventType: "PAGE_VIEW", experimentId: "exp-1", variantId: "var-2" }),
    ]);

    await service.ingest(SHOP_ID, batch as never);
    // DailyMetric updated once per unique exp+variant combo
    expect(mockIncrementFromEvent).toHaveBeenCalledTimes(2);
  });

  it("only tracks PAGE_VIEW, PRODUCT_VIEW, ADD_TO_CART, CHECKOUT_STARTED as funnel events", async () => {
    const batch = makeBatch([
      // Non-funnel events — should not trigger DailyMetric update for this variant alone
      makeEvent({ eventType: "CUSTOM", eventName: "custom_event", experimentId: "exp-1", variantId: "var-1" }),
      makeEvent({ eventType: "OFFER_VIEWED", experimentId: "exp-1", variantId: "var-1" }),
    ]);

    await service.ingest(SHOP_ID, batch as never);
    // No funnel events → no DailyMetric update
    expect(mockIncrementFromEvent).not.toHaveBeenCalled();
  });
});
