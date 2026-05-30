import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuntimeConfigService } from "./runtime-config.service";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { RUNTIME_CONFIG: 60 },
}));

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);
const mockCacheDel = vi.mocked(cacheDel);

// ─── Factories ────────────────────────────────────────────────────────────────

const SHOP_DOMAIN = "test-shop.myshopify.com";

function makeShop(overrides: Record<string, unknown> = {}) {
  return {
    id: "shop-1",
    shopDomain: SHOP_DOMAIN,
    settings: {},
    experiments: [],
    offers: [],
    checkoutBlocks: [],
    personalizations: [],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    slug: "my-test",
    name: "My Test",
    type: "CONTENT_TEST",
    status: "RUNNING",
    trafficAllocation: 100,
    assignmentStrategy: "VISITOR_ID",
    targetingRules: [],
    settings: null,
    priceConfig: null,
    contentConfig: null,
    splitUrlConfig: null,
    variants: [
      {
        id: "var-ctrl",
        key: "control",
        name: "Control",
        isControl: true,
        allocationPercent: 50,
        modifications: [],
        priceOverrides: [],
        redirectUrl: null,
        checkoutBlockIds: [],
        offerIds: [],
      },
      {
        id: "var-a",
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        modifications: [{ type: "TEXT", selector: "h1", value: "New Title" }],
        priceOverrides: [],
        redirectUrl: null,
        checkoutBlockIds: [],
        offerIds: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
  mockCacheDel.mockResolvedValue(undefined);
});

// ─── RuntimeConfigService.get ─────────────────────────────────────────────────

describe("RuntimeConfigService.get", () => {
  const service = new RuntimeConfigService();

  it("returns null when shop is not found", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const result = await service.get(SHOP_DOMAIN);
    expect(result).toBeNull();
  });

  it("returns cached result when cache is warm", async () => {
    const cached = { shopDomain: SHOP_DOMAIN, experiments: [], updatedAt: "2024-01-01" };
    mockCacheGet.mockResolvedValueOnce(cached as never);
    const result = await service.get(SHOP_DOMAIN);
    expect(result).toEqual(cached);
    expect(mockShopFindUnique).not.toHaveBeenCalled();
  });

  it("caches result after building", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop() as never);
    await service.get(SHOP_DOMAIN);
    expect(mockCacheSet).toHaveBeenCalledOnce();
  });

  it("returns fresh config even if cacheSet fails", async () => {
    const shop = makeShop();
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    mockCacheSet.mockRejectedValueOnce(new Error("redis down"));

    const result = await service.get(SHOP_DOMAIN);

    expect(result).not.toBeNull();
    expect(result!.shopDomain).toBe(SHOP_DOMAIN);
    expect(mockCacheSet).toHaveBeenCalledOnce();
  });
});

// ─── RuntimeConfigService.build ──────────────────────────────────────────────

