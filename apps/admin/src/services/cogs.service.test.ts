import { describe, it, expect, vi, beforeEach } from "vitest";
import { CogsService } from "./cogs.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productCost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    orderAttribution: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/shopify", () => ({
  getShopifyAdminClient: vi.fn(),
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.productCost.findMany);
const mockFindUnique = vi.mocked(prisma.productCost.findUnique);
const mockUpsert = vi.mocked(prisma.productCost.upsert);
const mockProductCostCount = vi.mocked(prisma.productCost.count);
const mockOACount = vi.mocked(prisma.orderAttribution.count);
const mockDelete = vi.mocked(prisma.productCost.delete);

const SHOP = "shop-1";

function makeCost(overrides: Record<string, unknown> = {}) {
  return {
    id: "cost-1",
    shopId: SHOP,
    shopifyVariantId: "gid://shopify/ProductVariant/111",
    shopifyProductId: "gid://shopify/Product/222",
    sku: "SKU-001",
    cost: 9.99,
    currencyCode: "USD",
    source: "MANUAL",
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("CogsService.list", () => {
  let svc: CogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CogsService();
    mockFindMany.mockResolvedValue([makeCost()] as never);
    mockProductCostCount.mockResolvedValue(1);
  });

  it("returns items and total", async () => {
    const result = await svc.list(SHOP);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("applies search filter via OR clause", async () => {
    await svc.list(SHOP, { search: "SKU-001" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ sku: expect.objectContaining({ contains: "SKU-001" }) }),
          ]),
        }),
      })
    );
  });

  it("does not include OR clause when search is empty", async () => {
    await svc.list(SHOP, { search: "" });
    const call = mockFindMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).not.toHaveProperty("OR");
  });

  it("uses page and limit for pagination", async () => {
    await svc.list(SHOP, { page: 2, limit: 10 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it("selects only summary fields", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          shopifyVariantId: true,
          cost: true,
        }),
      })
    );
  });
});

describe("CogsService.getCoverage", () => {
  let svc: CogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CogsService();
  });

  it("calculates coveragePct when there are orders", async () => {
    mockProductCostCount.mockResolvedValue(50);
    mockOACount
      .mockResolvedValueOnce(100) // ordersLast30Days
      .mockResolvedValueOnce(75);  // ordersWithCogs → 75% < 80 threshold

    const result = await svc.getCoverage(SHOP);

    expect(result.totalProductCosts).toBe(50);
    expect(result.ordersLast30Days).toBe(100);
    expect(result.ordersWithCogs).toBe(75);
    expect(result.coveragePct).toBe(75);
    expect(result.belowWarningThreshold).toBe(true);
  });

  it("returns coveragePct 100 when no orders in last 30 days", async () => {
    mockProductCostCount.mockResolvedValue(10);
    mockOACount.mockResolvedValue(0);

    const result = await svc.getCoverage(SHOP);

    expect(result.coveragePct).toBe(100);
    expect(result.belowWarningThreshold).toBe(false);
  });

  it("sets belowWarningThreshold false when coverage >= 80%", async () => {
    mockProductCostCount.mockResolvedValue(100);
    mockOACount
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(85);

    const result = await svc.getCoverage(SHOP);

    expect(result.belowWarningThreshold).toBe(false);
  });
});

describe("CogsService.update", () => {
  let svc: CogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CogsService();
    mockUpsert.mockResolvedValue(makeCost() as never);
  });

  it("upserts with MANUAL source", async () => {
    await svc.update(SHOP, "111", 9.99);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: "MANUAL", cost: 9.99 }),
        update: expect.objectContaining({ source: "MANUAL", cost: 9.99 }),
      })
    );
  });

  it("normalizes bare variant ID to full GID", async () => {
    await svc.update(SHOP, "111", 5.0);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopifyVariantId: "gid://shopify/ProductVariant/111" },
      })
    );
  });

  it("passes through full GID as-is", async () => {
    await svc.update(SHOP, "gid://shopify/ProductVariant/999", 5.0);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopifyVariantId: "gid://shopify/ProductVariant/999" },
      })
    );
  });

  it("throws when cost is zero", async () => {
    await expect(svc.update(SHOP, "111", 0)).rejects.toThrow(
      "cost must be a positive number"
    );
  });

  it("throws when cost is negative", async () => {
    await expect(svc.update(SHOP, "111", -5)).rejects.toThrow(
      "cost must be a positive number"
    );
  });

  it("throws when cost is Infinity", async () => {
    await expect(svc.update(SHOP, "111", Infinity)).rejects.toThrow(
      "cost must be a positive number"
    );
  });

  it("stores custom currency code", async () => {
    await svc.update(SHOP, "111", 9.99, { currencyCode: "EUR" });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currencyCode: "EUR" }),
      })
    );
  });

  it("stores sku when provided", async () => {
    await svc.update(SHOP, "111", 9.99, { sku: "ABC-123" });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sku: "ABC-123" }),
      })
    );
  });
});

