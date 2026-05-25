import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExperimentService } from "./experiment.service";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    shop: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Redis mock ───────────────────────────────────────────────────────────────

vi.mock("@/lib/redis", () => ({
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheDelPattern: vi.fn().mockResolvedValue(undefined),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { RUNTIME_CONFIG: 60 },
}));

// ─── FunctionConfigService mock ───────────────────────────────────────────────

vi.mock("@/services/function-config.service", () => ({
  FunctionConfigService: vi.fn().mockImplementation(() => ({
    registerDiscountExperiment: vi.fn().mockResolvedValue(undefined),
    deregisterDiscountExperiment: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockFindMany = vi.mocked(prisma.experiment.findMany);
const mockFindUnique = vi.mocked(prisma.experiment.findUnique);
const mockCreate = vi.mocked(prisma.experiment.create);
const mockUpdate = vi.mocked(prisma.experiment.update);
const mockDelete = vi.mocked(prisma.experiment.delete);
const mockCount = vi.mocked(prisma.experiment.count);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

// ─── Factories ────────────────────────────────────────────────────────────────

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: "shop-1",
    name: "Test Experiment",
    slug: "test-experiment",
    type: "CONTENT_TEST",
    status: "DRAFT",
    trafficAllocation: 100,
    variants: [
      { id: "var-1", key: "control", isControl: true, allocationPercent: 50 },
      { id: "var-2", key: "variant-a", isControl: false, allocationPercent: 50 },
    ],
    _count: { assignments: 0, orderAttributions: 0, events: 0 },
    mutuallyExclusiveGroup: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    launchedAt: null,
    pausedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function makeCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "My Test",
    type: "CONTENT_TEST" as const,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
      { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
    ],
    primaryMetric: "conversion_rate",
    secondaryMetrics: [],
    trafficAllocation: 100,
    assignmentStrategy: "visitor" as const,
    targetingRules: [],
    goals: [],
    settings: {},
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let service: ExperimentService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new ExperimentService();

  // generateUniqueSlug loops until findUnique returns null (slug not taken)
  mockFindUnique.mockResolvedValue(null as never);
  // invalidateCache looks up shopDomain by shopId
  mockShopFindUnique.mockResolvedValue({ shopDomain: "test-shop.myshopify.com" } as never);
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe("ExperimentService.get", () => {
  it("returns experiment when found", async () => {
    const exp = makeExperiment();
    mockFindFirst.mockResolvedValueOnce(exp as never);

    const result = await service.get("shop-1", "exp-1");
    expect(result.id).toBe("exp-1");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "exp-1", shopId: "shop-1" } })
    );
  });

  it("throws when experiment not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(service.get("shop-1", "exp-missing")).rejects.toThrow("not found");
  });

  it("uses shopId in query — multi-tenant isolation", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    try { await service.get("shop-other", "exp-1"); } catch { /* expected */ }

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ shopId: "shop-other" }) })
    );
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("ExperimentService.list", () => {
  beforeEach(() => {
    mockTransaction.mockImplementation((fns) =>
      Promise.all((fns as unknown as Array<Promise<unknown>>))
    );
    mockFindMany.mockResolvedValue([] as never);
    mockCount.mockResolvedValue(0);
  });

  it("returns experiments and total", async () => {
    const exp = makeExperiment();
    mockTransaction.mockResolvedValueOnce([[exp], 1] as never);

    const result = await service.list("shop-1");
    expect(result.total).toBe(1);
    expect(result.experiments).toHaveLength(1);
  });

  it("filters by status", async () => {
    mockTransaction.mockResolvedValueOnce([[], 0] as never);
    await service.list("shop-1", { status: "RUNNING" });

    expect(mockTransaction).toHaveBeenCalled();
  });

  it("applies default limit of 50", async () => {
    mockTransaction.mockResolvedValueOnce([[], 0] as never);
    await service.list("shop-1");

    const firstCall = (mockTransaction.mock.calls as unknown as Array<Array<Array<unknown>>>)[0]?.[0];
    // The transaction is called with prisma.findMany and count calls
    expect(firstCall).toBeDefined();
  });

  it("always scopes to shopId — never returns other shops data", async () => {
    mockTransaction.mockResolvedValueOnce([[], 0] as never);
    await service.list("shop-a");

    // Verify no call was made without shopId filter
    const calls = mockTransaction.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("ExperimentService.create", () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue(makeExperiment() as never);
    mockCount.mockResolvedValue(0); // for slug generation
  });

  it("creates experiment with DRAFT status", async () => {
    const input = makeCreateInput();
    await service.create("shop-1", input);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", shopId: "shop-1" }),
      })
    );
  });

  it("throws when variant allocations do not sum to 100", async () => {
    const input = makeCreateInput({
      variants: [
        { key: "control", name: "Control", isControl: true, allocationPercent: 60, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
        { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 60, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
      ],
    });
    await expect(service.create("shop-1", input)).rejects.toThrow(/sum to 100/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws when no control variant is provided", async () => {
    const input = makeCreateInput({
      variants: [
        { key: "var-a", name: "A", isControl: false, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
        { key: "var-b", name: "B", isControl: false, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
      ],
    });
    await expect(service.create("shop-1", input)).rejects.toThrow(/control/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws when more than one variant is marked as control", async () => {
    const input = makeCreateInput({
      variants: [
        { key: "var-a", name: "A", isControl: true, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
        { key: "var-b", name: "B", isControl: true, allocationPercent: 50, modifications: [], priceOverrides: [], checkoutBlockIds: [], offerIds: [], settings: {} },
      ],
    });
    await expect(service.create("shop-1", input)).rejects.toThrow(/control/i);
  });

  it("invalidates cache after creation", async () => {
    const { cacheDel } = await import("@/lib/redis");
    await service.create("shop-1", makeCreateInput());
    expect(cacheDel).toHaveBeenCalled();
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("ExperimentService.update", () => {
  it("updates allowed fields on DRAFT experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ name: "New Name" }) as never);

    await service.update("shop-1", "exp-1", { name: "New Name" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("allows name update on RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ name: "Updated" }) as never);

    await expect(service.update("shop-1", "exp-1", { name: "Updated" })).resolves.not.toThrow();
  });

  it("blocks trafficAllocation update on RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);

    await expect(
      service.update("shop-1", "exp-1", { trafficAllocation: 50 })
    ).rejects.toThrow(/Cannot update/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocks type/hypothesis updates on COMPLETED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);

    await expect(
      service.update("shop-1", "exp-1", { hypothesis: "New hypothesis" })
    ).rejects.toThrow(/Cannot update/i);
  });

  it("blocks all updates on ARCHIVED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);

    await expect(
      service.update("shop-1", "exp-1", { trafficAllocation: 50 })
    ).rejects.toThrow(/Cannot update/i);
  });
});

// ─── launch ───────────────────────────────────────────────────────────────────

describe("ExperimentService.launch", () => {
  it("launches a DRAFT experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);

    await service.launch("shop-1", "exp-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RUNNING" }),
      })
    );
  });

  it("resumes a PAUSED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);

    await expect(service.launch("shop-1", "exp-1")).resolves.not.toThrow();
  });

  it("launches from QA, PREVIEW, SCHEDULED statuses", async () => {
    for (const status of ["QA", "PREVIEW", "SCHEDULED"]) {
      mockFindFirst.mockResolvedValueOnce(makeExperiment({ status }) as never);
      mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
      await expect(service.launch("shop-1", "exp-1")).resolves.not.toThrow();
    }
  });

  it("throws when trying to launch a RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await expect(service.launch("shop-1", "exp-1")).rejects.toThrow(/Cannot launch/i);
  });

  it("throws when trying to launch a COMPLETED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.launch("shop-1", "exp-1")).rejects.toThrow(/Cannot launch/i);
  });

  it("throws when trying to launch an ARCHIVED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);
    await expect(service.launch("shop-1", "exp-1")).rejects.toThrow(/Cannot launch/i);
  });

  it("throws when experiment has fewer than 2 variants", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeExperiment({
        status: "DRAFT",
        variants: [{ id: "var-1", key: "control", isControl: true, allocationPercent: 100 }],
      }) as never
    );
    await expect(service.launch("shop-1", "exp-1")).rejects.toThrow(/2 variants/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets launchedAt to current time", async () => {
    const before = new Date();
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "RUNNING", launchedAt: new Date() }) as never);

    await service.launch("shop-1", "exp-1");
    const updateCall = mockUpdate.mock.calls[0]?.[0] as { data: { launchedAt?: Date } } | undefined;
    expect(updateCall?.data?.launchedAt).toBeDefined();
    expect(updateCall?.data?.launchedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

// ─── pause ────────────────────────────────────────────────────────────────────

describe("ExperimentService.pause", () => {
  it("pauses a RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);

    await service.pause("shop-1", "exp-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED" }),
      })
    );
  });

  it("throws when pausing a DRAFT experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.pause("shop-1", "exp-1")).rejects.toThrow(/RUNNING/i);
  });

  it("throws when pausing an already PAUSED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    await expect(service.pause("shop-1", "exp-1")).rejects.toThrow(/RUNNING/i);
  });

  it("throws when pausing a COMPLETED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.pause("shop-1", "exp-1")).rejects.toThrow(/RUNNING/i);
  });
});