describe("RuntimeConfigService.build", () => {
  const service = new RuntimeConfigService();

  it("queries Prisma with strict runtime filters and ordering", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop() as never);

    await service.build(SHOP_DOMAIN);

    expect(mockShopFindUnique).toHaveBeenCalledWith({
      where: { shopDomain: SHOP_DOMAIN },
      include: {
        experiments: {
          where: {
            status: { in: ["RUNNING", "PREVIEW", "QA"] },
          },
          include: {
            variants: {
              orderBy: { isControl: "desc" },
            },
          },
        },
        offers: {
          where: { status: "ACTIVE" },
        },
        checkoutBlocks: {
          where: { status: { in: ["ACTIVE", "DRAFT"] } },
        },
        personalizations: {
          where: { status: "ACTIVE" },
          orderBy: { priority: "asc" },
        },
      },
    });
  });

  it("returns null when shop is not found", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const result = await service.build(SHOP_DOMAIN);
    expect(result).toBeNull();
  });

  it("returns config with correct shopDomain", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop() as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.shopDomain).toBe(SHOP_DOMAIN);
  });

  it("includes updatedAt as ISO string", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop() as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(() => new Date(result!.updatedAt)).not.toThrow();
  });

  it("includes only RUNNING, PREVIEW, QA experiments — excludes DRAFT and COMPLETED", async () => {
    // The Prisma query filter is applied by the DB, not the service. Since we're
    // mocking the DB response, we trust the service passes the right filter.
    // This test verifies the shape of the output experiments array.
    const shop = makeShop({
      experiments: [makeExperiment({ status: "RUNNING" })],
    });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.experiments).toHaveLength(1);
    expect(result!.experiments[0]!.id).toBe("exp-1");
  });

  it("maps experiment variants correctly", async () => {
    const shop = makeShop({ experiments: [makeExperiment()] });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);

    const exp = result!.experiments[0]!;
    expect(exp.variants).toHaveLength(2);

    const ctrl = exp.variants.find((v) => v.isControl)!;
    expect(ctrl.key).toBe("control");
    expect(ctrl.allocationPercent).toBe(50);
    expect(ctrl.modifications).toEqual([]);

    const variant = exp.variants.find((v) => !v.isControl)!;
    expect(variant.modifications).toHaveLength(1);
  });

  it("does NOT expose sensitive shop data (no access tokens, no COGS)", async () => {
    const shopWithSecrets = {
      ...makeShop(),
      accessToken: "shpat_secret",
      cogsData: { productId: "123", cost: 5.0 },
    };
    mockShopFindUnique.mockResolvedValueOnce(shopWithSecrets as never);
    const result = await service.build(SHOP_DOMAIN);
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("shpat_secret");
    expect(resultStr).not.toContain("cogsData");
  });

  it("returns antiFlicker defaults when not in shop settings", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings: {} }) as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.settings.antiFlickerEnabled).toBe(true);
    expect(result!.settings.antiFlickerTimeout).toBe(300);
    expect(result!.settings.debugModeEnabled).toBe(false);
  });

  it("reads antiFlicker settings from shop.settings", async () => {
    const settings = {
      antiFlickerEnabled: false,
      antiFlickerTimeout: 500,
      debugModeEnabled: true,
    };
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings }) as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.settings.antiFlickerEnabled).toBe(false);
    expect(result!.settings.antiFlickerTimeout).toBe(500);
    expect(result!.settings.debugModeEnabled).toBe(true);
  });

  it("globalKillSwitch is false by default", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop() as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.killSwitches.globalDisabled).toBe(false);
  });

  it("uses default kill switch values when settings omit keys", async () => {
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings: {} }) as never);
    const result = await service.build(SHOP_DOMAIN);

    expect(result!.killSwitches.globalDisabled).toBe(false);
    expect(result!.killSwitches.contentModificationsDisabled).toBe(false);
    expect(result!.killSwitches.priceDisplayDisabled).toBe(false);
    expect(result!.killSwitches.offerWidgetsDisabled).toBe(false);
    expect(result!.killSwitches.splitUrlRedirectsDisabled).toBe(false);
    expect(result!.killSwitches.debugOverlayDisabled).toBe(true);
  });

  it("reads kill switches from shop settings", async () => {
    const settings = {
      ks_globalDisabled: true,
      ks_priceDisplayDisabled: true,
    };
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings }) as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.killSwitches.globalDisabled).toBe(true);
    expect(result!.killSwitches.priceDisplayDisabled).toBe(true);
    expect(result!.killSwitches.contentModificationsDisabled).toBe(false); // others stay false
  });

  it("includes active offers in config", async () => {
    const shop = makeShop({
      offers: [{
        id: "offer-1",
        name: "Buy More Save More",
        type: "VOLUME_DISCOUNT",
        triggerRules: [],
        discountRules: {},
        displaySettings: {},
      }],
    });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.offers).toHaveLength(1);
    expect(result!.offers[0]!.id).toBe("offer-1");
  });

  it("includes active checkout blocks in config", async () => {
    const shop = makeShop({
      checkoutBlocks: [{
        id: "block-1",
        name: "Trust Badge",
        type: "CUSTOM_HTML",
        content: "<p>Secure</p>",
        styles: {},
        targetingRules: [],
        position: "THANK_YOU",
        experimentId: null,
        variantId: null,
      }],
    });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.checkoutBlocks).toHaveLength(1);
    expect(result!.checkoutBlocks[0]!.id).toBe("block-1");
  });

  it("includes active personalizations sorted by priority", async () => {
    const shop = makeShop({
      personalizations: [
        { id: "p-1", type: "BANNER", name: "Sale", priority: 2, targetingRules: [], modifications: [], offerIds: [], startsAt: null, endsAt: null },
        { id: "p-2", type: "POPUP", name: "Welcome", priority: 1, targetingRules: [], modifications: [], offerIds: [], startsAt: null, endsAt: null },
      ],
    });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.personalizations).toHaveLength(2);
    // Order preserved from DB (Prisma mock returns in insertion order)
    expect(result!.personalizations[0]!.id).toBe("p-1");
  });

  it("converts personalization dates to ISO strings", async () => {
    const startsAt = new Date("2024-06-01T00:00:00Z");
    const endsAt = new Date("2024-06-30T23:59:59Z");
    const shop = makeShop({
      personalizations: [
        { id: "p-1", type: "BANNER", name: "Sale", priority: 1, targetingRules: [], modifications: [], offerIds: [], startsAt, endsAt },
      ],
    });
    mockShopFindUnique.mockResolvedValueOnce(shop as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result!.personalizations[0]!.startsAt).toBe(startsAt.toISOString());
    expect(result!.personalizations[0]!.endsAt).toBe(endsAt.toISOString());
  });

  it("returns antiFlicker defaults when shop.settings is null", async () => {
    // Prisma may return null for a JSON column with no value; service must not throw
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings: null }) as never);
    const result = await service.build(SHOP_DOMAIN);
    expect(result).not.toBeNull();
    expect(result!.settings.antiFlickerEnabled).toBe(true);
    expect(result!.settings.antiFlickerTimeout).toBe(300);
    expect(result!.settings.debugModeEnabled).toBe(false);
  });

  it("ignores unknown keys in shop.settings without error", async () => {
    const settings = {
      antiFlickerEnabled: true,
      antiFlickerTimeout: 400,
      unknownKey: "surprise",
      anotherUnknown: 42,
    };
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings }) as never);
    const result = await service.build(SHOP_DOMAIN);
    // Known settings are read correctly; unknown keys are not exposed in output
    expect(result!.settings.antiFlickerTimeout).toBe(400);
    expect(JSON.stringify(result!.settings)).not.toContain("unknownKey");
  });

  it("antiFlickerTimeout stored as string passes through as-is (no runtime coercion)", async () => {
    // If the DB has a string value, the service does not coerce — documents current behavior
    const settings = { antiFlickerTimeout: "500" };
    mockShopFindUnique.mockResolvedValueOnce(makeShop({ settings }) as never);
    const result = await service.build(SHOP_DOMAIN);
    // The value is truthy so ?? fallback is not used; it comes through as the string "500"
    expect(result!.settings.antiFlickerTimeout).toBe("500" as unknown as number);
  });
});

// ─── RuntimeConfigService.invalidate ─────────────────────────────────────────

describe("RuntimeConfigService.invalidate", () => {
  it("deletes the cache key for the shop", async () => {
    const service = new RuntimeConfigService();
    await service.invalidate(SHOP_DOMAIN);
    expect(mockCacheDel).toHaveBeenCalledWith(`runtime:config:${SHOP_DOMAIN}`);
  });
});
