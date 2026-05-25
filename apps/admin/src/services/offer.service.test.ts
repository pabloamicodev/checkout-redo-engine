import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfferService } from "./offer.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.offer.findMany);
const mockFindFirst = vi.mocked(prisma.offer.findFirst);
const mockCreate = vi.mocked(prisma.offer.create);
const mockUpdate = vi.mocked(prisma.offer.update);
const mockDelete = vi.mocked(prisma.offer.delete);
const mockCount = vi.mocked(prisma.offer.count);

const SHOP = "shop-1";

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    shopId: SHOP,
    name: "Test Offer",
    type: "PERCENTAGE_DISCOUNT",
    status: "DRAFT",
    triggerRules: [],
    discountRules: { percentage: 10 },
    displaySettings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("OfferService.list", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
    mockFindMany.mockResolvedValue([makeOffer()] as never);
    mockCount.mockResolvedValue(1);
  });

  it("returns items and total", async () => {
    const result = await svc.list(SHOP);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("applies status filter", async () => {
    await svc.list(SHOP, { status: "ACTIVE" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });

  it("applies type filter", async () => {
    await svc.list(SHOP, { type: "FREE_SHIPPING" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "FREE_SHIPPING" }) })
    );
  });

  it("caps limit at 200", async () => {
    await svc.list(SHOP, { limit: 999 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it("uses page for pagination", async () => {
    await svc.list(SHOP, { page: 3, limit: 10 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

describe("OfferService.get", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
  });

  it("returns offer when found", async () => {
    const offer = makeOffer();
    mockFindFirst.mockResolvedValue(offer as never);
    const result = await svc.get(SHOP, "offer-1");
    expect(result).toEqual(offer);
  });

  it("throws when offer not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.get(SHOP, "missing")).rejects.toThrow("Offer not found: missing");
  });
});

describe("OfferService.create", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
  });

  it("creates a PERCENTAGE_DISCOUNT offer", async () => {
    const offer = makeOffer();
    mockCreate.mockResolvedValue(offer as never);

    const result = await svc.create(SHOP, {
      name: "10% off",
      type: "PERCENTAGE_DISCOUNT",
      discountRules: { percentage: 10 },
      triggerRules: [],
      displaySettings: {},
    });

    expect(result).toEqual(offer);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", shopId: SHOP }),
      })
    );
  });

  it("creates an ORDER_DISCOUNT offer", async () => {
    mockCreate.mockResolvedValue(makeOffer({ type: "ORDER_DISCOUNT" }) as never);

    await svc.create(SHOP, {
      name: "$5 off",
      type: "ORDER_DISCOUNT",
      discountRules: { amount: 5 },
      triggerRules: [],
      displaySettings: {},
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it("creates a FREE_SHIPPING offer", async () => {
    mockCreate.mockResolvedValue(makeOffer({ type: "FREE_SHIPPING" }) as never);

    await svc.create(SHOP, {
      name: "Free shipping",
      type: "FREE_SHIPPING",
      discountRules: {},
      triggerRules: [],
      displaySettings: {},
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it("creates a VOLUME_DISCOUNT offer with tiers", async () => {
    mockCreate.mockResolvedValue(makeOffer({ type: "VOLUME_DISCOUNT" }) as never);

    await svc.create(SHOP, {
      name: "Volume",
      type: "VOLUME_DISCOUNT",
      discountRules: { tiers: [{ minQty: 2, pct: 10 }] },
      triggerRules: [],
      displaySettings: {},
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it("creates a BUY_X_GET_Y offer", async () => {
    mockCreate.mockResolvedValue(makeOffer({ type: "BUY_X_GET_Y" }) as never);

    await svc.create(SHOP, {
      name: "Buy 2 get 1",
      type: "BUY_X_GET_Y",
      discountRules: { buyQuantity: 2, getQuantity: 1 },
      triggerRules: [],
      displaySettings: {},
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it("creates a FREE_GIFT offer", async () => {
    mockCreate.mockResolvedValue(makeOffer({ type: "FREE_GIFT" }) as never);

    await svc.create(SHOP, {
      name: "Free gift over $50",
      type: "FREE_GIFT",
      discountRules: { threshold: 50 },
      triggerRules: [],
      displaySettings: {},
    });

    expect(mockCreate).toHaveBeenCalled();
  });
});

describe("OfferService — validateDiscountRules", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
  });

  it("throws when percentage is above 100", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "PERCENTAGE_DISCOUNT",
        discountRules: { percentage: 110 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("percentage must be between 0 and 100");
  });

  it("throws when percentage is negative", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "PERCENTAGE_DISCOUNT",
        discountRules: { percentage: -5 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("percentage must be between 0 and 100");
  });

  it("throws when PRODUCT_DISCOUNT percentage is missing", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "PRODUCT_DISCOUNT",
        discountRules: {},
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("percentage must be between 0 and 100");
  });

  it("throws when ORDER_DISCOUNT amount is zero", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "ORDER_DISCOUNT",
        discountRules: { amount: 0 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("amount must be a positive number");
  });

  it("throws when ORDER_DISCOUNT amount is missing", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "ORDER_DISCOUNT",
        discountRules: {},
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("amount must be a positive number");
  });

  it("throws when FREE_SHIPPING threshold is negative", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "FREE_SHIPPING",
        discountRules: { threshold: -1 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("threshold must be a non-negative number");
  });

  it("throws when VOLUME_DISCOUNT has no tiers", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "VOLUME_DISCOUNT",
        discountRules: { tiers: [] },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("VOLUME_DISCOUNT requires at least one tier");
  });

  it("throws when QUANTITY_BREAK has no tiers", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "QUANTITY_BREAK",
        discountRules: {},
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("QUANTITY_BREAK requires at least one tier");
  });

  it("throws when BUY_X_GET_Y buyQuantity is zero", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "BUY_X_GET_Y",
        discountRules: { buyQuantity: 0, getQuantity: 1 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("buyQuantity must be at least 1");
  });

  it("throws when BUY_X_GET_Y getQuantity is missing", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "BUY_X_GET_Y",
        discountRules: { buyQuantity: 2 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("getQuantity must be at least 1");
  });

  it("throws when FREE_GIFT threshold is zero", async () => {
    await expect(
      svc.create(SHOP, {
        name: "Bad",
        type: "FREE_GIFT",
        discountRules: { threshold: 0 },
        triggerRules: [],
        displaySettings: {},
      })
    ).rejects.toThrow("FREE_GIFT requires a positive threshold");
  });
});

describe("OfferService.update", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
  });

  it("updates a DRAFT offer fully", async () => {
    mockFindFirst.mockResolvedValue(makeOffer() as never);
    mockUpdate.mockResolvedValue(makeOffer({ name: "Updated" }) as never);

    await svc.update(SHOP, "offer-1", { name: "Updated" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "offer-1" } })
    );
  });

  it("only updates name and displaySettings for ACTIVE offers", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);
    mockUpdate.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);

    await svc.update(SHOP, "offer-1", {
      name: "New name",
      displaySettings: { color: "red" },
      discountRules: { percentage: 99 },
    });

    const callData = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callData.data).toHaveProperty("name", "New name");
    expect(callData.data).not.toHaveProperty("discountRules");
  });

  it("validates discount rules on type change for non-ACTIVE", async () => {
    mockFindFirst.mockResolvedValue(makeOffer() as never);

    await expect(
      svc.update(SHOP, "offer-1", {
        type: "ORDER_DISCOUNT",
        discountRules: { amount: -10 },
      })
    ).rejects.toThrow("amount must be a positive number");
  });
});

