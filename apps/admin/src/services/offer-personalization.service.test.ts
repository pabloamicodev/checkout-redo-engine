import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfferPersonalizationService } from "./offer-personalization.service";

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
      count: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orderAttribution: {
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.personalization.findMany);
const mockFindFirst = vi.mocked(prisma.personalization.findFirst);
const mockCreate = vi.mocked(prisma.personalization.create);
const mockUpdate = vi.mocked(prisma.personalization.update);
const mockDelete = vi.mocked(prisma.personalization.delete);
const mockPersoCount = vi.mocked(prisma.personalization.count);
const mockOfferCount = vi.mocked(prisma.offer.count);
const mockEventFindMany = vi.mocked(prisma.event.findMany);
const mockEventCount = vi.mocked(prisma.event.count);
const mockOAAggregate = vi.mocked(prisma.orderAttribution.aggregate);

const SHOP = "shop-1";

function makePerso(overrides: Record<string, unknown> = {}) {
  return {
    id: "perso-1",
    shopId: SHOP,
    name: "VIP Offers",
    type: "OFFER",
    status: "DRAFT",
    offerIds: ["offer-1"],
    targetingRules: [],
    modifications: [],
    priority: 100,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("OfferPersonalizationService.list", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockFindMany.mockResolvedValue([makePerso()] as never);
    mockPersoCount.mockResolvedValue(1);
  });

  it("returns items and total", async () => {
    const result = await svc.list(SHOP);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("always filters by type OFFER", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "OFFER" }),
      })
    );
  });

  it("applies status filter", async () => {
    await svc.list(SHOP, { status: "ACTIVE" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("orders by priority asc then updatedAt desc", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      })
    );
  });

  it("caps limit at 200", async () => {
    await svc.list(SHOP, { limit: 500 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });
});

describe("OfferPersonalizationService.get", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
  });

  it("returns the personalization when found", async () => {
    mockFindFirst.mockResolvedValue(makePerso() as never);
    const result = await svc.get(SHOP, "perso-1");
    expect(result.id).toBe("perso-1");
  });

  it("throws when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.get(SHOP, "missing")).rejects.toThrow("Personalization not found");
  });
});

describe("OfferPersonalizationService.create", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockOfferCount.mockResolvedValue(1);
    mockCreate.mockResolvedValue(makePerso() as never);
  });

  it("creates with DRAFT status when no startsAt", async () => {
    await svc.create(SHOP, {
      name: "VIP Offers",
      offerIds: ["offer-1"],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    );
  });

  it("creates with SCHEDULED status when startsAt is in the future", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();

    await svc.create(SHOP, {
      name: "Scheduled Offers",
      offerIds: ["offer-1"],
      startsAt: future,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SCHEDULED" }),
      })
    );
  });

  it("creates with DRAFT status when startsAt is in the past", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();

    await svc.create(SHOP, {
      name: "Past Start",
      offerIds: ["offer-1"],
      startsAt: past,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    );
  });

  it("uses priority 100 as default", async () => {
    await svc.create(SHOP, { name: "Test", offerIds: ["offer-1"] });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 100 }),
      })
    );
  });

  it("stores provided priority", async () => {
    await svc.create(SHOP, { name: "High Pri", offerIds: ["offer-1"], priority: 10 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 10 }),
      })
    );
  });

  it("throws when offer IDs are invalid", async () => {
    mockOfferCount.mockResolvedValue(0);

    await expect(
      svc.create(SHOP, { name: "Bad", offerIds: ["invalid-id"] })
    ).rejects.toThrow("One or more offer IDs are invalid");
  });

  it("skips offer validation when offerIds is empty", async () => {
    await svc.create(SHOP, { name: "No Offers", offerIds: [] });
    expect(mockOfferCount).not.toHaveBeenCalled();
  });

  it("stores endsAt date when provided", async () => {
    const endsAt = new Date(Date.now() + 2 * 86400000).toISOString();

    await svc.create(SHOP, { name: "Timed", offerIds: ["offer-1"], endsAt });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endsAt: new Date(endsAt) }),
      })
    );
  });
});

