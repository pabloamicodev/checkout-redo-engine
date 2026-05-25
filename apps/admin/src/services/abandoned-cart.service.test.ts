import { describe, it, expect, vi, beforeEach } from "vitest";
import { AbandonedCartService } from "./abandoned-cart.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    personalization: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    offer: {
      findFirst: vi.fn(),
    },
    event: {
      count: vi.fn(),
    },
    orderAttribution: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.personalization.findMany);
const mockFindFirst = vi.mocked(prisma.personalization.findFirst);
const mockCreate = vi.mocked(prisma.personalization.create);
const mockUpdate = vi.mocked(prisma.personalization.update);
const mockDelete = vi.mocked(prisma.personalization.delete);
const mockCount = vi.mocked(prisma.personalization.count);
const mockOfferFindFirst = vi.mocked(prisma.offer.findFirst);
const mockEventCount = vi.mocked(prisma.event.count);
const mockOAAggregate = vi.mocked(prisma.orderAttribution.aggregate);
const mockTransaction = vi.mocked(prisma.$transaction);

const SHOP = "shop-1";

function makePersonalization(overrides: Record<string, unknown> = {}) {
  return {
    id: "acr-1",
    shopId: SHOP,
    name: "Win Back Offer",
    type: "ABANDONED_CART",
    status: "DRAFT",
    priority: 100,
    offerIds: [],
    targetingRules: [],
    modifications: [{ message: "Don't forget your cart!" }],
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const VALID_INPUT = {
  name: "Win Back Offer",
  message: "Don't forget your cart!",
};

describe("AbandonedCartService.list", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockTransaction.mockImplementation(async (ops: unknown) =>
      Promise.all(ops as Array<Promise<unknown>>)
    );
    mockFindMany.mockResolvedValue([makePersonalization()] as never);
    mockCount.mockResolvedValue(1);
  });

  it("returns items and total", async () => {
    const result = await svc.list(SHOP);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("filters by type ABANDONED_CART", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "ABANDONED_CART" }),
      })
    );
  });

  it("excludes ARCHIVED by default", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "ARCHIVED" } }),
      })
    );
  });

  it("applies status filter when provided", async () => {
    await svc.list(SHOP, { status: "ACTIVE" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("paginates using page parameter", async () => {
    await svc.list(SHOP, { page: 3 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 })
    );
  });
});

describe("AbandonedCartService.get", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
  });

  it("returns the personalization when found", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization() as never);
    const result = await svc.get(SHOP, "acr-1");
    expect(result.id).toBe("acr-1");
  });

  it("throws when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.get(SHOP, "missing")).rejects.toThrow(
      "Abandoned cart personalization not found"
    );
  });
});

describe("AbandonedCartService.create — validation", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockCreate.mockResolvedValue(makePersonalization() as never);
    mockOfferFindFirst.mockResolvedValue(null);
  });

  it("throws when name is empty", async () => {
    await expect(
      svc.create(SHOP, { name: "", message: "hi" })
    ).rejects.toThrow("Name is required");
  });

  it("throws when name exceeds 200 characters", async () => {
    await expect(
      svc.create(SHOP, { name: "a".repeat(201), message: "hi" })
    ).rejects.toThrow("Name must be 200 characters or fewer");
  });

  it("throws when message is empty", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "" })
    ).rejects.toThrow("Message is required");
  });

  it("throws when message exceeds 500 characters", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "a".repeat(501) })
    ).rejects.toThrow("Message must be 500 characters or fewer");
  });

  it("throws when subtext exceeds 300 characters", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", subtext: "a".repeat(301) })
    ).rejects.toThrow("Subtext must be 300 characters or fewer");
  });

  it("throws when ctaLabel exceeds 100 characters", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", ctaLabel: "a".repeat(101) })
    ).rejects.toThrow("CTA label must be 100 characters or fewer");
  });

  it("throws when inactivityMinutes is below 5", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", inactivityMinutes: 3 })
    ).rejects.toThrow("Inactivity window must be between 5 and 1440 minutes");
  });

  it("throws when inactivityMinutes is above 1440", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", inactivityMinutes: 1441 })
    ).rejects.toThrow("Inactivity window must be between 5 and 1440 minutes");
  });

  it("throws when minCartValue is negative", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", minCartValue: -1 })
    ).rejects.toThrow("Minimum cart value cannot be negative");
  });

  it("throws when priority is out of range", async () => {
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", priority: -1 })
    ).rejects.toThrow("Priority must be between 0 and 9999");
  });

  it("throws when endsAt is in the past", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", endsAt: past })
    ).rejects.toThrow("endsAt must be in the future");
  });

  it("throws when endsAt is before startsAt", async () => {
    const future1 = new Date(Date.now() + 86400000).toISOString();
    const future2 = new Date(Date.now() + 172800000).toISOString();
    await expect(
      svc.create(SHOP, { name: "Test", message: "hi", startsAt: future2, endsAt: future1 })
    ).rejects.toThrow("endsAt must be after startsAt");
  });
});

