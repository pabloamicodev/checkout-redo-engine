import { describe, it, expect, vi, beforeEach } from "vitest";
import { PriceTestService } from "./price-test.service";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockExpCreate, mockExpLaunch, mockExpPause } = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
}));

const mockShopifyGraphQL = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    create: mockExpCreate,
    launch: mockExpLaunch,
    pause: mockExpPause,
  })),
}));

vi.mock("@/lib/shopify-admin-graphql", () => ({
  shopifyAdminGraphQL: mockShopifyGraphQL,
}));

vi.mock("@/lib/redis", () => ({
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheDelPattern: vi.fn().mockResolvedValue(undefined),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { RUNTIME_CONFIG: 60 },
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockFindMany = vi.mocked(prisma.experiment.findMany);
const mockCount = vi.mocked(prisma.experiment.count);
const mockUpdate = vi.mocked(prisma.experiment.update);

// ─── Factories ────────────────────────────────────────────────────────────────

const SHOP_ID = "shop-1";
const SHOP_DOMAIN = "test-shop.myshopify.com";
const EXP_ID = "exp-1";
const CTRL_VAR_ID = "var-ctrl";
const TEST_VAR_ID = "var-test";

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: CTRL_VAR_ID,
    key: "control",
    name: "Control",
    isControl: true,
    allocationPercent: 50,
    priceOverrides: [
      {
        shopifyVariantId: "gid://shopify/ProductVariant/111",
        shopifyProductId: "gid://shopify/Product/999",
        price: "29.99",
        compareAtPrice: null,
      },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    shopId: SHOP_ID,
    type: "PRICE_TEST",
    status: "DRAFT",
    name: "My Price Test",
    settings: {},
    variants: [
      makeVariant({ id: CTRL_VAR_ID, key: "control", isControl: true }),
      makeVariant({ id: TEST_VAR_ID, key: "variant-a", name: "Variant A", isControl: false }),
    ],
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<Parameters<PriceTestService["create"]>[1]> = {}) {
  return {
    name: "My Price Test",
    trafficAllocation: 100,
    enforcementStrategy: "DISPLAY_ONLY" as const,
    variants: [
      {
        key: "control",
        name: "Control",
        isControl: true,
        allocationPercent: 50,
        priceOverrides: [
          { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "29.99" },
        ],
      },
      {
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        priceOverrides: [
          { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
        ],
      },
    ],
    ...overrides,
  };
}

// Shopify backup response
function makeShopifyBackupResponse(variantIds: string[]) {
  return {
    nodes: variantIds.map((id) => ({
      id,
      price: "29.99",
      compareAtPrice: null,
    })),
  };
}

// Shopify mutation success response
const SHOPIFY_MUTATION_SUCCESS = {
  productVariantUpdate: {
    productVariant: { id: "gid://shopify/ProductVariant/111", price: "24.99", compareAtPrice: null },
    userErrors: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([] as never);
  mockCount.mockResolvedValue(0);
  mockUpdate.mockResolvedValue({} as never);
  mockExpCreate.mockResolvedValue(makeExperiment() as never);
  mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
  mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("PriceTestService.list", () => {
  const service = new PriceTestService();

  it("returns items and total", async () => {
    const exp = makeExperiment();
    mockFindMany.mockResolvedValueOnce([exp] as never);
    mockCount.mockResolvedValueOnce(1);

    const result = await service.list(SHOP_ID);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("scopes to shopId and PRICE_TEST type", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockCount.mockResolvedValueOnce(0);

    await service.list(SHOP_ID);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shopId: SHOP_ID, type: "PRICE_TEST" }),
      })
    );
  });

  it("filters by status when provided", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockCount.mockResolvedValueOnce(0);

    await service.list(SHOP_ID, { status: "RUNNING" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "RUNNING" }),
      })
    );
  });

  it("caps limit at 200", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockCount.mockResolvedValueOnce(0);

    await service.list(SHOP_ID, { limit: 9999 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it("paginates using page parameter", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockCount.mockResolvedValueOnce(0);

    await service.list(SHOP_ID, { page: 3, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("orders by updatedAt desc", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockCount.mockResolvedValueOnce(0);

    await service.list(SHOP_ID);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: "desc" } })
    );
  });
});

