import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionConfigService } from "./function-config.service";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ─── Shopify GraphQL mock ─────────────────────────────────────────────────────

vi.mock("@/lib/shopify-admin-graphql", () => ({
  shopifyAdminGraphQL: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { shopifyAdminGraphQL } from "@/lib/shopify-admin-graphql";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const mockShopUpdate = vi.mocked(prisma.shop.update);
const mockGraphQL = vi.mocked(shopifyAdminGraphQL);

const SHOP = "test-shop.myshopify.com";
const DISCOUNT_GID = "gid://shopify/DiscountAutomaticNode/123";

function makeShopSettings(discountIds: Record<string, string> = {}) {
  return { settings: { functionDiscountIds: discountIds } };
}

// ─── ensureDiscount ───────────────────────────────────────────────────────────

describe("FunctionConfigService.ensureDiscount", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
  });

  it("returns stored discount GID without calling Shopify if already cached", async () => {
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-order-discount": DISCOUNT_GID }) as never
    );

    const result = await svc.ensureDiscount(SHOP, "marginlab-order-discount", "Title");

    expect(result).toBe(DISCOUNT_GID);
    expect(mockGraphQL).not.toHaveBeenCalled();
  });

  it("creates a new discount node and persists the GID when none exists", async () => {
    mockShopFindUnique.mockResolvedValue(makeShopSettings() as never);
    mockShopUpdate.mockResolvedValue({} as never);
    mockGraphQL.mockResolvedValue({
      discountAutomaticAppCreate: {
        automaticAppDiscount: { discountId: DISCOUNT_GID },
        userErrors: [],
      },
    });

    const result = await svc.ensureDiscount(SHOP, "marginlab-order-discount", "MarginLab – Discount Tests");

    expect(result).toBe(DISCOUNT_GID);
    expect(mockGraphQL).toHaveBeenCalledOnce();
    expect(mockShopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopDomain: SHOP },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            functionDiscountIds: { "marginlab-order-discount": DISCOUNT_GID },
          }),
        }),
      })
    );
  });

  it("throws when Shopify returns userErrors on discount creation", async () => {
    mockShopFindUnique.mockResolvedValue(makeShopSettings() as never);
    mockGraphQL.mockResolvedValue({
      discountAutomaticAppCreate: {
        userErrors: [{ message: "Function not found" }],
      },
    });

    await expect(
      svc.ensureDiscount(SHOP, "bad-handle", "Title")
    ).rejects.toThrow("Failed to create discount: Function not found");
  });
});

// ─── setDiscountConfig ────────────────────────────────────────────────────────

describe("FunctionConfigService.setDiscountConfig", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
  });

  it("calls metafieldsSet mutation with correct payload", async () => {
    mockGraphQL.mockResolvedValue({ metafieldsSet: { metafields: [], userErrors: [] } });

    const config = { variant_discounts: [], offer_rules: [] };
    await svc.setDiscountConfig(SHOP, DISCOUNT_GID, "order-discount-config", config);

    expect(mockGraphQL).toHaveBeenCalledWith(
      SHOP,
      expect.stringContaining("metafieldsSet"),
      expect.objectContaining({
        metafields: expect.arrayContaining([
          expect.objectContaining({
            ownerId: DISCOUNT_GID,
            namespace: "$app:marginlab",
            key: "order-discount-config",
            type: "json",
            value: JSON.stringify(config),
          }),
        ]),
      })
    );
  });

  it("throws when Shopify returns userErrors on metafield set", async () => {
    mockGraphQL.mockResolvedValue({
      metafieldsSet: { userErrors: [{ message: "Invalid value" }] },
    });

    await expect(
      svc.setDiscountConfig(SHOP, DISCOUNT_GID, "order-discount-config", {
        variant_discounts: [],
        offer_rules: [],
      })
    ).rejects.toThrow("Failed to set metafield: Invalid value");
  });
});

// ─── getDiscountConfig ────────────────────────────────────────────────────────