describe("AbandonedCartService.create — success paths", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockCreate.mockResolvedValue(makePersonalization() as never);
  });

  it("creates with DRAFT status when no startsAt", async () => {
    await svc.create(SHOP, VALID_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    );
  });

  it("creates with SCHEDULED status when startsAt is in the future", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();

    await svc.create(SHOP, { ...VALID_INPUT, startsAt: future });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SCHEDULED" }),
      })
    );
  });

  it("builds targeting rules with default inactivityMinutes of 30", async () => {
    await svc.create(SHOP, VALID_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetingRules: expect.arrayContaining([
            expect.objectContaining({ field: "inactivity_minutes", value: 30 }),
          ]),
        }),
      })
    );
  });

  it("adds cart_value rule when minCartValue is set", async () => {
    await svc.create(SHOP, { ...VALID_INPUT, minCartValue: 50 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetingRules: expect.arrayContaining([
            expect.objectContaining({ field: "cart_value", value: 50 }),
          ]),
        }),
      })
    );
  });

  it("adds returning visitor rule when returningOnly is not false", async () => {
    await svc.create(SHOP, VALID_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetingRules: expect.arrayContaining([
            expect.objectContaining({ field: "visitor_type", value: "returning" }),
          ]),
        }),
      })
    );
  });

  it("omits returning visitor rule when returningOnly is false", async () => {
    await svc.create(SHOP, { ...VALID_INPUT, returningOnly: false });

    const call = mockCreate.mock.calls[0]![0] as { data: { targetingRules: unknown[] } };
    const hasReturning = call.data.targetingRules.some(
      (r) => (r as Record<string, unknown>)["field"] === "visitor_type"
    );
    expect(hasReturning).toBe(false);
  });

  it("validates offerId belongs to shop", async () => {
    mockOfferFindFirst.mockResolvedValue(null);

    await expect(
      svc.create(SHOP, { ...VALID_INPUT, offerId: "unknown-offer" })
    ).rejects.toThrow("Offer not found or does not belong to this shop");
  });

  it("rejects archived offers", async () => {
    mockOfferFindFirst.mockResolvedValue({ id: "offer-1", status: "ARCHIVED" } as never);

    await expect(
      svc.create(SHOP, { ...VALID_INPUT, offerId: "offer-1" })
    ).rejects.toThrow("Cannot link an archived offer");
  });

  it("links a valid offer", async () => {
    mockOfferFindFirst.mockResolvedValue({ id: "offer-1", status: "ACTIVE" } as never);

    await svc.create(SHOP, { ...VALID_INPUT, offerId: "offer-1" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ offerIds: ["offer-1"] }),
      })
    );
  });
});