// ─── validateInput (tested via create) ───────────────────────────────────────

describe("PriceTestService.create — validateInput", () => {
  const service = new PriceTestService();

  it("throws when fewer than 2 variants", async () => {
    const input = makeCreateInput({ variants: [makeCreateInput().variants[0]!] });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("at least 2 variants");
  });

  it("throws when no control variant", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, isControl: false },
        { ...makeCreateInput().variants[1]!, isControl: false },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Exactly one control");
  });

  it("throws when more than one control variant", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, isControl: true },
        { ...makeCreateInput().variants[1]!, isControl: true },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Exactly one control");
  });

  it("throws when allocations do not sum to 100", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, allocationPercent: 60 },
        { ...makeCreateInput().variants[1]!, allocationPercent: 60 },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Allocations must sum to 100");
  });

  it("allows allocation sum within 0.01% tolerance", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, allocationPercent: 50.005 },
        { ...makeCreateInput().variants[1]!, allocationPercent: 49.995 },
      ],
    });
    // Should NOT throw — within tolerance
    await expect(service.create(SHOP_ID, input)).resolves.toBeDefined();
  });

  it("throws when a price is zero", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        {
          ...makeCreateInput().variants[1]!,
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "0" },
          ],
        },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("price must be a positive number");
  });

  it("throws when a price is negative", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        {
          ...makeCreateInput().variants[1]!,
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "-5.00" },
          ],
        },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("price must be a positive number");
  });

  it("throws when a price is not a number", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        {
          ...makeCreateInput().variants[1]!,
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "abc" },
          ],
        },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("price must be a positive number");
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("PriceTestService.create — happy path", () => {
  const service = new PriceTestService();

  it("delegates to ExperimentService.create with PRICE_TEST type", async () => {
    await service.create(SHOP_ID, makeCreateInput());

    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "PRICE_TEST" })
    );
  });

  it("sets primaryMetric to revenue_per_visitor", async () => {
    await service.create(SHOP_ID, makeCreateInput());

    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ primaryMetric: "revenue_per_visitor" })
    );
  });

  it("includes enforcementStrategy in priceConfig", async () => {
    await service.create(SHOP_ID, makeCreateInput({ enforcementStrategy: "SHOPIFY_FUNCTION" }));

    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({
        priceConfig: expect.objectContaining({ enforcementStrategy: "SHOPIFY_FUNCTION" }),
      })
    );
  });

  it("maps variants with priceOverrides to ExperimentService", async () => {
    await service.create(SHOP_ID, makeCreateInput());

    const callArgs = mockExpCreate.mock.calls[0]![1] as { variants: unknown[] };
    expect(callArgs.variants).toHaveLength(2);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe("PriceTestService.get", () => {
  const service = new PriceTestService();

  it("returns the experiment when found", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    const result = await service.get(SHOP_ID, EXP_ID);
    expect(result.id).toBe(EXP_ID);
  });

  it("throws when experiment is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(service.get(SHOP_ID, EXP_ID)).rejects.toThrow("Price test not found");
  });

  it("scopes query to shopId and PRICE_TEST type", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    await service.get(SHOP_ID, EXP_ID);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: EXP_ID, shopId: SHOP_ID, type: "PRICE_TEST" }),
      })
    );
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("PriceTestService.update", () => {
  const service = new PriceTestService();

  it("updates name, description, hypothesis", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment({ name: "New Name" }) as never);

    const result = await service.update(SHOP_ID, EXP_ID, {
      name: "New Name",
      description: "New description",
      hypothesis: "New hypothesis",
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXP_ID },
        data: expect.objectContaining({
          name: "New Name",
          description: "New description",
          hypothesis: "New hypothesis",
        }),
      })
    );
    expect(result).toBeDefined();
  });

  it("throws when experiment is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(service.update(SHOP_ID, EXP_ID, { name: "x" })).rejects.toThrow("Price test not found");
  });

  it("trims whitespace from name", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment() as never);
    mockUpdate.mockResolvedValueOnce(makeExperiment() as never);

    await service.update(SHOP_ID, EXP_ID, { name: "  Padded Name  " });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Padded Name" }) })
    );
  });
});