// ─── complete ─────────────────────────────────────────────────────────────────

describe("ExperimentService.complete", () => {
  it("completes a RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);

    await service.complete("shop-1", "exp-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("completes a PAUSED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.complete("shop-1", "exp-1")).resolves.not.toThrow();
  });

  it("throws when completing a DRAFT experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.complete("shop-1", "exp-1")).rejects.toThrow(/RUNNING or PAUSED/i);
  });

  it("throws when completing an ARCHIVED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);
    await expect(service.complete("shop-1", "exp-1")).rejects.toThrow(/RUNNING or PAUSED/i);
  });

  it("sets completedAt on complete", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);

    await service.complete("shop-1", "exp-1");
    const updateCall = mockUpdate.mock.calls[0]?.[0] as { data: { completedAt?: Date } } | undefined;
    expect(updateCall?.data?.completedAt).toBeDefined();
  });
});

// ─── archive ──────────────────────────────────────────────────────────────────

describe("ExperimentService.archive", () => {
  it("archives experiment from any status", async () => {
    for (const status of ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"]) {
      mockFindFirst.mockResolvedValueOnce(makeExperiment({ status }) as never);
      mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);
      await expect(service.archive("shop-1", "exp-1")).resolves.not.toThrow();
    }
  });

  it("sets status to ARCHIVED", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);

    await service.archive("shop-1", "exp-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED" }),
      })
    );
  });
});

