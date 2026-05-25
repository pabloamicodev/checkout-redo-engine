import { describe, it, expect, vi, beforeEach } from "vitest";
import { CheckoutBlockService } from "./checkout-block.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutBlock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    event: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.checkoutBlock.findMany);
const mockFindFirst = vi.mocked(prisma.checkoutBlock.findFirst);
const mockCreate = vi.mocked(prisma.checkoutBlock.create);
const mockUpdate = vi.mocked(prisma.checkoutBlock.update);
const mockDelete = vi.mocked(prisma.checkoutBlock.delete);
const mockCount = vi.mocked(prisma.checkoutBlock.count);
const mockEventCount = vi.mocked(prisma.event.count);

const SHOP = "shop-1";

function makeBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: "block-1",
    shopId: SHOP,
    name: "Trust Badge",
    type: "TRUST_BADGE",
    status: "DRAFT",
    content: {},
    styles: {},
    targetingRules: [],
    experimentId: null,
    variantId: null,
    position: "above_payment",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("CheckoutBlockService.list", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockFindMany.mockResolvedValue([makeBlock()] as never);
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
    await svc.list(SHOP, { type: "OFFER_CARD" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "OFFER_CARD" }) })
    );
  });

  it("caps limit at 200", async () => {
    await svc.list(SHOP, { limit: 500 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it("calculates correct skip from page", async () => {
    await svc.list(SHOP, { page: 2, limit: 10 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

describe("CheckoutBlockService.get", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
  });

  it("returns the block when found", async () => {
    mockFindFirst.mockResolvedValue(makeBlock() as never);
    const result = await svc.get(SHOP, "block-1");
    expect(result.id).toBe("block-1");
  });

  it("throws when block not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.get(SHOP, "missing")).rejects.toThrow("CheckoutBlock not found: missing");
  });
});

describe("CheckoutBlockService.create", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockCreate.mockResolvedValue(makeBlock() as never);
  });

  it("creates a block with DRAFT status", async () => {
    await svc.create(SHOP, {
      name: "Trust Badge",
      type: "TRUST_BADGE" as never,
      content: {},
      styles: {},
      targetingRules: [],
      position: "above_payment",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shopId: SHOP, status: "DRAFT" }),
      })
    );
  });

  it("stores experimentId and variantId when provided", async () => {
    await svc.create(SHOP, {
      name: "Test Block",
      type: "TRUST_BADGE" as never,
      content: {},
      styles: {},
      targetingRules: [],
      position: "above_payment",
      experimentId: "exp-1",
      variantId: "var-1",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experimentId: "exp-1", variantId: "var-1" }),
      })
    );
  });
});

describe("CheckoutBlockService.update", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockUpdate.mockResolvedValue(makeBlock() as never);
  });

  it("updates a DRAFT block fully", async () => {
    mockFindFirst.mockResolvedValue(makeBlock() as never);

    await svc.update(SHOP, "block-1", {
      name: "New Name",
      content: { text: "hello" },
      targetingRules: [{ operator: "AND" as const, conditions: [{ type: "device", operator: "eq" as const, value: "mobile" }] }],
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "block-1" } })
    );
  });

  it("only allows name and styles updates for ACTIVE blocks", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "ACTIVE" }) as never);

    await svc.update(SHOP, "block-1", {
      name: "Safe Update",
      styles: { color: "red" },
      content: { text: "blocked" },
      targetingRules: [{ operator: "AND" as const, conditions: [{ type: "device", operator: "eq" as const, value: "mobile" }] }],
    });

    const callData = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callData.data).toHaveProperty("name", "Safe Update");
    expect(callData.data).not.toHaveProperty("content");
    expect(callData.data).not.toHaveProperty("targetingRules");
  });

  it("throws when block not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.update(SHOP, "missing", { name: "X" })).rejects.toThrow(
      "CheckoutBlock not found"
    );
  });
});

describe("CheckoutBlockService.delete", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes a DRAFT block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock() as never);
    await svc.delete(SHOP, "block-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "block-1" } });
  });

  it("deletes a PAUSED block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "PAUSED" }) as never);
    await svc.delete(SHOP, "block-1");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("throws when trying to delete an ACTIVE block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "ACTIVE" }) as never);
    await expect(svc.delete(SHOP, "block-1")).rejects.toThrow(
      "Cannot delete an ACTIVE checkout block"
    );
  });
});

describe("CheckoutBlockService.activate", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockUpdate.mockResolvedValue(makeBlock({ status: "ACTIVE" }) as never);
  });

  it("activates a DRAFT block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "DRAFT" }) as never);
    await svc.activate(SHOP, "block-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
  });

  it("activates a PAUSED block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "PAUSED" }) as never);
    await svc.activate(SHOP, "block-1");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("throws when activating an already ACTIVE block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "ACTIVE" }) as never);
    await expect(svc.activate(SHOP, "block-1")).rejects.toThrow(
      "Cannot activate a checkout block in status: ACTIVE"
    );
  });

  it("throws when activating an ARCHIVED block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "ARCHIVED" }) as never);
    await expect(svc.activate(SHOP, "block-1")).rejects.toThrow(
      "Cannot activate a checkout block in status: ARCHIVED"
    );
  });
});

describe("CheckoutBlockService.pause", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockUpdate.mockResolvedValue(makeBlock({ status: "PAUSED" }) as never);
  });

  it("pauses an ACTIVE block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "ACTIVE" }) as never);
    await svc.pause(SHOP, "block-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
  });

  it("throws when pausing a DRAFT block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "DRAFT" }) as never);
    await expect(svc.pause(SHOP, "block-1")).rejects.toThrow(
      "Cannot pause a checkout block in status: DRAFT"
    );
  });

  it("throws when pausing a PAUSED block", async () => {
    mockFindFirst.mockResolvedValue(makeBlock({ status: "PAUSED" }) as never);
    await expect(svc.pause(SHOP, "block-1")).rejects.toThrow(
      "Cannot pause a checkout block in status: PAUSED"
    );
  });
});

describe("CheckoutBlockService.archive", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
    mockFindFirst.mockResolvedValue(makeBlock() as never);
    mockUpdate.mockResolvedValue(makeBlock({ status: "ARCHIVED" }) as never);
  });

  it("archives any block regardless of status", async () => {
    await svc.archive(SHOP, "block-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ARCHIVED" } })
    );
  });

  it("throws when block not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.archive(SHOP, "missing")).rejects.toThrow("CheckoutBlock not found");
  });
});

describe("CheckoutBlockService.getAnalytics", () => {
  let svc: CheckoutBlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CheckoutBlockService();
  });

  it("calculates conversion rate", async () => {
    mockEventCount
      .mockResolvedValueOnce(100) // impressions
      .mockResolvedValueOnce(25);  // completions

    const result = await svc.getAnalytics(SHOP, "block-1");

    expect(result.blockId).toBe("block-1");
    expect(result.impressions).toBe(100);
    expect(result.completions).toBe(25);
    expect(result.conversionRate).toBe(25);
  });

  it("returns 0 conversion rate when no impressions", async () => {
    mockEventCount.mockResolvedValue(0);

    const result = await svc.getAnalytics(SHOP, "block-1");

    expect(result.conversionRate).toBe(0);
  });
});