// ─── activate ─────────────────────────────────────────────────────────────────

describe("PriceTestService.activate", () => {
  const service = new PriceTestService();

  it("launches a DRAFT experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await service.activate(SHOP_ID, EXP_ID);
    expect(mockExpLaunch).toHaveBeenCalledWith(SHOP_ID, EXP_ID);
  });

  it("returns early without re-launching a RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await service.activate(SHOP_ID, EXP_ID);
    expect(mockExpLaunch).not.toHaveBeenCalled();
  });

  it("throws when trying to activate a COMPLETED test", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.activate(SHOP_ID, EXP_ID)).rejects.toThrow("Cannot activate a completed test");
  });

  it("throws when trying to activate an ARCHIVED test", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "ARCHIVED" }) as never);
    await expect(service.activate(SHOP_ID, EXP_ID)).rejects.toThrow("Cannot activate an archived test");
  });

  it("also launches a PAUSED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    await service.activate(SHOP_ID, EXP_ID);
    expect(mockExpLaunch).toHaveBeenCalledWith(SHOP_ID, EXP_ID);
  });
});

// ─── pause ────────────────────────────────────────────────────────────────────

describe("PriceTestService.pause", () => {
  const service = new PriceTestService();

  it("pauses a RUNNING experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await service.pause(SHOP_ID, EXP_ID);
    expect(mockExpPause).toHaveBeenCalledWith(SHOP_ID, EXP_ID);
  });

  it("returns early without re-pausing a PAUSED experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "PAUSED" }) as never);
    await service.pause(SHOP_ID, EXP_ID);
    expect(mockExpPause).not.toHaveBeenCalled();
  });

  it("throws when trying to pause a DRAFT test", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.pause(SHOP_ID, EXP_ID)).rejects.toThrow("Cannot pause");
  });

  it("throws when trying to pause a COMPLETED test", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.pause(SHOP_ID, EXP_ID)).rejects.toThrow("Cannot pause");
  });
});

// ─── rollout ──────────────────────────────────────────────────────────────────