describe("CogsService.importCsv", () => {
  let svc: CogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CogsService();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(makeCost() as never);
  });

  const validCsv = `variant_id,cost,sku,currency
111,9.99,SKU-001,USD
222,5.50,SKU-002,EUR`;

  it("imports valid rows", async () => {
    const result = await svc.importCsv(SHOP, validCsv);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error when variant_id column is missing", async () => {
    const csv = `cost,sku\n9.99,SKU-001`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.errors).toContain("Missing required column: variant_id");
    expect(result.imported).toBe(0);
  });

  it("returns error when cost column is missing", async () => {
    const csv = `variant_id,sku\n111,SKU-001`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.errors).toContain("Missing required column: cost");
    expect(result.imported).toBe(0);
  });

  it("skips rows with invalid cost", async () => {
    const csv = `variant_id,cost\n111,abc\n222,9.99`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.errors[0]).toContain('cost "abc" is not a positive number');
  });

  it("skips rows with zero cost", async () => {
    const csv = `variant_id,cost\n111,0`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain("is not a positive number");
  });

  it("skips rows with missing variant_id", async () => {
    const csv = `variant_id,cost\n,9.99`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain("missing variant_id");
  });

  it("skips MANUAL entries when overwriteManual is false", async () => {
    mockFindUnique.mockResolvedValue({ source: "MANUAL", shopifyProductId: "gid://shopify/Product/222" } as never);

    const csv = `variant_id,cost\n111,9.99`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it("overwrites MANUAL entries when overwriteManual is true", async () => {
    mockFindUnique.mockResolvedValue({ source: "MANUAL", shopifyProductId: "gid://shopify/Product/222" } as never);

    const csv = `variant_id,cost\n111,9.99`;
    const result = await svc.importCsv(SHOP, csv, { overwriteManual: true });
    expect(result.imported).toBe(1);
  });

  it("normalizes bare variant ID to GID in upsert", async () => {
    const csv = `variant_id,cost\n999,5.00`;
    await svc.importCsv(SHOP, csv);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopifyVariantId: "gid://shopify/ProductVariant/999" },
      })
    );
  });

  it("defaults currency to USD when not specified", async () => {
    const csv = `variant_id,cost\n111,9.99`;
    await svc.importCsv(SHOP, csv);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currencyCode: "USD" }),
      })
    );
  });

  it("requires force=true when row count exceeds 10000", async () => {
    const header = "variant_id,cost\n";
    const rows = Array.from({ length: 10001 }, (_, i) => `${i},9.99`).join("\n");
    const csv = header + rows;

    const result = await svc.importCsv(SHOP, csv);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.rowCount).toBe(10001);
    expect(result.imported).toBe(0);
  });

  it("proceeds past 10000 rows when force=true", async () => {
    const header = "variant_id,cost\n";
    const rows = Array.from({ length: 10001 }, (_, i) => `${i},9.99`).join("\n");
    const csv = header + rows;

    const result = await svc.importCsv(SHOP, csv, { force: true });
    expect(result.requiresConfirmation).toBeUndefined();
    expect(result.imported).toBe(10001);
  });

  it("handles CSV with quoted values", async () => {
    const csv = `variant_id,cost,sku\n"111","9.99","SKU-A"`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.imported).toBe(1);
  });

  it("normalizes headers with leading/trailing whitespace", async () => {
    // Parser trims each header → " variant_id " becomes "variant_id"
    const csv = " variant_id , cost \n111,9.99";
    const result = await svc.importCsv(SHOP, csv);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts UPPERCASE header names (normalized to lowercase)", async () => {
    // Parser lowercases headers → "VARIANT_ID" becomes "variant_id"
    const csv = `VARIANT_ID,COST\n111,9.99`;
    const result = await svc.importCsv(SHOP, csv);
    expect(result.imported).toBe(1);
  });

  it("extra comma in header row creates empty-string column but still parses required columns", async () => {
    // Extra comma → empty-string column key; required headers still present
    const csv = `variant_id,,cost\n111,,9.99`;
    const result = await svc.importCsv(SHOP, csv);
    // variant_id and cost are present, so import should succeed
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("CogsService.delete", () => {
  let svc: CogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CogsService();
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes a product cost record", async () => {
    await svc.delete(SHOP, "cost-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "cost-1", shopId: SHOP } });
  });
});