describe("AbandonedCartService.update", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockUpdate.mockResolvedValue(makePersonalization() as never);
  });

  it("updates a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization() as never);

    await svc.update(SHOP, "acr-1", { name: "Updated Name" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "acr-1" } })
    );
  });

  it("blocks unsafe field changes on ACTIVE personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "ACTIVE" }) as never);

    await expect(
      svc.update(SHOP, "acr-1", { message: "New message" })
    ).rejects.toThrow("Cannot change [message] while personalization is ACTIVE");
  });

  it("allows safe field changes (name, priority, endsAt) on ACTIVE", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockFindFirst.mockResolvedValue(
      makePersonalization({ status: "ACTIVE", endsAt: null }) as never
    );

    await svc.update(SHOP, "acr-1", { name: "New name", endsAt: future });

    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("AbandonedCartService.activate", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockUpdate.mockResolvedValue(makePersonalization({ status: "ACTIVE" }) as never);
  });

  it("activates a DRAFT personalization", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makePersonalization({ status: "DRAFT" }) as never) // get
      .mockResolvedValueOnce(null); // conflict check

    await svc.activate(SHOP, "acr-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
  });

  it("is idempotent — returns existing ACTIVE without update", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "ACTIVE" }) as never);

    await svc.activate(SHOP, "acr-1");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws when the personalization is ARCHIVED", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "ARCHIVED" }) as never);

    await expect(svc.activate(SHOP, "acr-1")).rejects.toThrow(
      "Cannot activate an archived personalization"
    );
  });

  it("throws when another ACTIVE ACR exists", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makePersonalization({ status: "DRAFT" }) as never) // get
      .mockResolvedValueOnce(makePersonalization({ id: "acr-other", name: "Other ACR", status: "ACTIVE", priority: 50 }) as never); // conflict check

    await expect(svc.activate(SHOP, "acr-1")).rejects.toThrow(
      '"Other ACR" is already active'
    );
  });
});

describe("AbandonedCartService.pause", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockUpdate.mockResolvedValue(makePersonalization({ status: "PAUSED" }) as never);
  });

  it("pauses an ACTIVE personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "ACTIVE" }) as never);
    await svc.pause(SHOP, "acr-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
  });

  it("is idempotent — returns PAUSED without update", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "PAUSED" }) as never);
    await svc.pause(SHOP, "acr-1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws when pausing a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "DRAFT" }) as never);
    await expect(svc.pause(SHOP, "acr-1")).rejects.toThrow(
      'Cannot pause a personalization with status "DRAFT"'
    );
  });
});

describe("AbandonedCartService.archive", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockUpdate.mockResolvedValue(makePersonalization({ status: "ARCHIVED" }) as never);
  });

  it("archives a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "DRAFT" }) as never);
    await svc.archive(SHOP, "acr-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ARCHIVED" } })
    );
  });

  it("throws when archiving an ACTIVE personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "ACTIVE" }) as never);
    await expect(svc.archive(SHOP, "acr-1")).rejects.toThrow(
      "Cannot archive an ACTIVE personalization. Pause it first."
    );
  });
});

describe("AbandonedCartService.delete", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "DRAFT" }) as never);
    await svc.delete(SHOP, "acr-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "acr-1" } });
  });

  it("throws when deleting a non-DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePersonalization({ status: "PAUSED" }) as never);
    await expect(svc.delete(SHOP, "acr-1")).rejects.toThrow(
      'Only DRAFT personalizations can be deleted. This one is "PAUSED"'
    );
  });
});

describe("AbandonedCartService.getAnalytics", () => {
  let svc: AbandonedCartService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AbandonedCartService();
    mockFindFirst.mockResolvedValue(makePersonalization() as never);
  });

  it("returns analytics with recovery rate", async () => {
    mockEventCount
      .mockResolvedValueOnce(100) // views
      .mockResolvedValueOnce(20); // recoveries
    mockOAAggregate.mockResolvedValue({ _sum: { netRevenue: 1500 } } as never);

    const result = await svc.getAnalytics(SHOP, "acr-1");

    expect(result.views).toBe(100);
    expect(result.recoveries).toBe(20);
    expect(result.recoveryRate).toBe(0.2);
    expect(result.attributedRevenue).toBe(1500);
  });

  it("returns 0 recovery rate when no views", async () => {
    mockEventCount.mockResolvedValue(0);
    mockOAAggregate.mockResolvedValue({ _sum: { netRevenue: null } } as never);

    const result = await svc.getAnalytics(SHOP, "acr-1");

    expect(result.recoveryRate).toBe(0);
    expect(result.attributedRevenue).toBe(0);
  });
});