describe("OfferService.delete", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes a DRAFT offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer() as never);
    await svc.delete(SHOP, "offer-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "offer-1" } });
  });

  it("throws when trying to delete an ACTIVE offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);
    await expect(svc.delete(SHOP, "offer-1")).rejects.toThrow(
      "Cannot delete an ACTIVE offer"
    );
  });
});

describe("OfferService.activate", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
    mockUpdate.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);
  });

  it("activates a DRAFT offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "DRAFT" }) as never);
    await svc.activate(SHOP, "offer-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
  });

  it("activates a PAUSED offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "PAUSED" }) as never);
    await svc.activate(SHOP, "offer-1");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("throws when activating an ACTIVE offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);
    await expect(svc.activate(SHOP, "offer-1")).rejects.toThrow(
      "Cannot activate offer in status: ACTIVE"
    );
  });

  it("throws when activating an ARCHIVED offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "ARCHIVED" }) as never);
    await expect(svc.activate(SHOP, "offer-1")).rejects.toThrow(
      "Cannot activate offer in status: ARCHIVED"
    );
  });
});

describe("OfferService.pause", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
    mockUpdate.mockResolvedValue(makeOffer({ status: "PAUSED" }) as never);
  });

  it("pauses an ACTIVE offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "ACTIVE" }) as never);
    await svc.pause(SHOP, "offer-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
  });

  it("throws when pausing a DRAFT offer", async () => {
    mockFindFirst.mockResolvedValue(makeOffer({ status: "DRAFT" }) as never);
    await expect(svc.pause(SHOP, "offer-1")).rejects.toThrow(
      "Cannot pause offer in status: DRAFT"
    );
  });
});

describe("OfferService.archive", () => {
  let svc: OfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new OfferService();
    mockFindFirst.mockResolvedValue(makeOffer() as never);
    mockUpdate.mockResolvedValue(makeOffer({ status: "ARCHIVED" }) as never);
  });

  it("archives any offer regardless of status", async () => {
    await svc.archive(SHOP, "offer-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ARCHIVED" } })
    );
  });

  it("throws when offer not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.archive(SHOP, "missing")).rejects.toThrow("Offer not found");
  });
});