describe("FunctionConfigService.getDiscountConfig", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
  });

  it("returns parsed metafield value when present", async () => {
    const stored = { variant_discounts: [{ experiment_id: "exp-1", variant_key: "b", discount_type: "PERCENTAGE", value: 10 }], offer_rules: [] };
    mockGraphQL.mockResolvedValue({
      discountNode: { metafield: { value: JSON.stringify(stored) } },
    });

    const result = await svc.getDiscountConfig(SHOP, DISCOUNT_GID, "order-discount-config", { variant_discounts: [], offer_rules: [] });

    expect(result).toEqual(stored);
  });

  it("returns defaultValue when metafield is absent", async () => {
    mockGraphQL.mockResolvedValue({ discountNode: null });

    const def = { variant_discounts: [], offer_rules: [] };
    const result = await svc.getDiscountConfig(SHOP, DISCOUNT_GID, "order-discount-config", def);

    expect(result).toBe(def);
  });

  it("returns defaultValue when metafield JSON is malformed", async () => {
    mockGraphQL.mockResolvedValue({
      discountNode: { metafield: { value: "not-json{{" } },
    });

    const def = { variant_discounts: [], offer_rules: [] };
    const result = await svc.getDiscountConfig(SHOP, DISCOUNT_GID, "order-discount-config", def);

    expect(result).toBe(def);
  });
});

// ─── registerDiscountExperiment ───────────────────────────────────────────────

describe("FunctionConfigService.registerDiscountExperiment", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();

    // Shop has discount GID cached
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-order-discount": DISCOUNT_GID }) as never
    );
  });

  it("pushes variant discount rules (skipping control) into the metafield", async () => {
    // Current config: empty
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: null }) // getDiscountConfig
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } }); // setDiscountConfig

    await svc.registerDiscountExperiment(SHOP, {
      id: "exp-1",
      variants: [
        { key: "control", isControl: true, discountConfig: null },
        { key: "variant_b", isControl: false, discountConfig: { type: "PERCENTAGE", value: 15, message: "Save 15%" } },
      ],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.variant_discounts).toHaveLength(1);
    expect(body.variant_discounts[0]).toMatchObject({
      experiment_id: "exp-1",
      variant_key: "variant_b",
      discount_type: "PERCENTAGE",
      value: 15,
      message: "Save 15%",
    });
  });

  it("replaces stale rules for the same experiment on re-register", async () => {
    const existing = {
      variant_discounts: [
        { experiment_id: "exp-1", variant_key: "old_variant", discount_type: "PERCENTAGE", value: 5 },
        { experiment_id: "exp-2", variant_key: "other", discount_type: "PERCENTAGE", value: 20 },
      ],
      offer_rules: [],
    };
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: { metafield: { value: JSON.stringify(existing) } } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.registerDiscountExperiment(SHOP, {
      id: "exp-1",
      variants: [
        { key: "control", isControl: true, discountConfig: null },
        { key: "variant_b", isControl: false, discountConfig: { type: "FIXED_AMOUNT", value: 10 } },
      ],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    // exp-2 rule preserved, exp-1 replaced
    expect(body.variant_discounts).toHaveLength(2);
    expect(body.variant_discounts.find((r: { experiment_id: string }) => r.experiment_id === "exp-1")).toMatchObject({
      variant_key: "variant_b",
      discount_type: "FIXED_AMOUNT",
      value: 10,
    });
    expect(body.variant_discounts.find((r: { experiment_id: string }) => r.experiment_id === "exp-2")).toBeDefined();
  });

  it("skips variants with no discountConfig value", async () => {
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: null })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.registerDiscountExperiment(SHOP, {
      id: "exp-1",
      variants: [
        { key: "control", isControl: true, discountConfig: null },
        { key: "variant_b", isControl: false, discountConfig: {} }, // no value field
      ],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.variant_discounts).toHaveLength(0);
  });
});

// ─── deregisterDiscountExperiment ─────────────────────────────────────────────