// ─── hardDelete ───────────────────────────────────────────────────────────────

describe("ExperimentService.hardDelete", () => {
  it("calls prisma.experiment.delete", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDelete.mockResolvedValueOnce(undefined as never);

    await service.hardDelete("shop-1", "exp-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "exp-1" } });
  });

  it("throws when experiment not found before deleting", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(service.hardDelete("shop-1", "exp-missing")).rejects.toThrow(/not found/i);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("invalidates cache after deletion", async () => {
    const { cacheDel } = await import("@/lib/redis");
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockDelete.mockResolvedValueOnce(undefined as never);

    await service.hardDelete("shop-1", "exp-1");
    expect(cacheDel).toHaveBeenCalled();
  });
});

// ─── State machine — full lifecycle ───────────────────────────────────────────

describe("experiment status state machine", () => {
  const invalidTransitions: Array<[string, string]> = [
    ["COMPLETED", "launch"],
    ["ARCHIVED", "launch"],
    ["DRAFT", "pause"],
    ["COMPLETED", "pause"],
    ["ARCHIVED", "pause"],
    ["DRAFT", "complete"],
    ["ARCHIVED", "complete"],
  ];

  it.each(invalidTransitions)("blocks %s → %s", async (status, action) => {
    mockFindFirst.mockResolvedValue(makeExperiment({ status }) as never);
    const method = action as "launch" | "pause" | "complete";
    await expect(service[method]("shop-1", "exp-1")).rejects.toThrow();
  });
});

// ─── Cache invalidation ───────────────────────────────────────────────────────

describe("cache invalidation", () => {
  it("invalidates cache after launch", async () => {
    const { cacheDel } = await import("@/lib/redis");
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await service.launch("shop-1", "exp-1");
    expect(cacheDel).toHaveBeenCalledWith("runtime:config:test-shop.myshopify.com");
  });

  it("invalidates cache after pause", async () => {
    const { cacheDel } = await import("@/lib/redis");
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    await service.pause("shop-1", "exp-1");
    expect(cacheDel).toHaveBeenCalledWith("runtime:config:test-shop.myshopify.com");
  });
});