describe("PriceTestService.rollout", () => {
  const service = new PriceTestService();

  function setupRolloutMocks() {
    const exp = makeExperiment({
      status: "RUNNING",
      variants: [
        makeVariant({ id: CTRL_VAR_ID, isControl: true }),
        makeVariant({
          id: TEST_VAR_ID,
          key: "variant-a",
          name: "Variant A",
          isControl: false,
          priceOverrides: [
            {
              shopifyVariantId: "gid://shopify/ProductVariant/111",
              shopifyProductId: "gid://shopify/Product/999",
              price: "24.99",
              compareAtPrice: null,
            },
          ],
        }),
      ],
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL
      .mockResolvedValueOnce(makeShopifyBackupResponse(["gid://shopify/ProductVariant/111"])) // backup query
      .mockResolvedValueOnce(SHOPIFY_MUTATION_SUCCESS); // apply mutation
  }

  it("throws when confirmationToken does not match experimentId", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await expect(
      service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, "WRONG-TOKEN", SHOP_DOMAIN)
    ).rejects.toThrow("Invalid confirmation token");
  });

  it("throws when experiment is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN)
    ).rejects.toThrow("Price test not found");
  });

  it("throws when winner variant is not in experiment", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "RUNNING" }) as never);
    await expect(
      service.rollout(SHOP_ID, EXP_ID, "non-existent-var", EXP_ID, SHOP_DOMAIN)
    ).rejects.toThrow("Winner variant not found");
  });

  it("throws when winner variant has no price overrides", async () => {
    const exp = makeExperiment({
      status: "RUNNING",
      variants: [
        makeVariant({ id: CTRL_VAR_ID, isControl: true }),
        makeVariant({ id: TEST_VAR_ID, isControl: false, priceOverrides: [] }),
      ],
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    await expect(
      service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN)
    ).rejects.toThrow("no price overrides to roll out");
  });

  it("returns rolledOut count and backup on success", async () => {
    setupRolloutMocks();

    const result = await service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN);

    expect(result.rolledOut).toBe(1);
    expect(result.backup).toHaveLength(1);
    expect(result.backup[0]!.originalPrice).toBe("29.99");
  });

  it("backs up prices before applying new ones", async () => {
    setupRolloutMocks();

    await service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN);

    const calls = mockShopifyGraphQL.mock.calls;
    // First call should be backup query (query keyword), second is mutation
    const firstCallQuery = calls[0]![1] as string;
    expect(firstCallQuery).toContain("GetVariantPrices");
  });

  it("records rollout in experiment settings with winnerVariantId and backup", async () => {
    setupRolloutMocks();

    await service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXP_ID },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            rollout: expect.objectContaining({
              winnerVariantId: TEST_VAR_ID,
              rolledOutCount: 1,
            }),
          }),
        }),
      })
    );
  });

  it("throws and stops when Shopify mutation returns userErrors", async () => {
    const exp = makeExperiment({
      status: "RUNNING",
      variants: [
        makeVariant({ id: CTRL_VAR_ID, isControl: true }),
        makeVariant({
          id: TEST_VAR_ID,
          isControl: false,
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
          ],
        }),
      ],
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL
      .mockResolvedValueOnce(makeShopifyBackupResponse(["gid://shopify/ProductVariant/111"]))
      .mockResolvedValueOnce({
        productVariantUpdate: {
          productVariant: null,
          userErrors: [{ message: "Variant not found in Shopify" }],
        },
      });

    await expect(
      service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN)
    ).rejects.toThrow("Shopify price update failed: Variant not found in Shopify");
  });

  it("throws when Shopify backup query fails", async () => {
    const exp = makeExperiment({
      status: "RUNNING",
      variants: [
        makeVariant({ id: CTRL_VAR_ID, isControl: true }),
        makeVariant({
          id: TEST_VAR_ID,
          isControl: false,
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
          ],
        }),
      ],
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockRejectedValueOnce(new Error("Shopify API timeout"));

    await expect(
      service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN)
    ).rejects.toThrow("Shopify API timeout");

    // Settings update must NOT be called if backup or apply fails
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─── rollback ─────────────────────────────────────────────────────────────────

describe("PriceTestService.rollback", () => {
  const service = new PriceTestService();

  const ROLLOUT_BACKUP = {
    backup: [
      {
        variantId: "gid://shopify/ProductVariant/111",
        originalPrice: "29.99",
        originalCompareAtPrice: null,
        backedUpAt: new Date().toISOString(),
      },
    ],
    rolledOutAt: new Date().toISOString(),
  };

  it("throws when experiment is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN)).rejects.toThrow("Price test not found");
  });

  it("throws when no rollout backup exists in settings", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ settings: {} }) as never);
    await expect(service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN)).rejects.toThrow(
      "No rollout backup found"
    );
  });

  it("throws when backup is older than 30 days", async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const exp = makeExperiment({
      settings: {
        rollout: { ...ROLLOUT_BACKUP, rolledOutAt: thirtyOneDaysAgo },
      },
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);

    await expect(service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN)).rejects.toThrow(
      "Rollback not available — backup is older than 30 days"
    );
  });

  it("restores original prices and returns count", async () => {
    const exp = makeExperiment({ settings: { rollout: ROLLOUT_BACKUP } });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockResolvedValueOnce(SHOPIFY_MUTATION_SUCCESS);

    const result = await service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN);

    expect(result.restored).toBe(1);
    expect(mockShopifyGraphQL).toHaveBeenCalledWith(
      SHOP_DOMAIN,
      expect.stringContaining("UpdateVariantPrice"),
      expect.objectContaining({
        input: expect.objectContaining({
          id: "gid://shopify/ProductVariant/111",
          price: "29.99",
        }),
      })
    );
  });

  it("clears rollout from settings after successful rollback", async () => {
    const exp = makeExperiment({ settings: { rollout: ROLLOUT_BACKUP, someOtherKey: "preserved" } });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockResolvedValueOnce(SHOPIFY_MUTATION_SUCCESS);

    await service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN);

    const updateCall = mockUpdate.mock.calls[0]![0]! as { data: { settings: Record<string, unknown> } };
    expect(updateCall.data.settings).not.toHaveProperty("rollout");
    expect(updateCall.data.settings).toHaveProperty("rolledBackAt");
    expect(updateCall.data.settings["someOtherKey"]).toBe("preserved");
  });

  it("preserves backup within 30-day window (day 29)", async () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
    const exp = makeExperiment({
      settings: { rollout: { ...ROLLOUT_BACKUP, rolledOutAt: twentyNineDaysAgo } },
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockResolvedValueOnce(SHOPIFY_MUTATION_SUCCESS);

    const result = await service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN);
    expect(result.restored).toBe(1);
  });

  it("throws when Shopify restore mutation returns userErrors", async () => {
    const exp = makeExperiment({ settings: { rollout: ROLLOUT_BACKUP } });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockResolvedValueOnce({
      productVariantUpdate: {
        productVariant: null,
        userErrors: [{ message: "Variant is archived" }],
      },
    });

    await expect(service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN)).rejects.toThrow(
      "Shopify price update failed: Variant is archived"
    );
  });

  it("does not update settings if Shopify restore fails", async () => {
    const exp = makeExperiment({ settings: { rollout: ROLLOUT_BACKUP } });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    mockShopifyGraphQL.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(service.rollback(SHOP_ID, EXP_ID, SHOP_DOMAIN)).rejects.toThrow("Network timeout");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─── Multi-variant rollout ────────────────────────────────────────────────────

describe("PriceTestService.rollout — multiple price overrides", () => {
  const service = new PriceTestService();

  it("rolls out all price overrides in winner variant", async () => {
    const priceOverrides = [
      { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
      { shopifyVariantId: "gid://shopify/ProductVariant/222", shopifyProductId: "gid://shopify/Product/999", price: "34.99" },
      { shopifyVariantId: "gid://shopify/ProductVariant/333", shopifyProductId: "gid://shopify/Product/999", price: "44.99" },
    ];
    const exp = makeExperiment({
      status: "RUNNING",
      variants: [
        makeVariant({ id: CTRL_VAR_ID, isControl: true }),
        makeVariant({ id: TEST_VAR_ID, isControl: false, priceOverrides }),
      ],
    });
    mockFindFirst.mockResolvedValueOnce(exp as never);
    // Backup query + 3 apply mutations
    mockShopifyGraphQL
      .mockResolvedValueOnce(makeShopifyBackupResponse(["gid://shopify/ProductVariant/111", "gid://shopify/ProductVariant/222", "gid://shopify/ProductVariant/333"]))
      .mockResolvedValue(SHOPIFY_MUTATION_SUCCESS);

    const result = await service.rollout(SHOP_ID, EXP_ID, TEST_VAR_ID, EXP_ID, SHOP_DOMAIN);

    expect(result.rolledOut).toBe(3);
    expect(result.backup).toHaveLength(3);
    // backup + 3 apply calls
    expect(mockShopifyGraphQL).toHaveBeenCalledTimes(4);
  });
});