describe("FunctionConfigService.deregisterDiscountExperiment", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
  });

  it("removes rules for the experiment and keeps others", async () => {
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-order-discount": DISCOUNT_GID }) as never
    );
    const existing = {
      variant_discounts: [
        { experiment_id: "exp-1", variant_key: "b", discount_type: "PERCENTAGE", value: 10 },
        { experiment_id: "exp-2", variant_key: "c", discount_type: "PERCENTAGE", value: 20 },
      ],
      offer_rules: [],
    };
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: { metafield: { value: JSON.stringify(existing) } } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.deregisterDiscountExperiment(SHOP, "exp-1");

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.variant_discounts).toHaveLength(1);
    expect(body.variant_discounts[0].experiment_id).toBe("exp-2");
  });

  it("no-ops when no discount node GID is stored for the shop", async () => {
    mockShopFindUnique.mockResolvedValue(makeShopSettings() as never);

    await svc.deregisterDiscountExperiment(SHOP, "exp-1");

    expect(mockGraphQL).not.toHaveBeenCalled();
  });
});

// ─── registerOffer ────────────────────────────────────────────────────────────

describe("FunctionConfigService.registerOffer", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-order-discount": DISCOUNT_GID }) as never
    );
  });

  it("appends an ORDER_DISCOUNT offer rule", async () => {
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: null })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.registerOffer(SHOP, {
      id: "offer-1",
      type: "ORDER_DISCOUNT",
      discountRules: { amount: 5 },
      triggerRules: [],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.offer_rules).toHaveLength(1);
    expect(body.offer_rules[0]).toMatchObject({
      offer_id: "offer-1",
      discount_type: "FIXED_AMOUNT",
      value: 5,
    });
  });

  it("replaces existing rule for the same offer on re-register", async () => {
    const existing = {
      variant_discounts: [],
      offer_rules: [{ offer_id: "offer-1", discount_type: "FIXED_AMOUNT", value: 3, requires_activation: false }],
    };
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: { metafield: { value: JSON.stringify(existing) } } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.registerOffer(SHOP, {
      id: "offer-1",
      type: "ORDER_DISCOUNT",
      discountRules: { amount: 10 },
      triggerRules: [],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.offer_rules).toHaveLength(1);
    expect(body.offer_rules[0].value).toBe(10);
  });

  it("skips Shopify calls for CAMPAIGN_LINK_OFFER (no function)", async () => {
    await svc.registerOffer(SHOP, {
      id: "offer-cl",
      type: "CAMPAIGN_LINK_OFFER",
      discountRules: {},
      triggerRules: [],
    });

    expect(mockGraphQL).not.toHaveBeenCalled();
  });

  it("applies min_cart_value from triggerRules for FREE_SHIPPING", async () => {
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-shipping-discount": DISCOUNT_GID }) as never
    );
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: null })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.registerOffer(SHOP, {
      id: "offer-fs",
      type: "FREE_SHIPPING",
      discountRules: {},
      triggerRules: [{ type: "min_cart_value", minValue: 50 }],
    });

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.offer_rules[0]).toMatchObject({
      offer_id: "offer-fs",
      discount_type: "FREE",
      value: 100,
      minimum_cart_value: 50,
    });
  });
});

// ─── deregisterOffer ──────────────────────────────────────────────────────────

describe("FunctionConfigService.deregisterOffer", () => {
  let svc: FunctionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new FunctionConfigService();
  });

  it("removes the offer rule and keeps others", async () => {
    mockShopFindUnique.mockResolvedValue(
      makeShopSettings({ "marginlab-order-discount": DISCOUNT_GID }) as never
    );
    const existing = {
      variant_discounts: [],
      offer_rules: [
        { offer_id: "offer-1", discount_type: "FIXED_AMOUNT", value: 5, requires_activation: false },
        { offer_id: "offer-2", discount_type: "PERCENTAGE", value: 10, requires_activation: false },
      ],
    };
    mockGraphQL
      .mockResolvedValueOnce({ discountNode: { metafield: { value: JSON.stringify(existing) } } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } });

    await svc.deregisterOffer(SHOP, "offer-1", "ORDER_DISCOUNT");

    const setCall = mockGraphQL.mock.calls[1];
    const body = JSON.parse(setCall![2]!.metafields[0].value);
    expect(body.offer_rules).toHaveLength(1);
    expect(body.offer_rules[0].offer_id).toBe("offer-2");
  });

  it("no-ops when no discount GID is stored", async () => {
    mockShopFindUnique.mockResolvedValue(makeShopSettings() as never);

    await svc.deregisterOffer(SHOP, "offer-1", "ORDER_DISCOUNT");

    expect(mockGraphQL).not.toHaveBeenCalled();
  });
});