describe("OfferPersonalizationService.update", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockFindFirst.mockResolvedValue(makePerso() as never);
    mockOfferCount.mockResolvedValue(2);
    mockUpdate.mockResolvedValue(makePerso() as never);
  });

  it("updates name", async () => {
    await svc.update(SHOP, "perso-1", { name: "New Name" });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "New Name" }) })
    );
  });

  it("validates new offerIds when provided", async () => {
    await svc.update(SHOP, "perso-1", { offerIds: ["offer-1", "offer-2"] });
    expect(mockOfferCount).toHaveBeenCalled();
  });

  it("throws when updated offerIds are invalid", async () => {
    mockOfferCount.mockResolvedValue(0);
    await expect(
      svc.update(SHOP, "perso-1", { offerIds: ["bad-id"] })
    ).rejects.toThrow("One or more offer IDs are invalid");
  });

  it("throws when personalization not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.update(SHOP, "missing", { name: "X" })).rejects.toThrow(
      "Personalization not found"
    );
  });
});

describe("OfferPersonalizationService.delete", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso() as never);
    await svc.delete(SHOP, "perso-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "perso-1" } });
  });

  it("throws when trying to delete an ACTIVE personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "ACTIVE" }) as never);
    await expect(svc.delete(SHOP, "perso-1")).rejects.toThrow(
      "Cannot delete an ACTIVE personalization"
    );
  });
});

describe("OfferPersonalizationService.activate", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockUpdate.mockResolvedValue(makePerso({ status: "ACTIVE" }) as never);
  });

  it("activates a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "DRAFT" }) as never);
    await svc.activate(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
  });

  it("activates a PAUSED personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "PAUSED" }) as never);
    await svc.activate(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("activates a SCHEDULED personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "SCHEDULED" }) as never);
    await svc.activate(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("throws when activating an ARCHIVED personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "ARCHIVED" }) as never);
    await expect(svc.activate(SHOP, "perso-1")).rejects.toThrow(
      "Cannot activate personalization in status: ARCHIVED"
    );
  });
});

describe("OfferPersonalizationService.pause", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockUpdate.mockResolvedValue(makePerso({ status: "PAUSED" }) as never);
  });

  it("pauses an ACTIVE personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "ACTIVE" }) as never);
    await svc.pause(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
  });

  it("pauses a SCHEDULED personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "SCHEDULED" }) as never);
    await svc.pause(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("throws when pausing a DRAFT personalization", async () => {
    mockFindFirst.mockResolvedValue(makePerso({ status: "DRAFT" }) as never);
    await expect(svc.pause(SHOP, "perso-1")).rejects.toThrow(
      "Cannot pause personalization in status: DRAFT"
    );
  });
});

describe("OfferPersonalizationService.archive", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
    mockFindFirst.mockResolvedValue(makePerso() as never);
    mockUpdate.mockResolvedValue(makePerso({ status: "ARCHIVED" }) as never);
  });

  it("archives any personalization", async () => {
    await svc.archive(SHOP, "perso-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ARCHIVED" } })
    );
  });
});

describe("OfferPersonalizationService.getOfferAnalytics", () => {
  let svc: OfferPersonalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferPersonalizationService();
  });

  it("calculates views, claims, uniqueViewers and conversionRate", async () => {
    mockEventFindMany.mockResolvedValue([
      { visitorId: "v1" },
      { visitorId: "v1" },
      { visitorId: "v2" },
    ] as never);
    mockEventCount.mockResolvedValue(2);
    mockOAAggregate.mockResolvedValue({ _sum: { netRevenue: 500 } } as never);

    const result = await svc.getOfferAnalytics(SHOP, "offer-1");

    expect(result.views).toBe(3);
    expect(result.uniqueViewers).toBe(2);
    expect(result.claims).toBe(2);
    expect(result.conversionRate).toBe(1); // 2/2
    expect(result.attributedRevenue).toBe(500);
  });

  it("returns 0 conversionRate when no unique viewers", async () => {
    mockEventFindMany.mockResolvedValue([] as never);
    mockEventCount.mockResolvedValue(0);
    mockOAAggregate.mockResolvedValue({ _sum: { netRevenue: null } } as never);

    const result = await svc.getOfferAnalytics(SHOP, "offer-1");

    expect(result.conversionRate).toBe(0);
    expect(result.attributedRevenue).toBe(0);
  });
});
