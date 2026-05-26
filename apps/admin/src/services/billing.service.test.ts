import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/services/billing.service");

import { BillingService } from "@/services/billing.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopPlan: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    experiment: { count: vi.fn() },
    offer: { count: vi.fn() },
    checkoutBlock: { count: vi.fn() },
    integration: { count: vi.fn() },
    shop: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const mockShopPlanFindUnique = vi.mocked(prisma.shopPlan.findUnique);
const mockShopPlanUpsert = vi.mocked(prisma.shopPlan.upsert);
const mockShopPlanUpdate = vi.mocked(prisma.shopPlan.update);
const mockExperimentCount = vi.mocked(prisma.experiment.count);
const mockOfferCount = vi.mocked(prisma.offer.count);
const mockCheckoutBlockCount = vi.mocked(prisma.checkoutBlock.count);
const mockIntegrationCount = vi.mocked(prisma.integration.count);
const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockDecrypt = vi.mocked(decrypt);

const SHOP_ID = "shop-1";

describe("BillingService", () => {
  let service: BillingService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillingService();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.HOST = "https://app.test";

    mockDecrypt.mockReturnValue("token-123");
    mockShopPlanFindUnique.mockResolvedValue(null);
    mockShopPlanUpsert.mockResolvedValue({} as never);
    mockShopPlanUpdate.mockResolvedValue({} as never);
    mockExperimentCount.mockResolvedValue(0);
    mockOfferCount.mockResolvedValue(0);
    mockCheckoutBlockCount.mockResolvedValue(0);
    mockIntegrationCount.mockResolvedValue(0);
    mockShopFindUnique.mockResolvedValue({
      shopDomain: "store.myshopify.com",
      accessTokenEncrypted: "enc",
    } as never);
    mockTransaction.mockResolvedValue([1, 2, 3, 4] as never);
  });

  describe("getShopPlan", () => {
    it("falls back to free plan when no record exists", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce(null);
      const result = await service.getShopPlan(SHOP_ID);
      expect(result.plan.key).toBe("free");
      expect(result.isActive).toBe(true);
      expect(result.isTrialing).toBe(false);
    });

    it("marks trialing status correctly", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({
        shopId: SHOP_ID,
        planKey: "growth",
        status: "TRIALING",
      } as never);

      const result = await service.getShopPlan(SHOP_ID);
      expect(result.plan.key).toBe("growth");
      expect(result.isTrialing).toBe(true);
      expect(result.isActive).toBe(true);
    });
  });

  describe("checkLimit", () => {
    it("allows when under experiment limit", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({
        shopId: SHOP_ID,
        planKey: "growth",
        status: "ACTIVE",
      } as never);
      mockExperimentCount.mockResolvedValueOnce(3);

      const result = await service.checkLimit(SHOP_ID, "experiments");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(3);
      expect(result.max).toBe(10);
      expect(result.upgradeRequired).toBeNull();
    });

    it("returns upgradeRequired when offers exceed current plan", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({
        shopId: SHOP_ID,
        planKey: "free",
        status: "ACTIVE",
      } as never);
      mockOfferCount.mockResolvedValueOnce(1);

      const result = await service.checkLimit(SHOP_ID, "offers");
      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe("growth");
    });

    it("always allows when plan limit is Infinity", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({
        shopId: SHOP_ID,
        planKey: "pro",
        status: "ACTIVE",
      } as never);
      mockIntegrationCount.mockResolvedValueOnce(10000);

      const result = await service.checkLimit(SHOP_ID, "integrations");
      expect(result.allowed).toBe(true);
      expect(result.max).toBe(Infinity);
    });
  });

  describe("createCharge", () => {
    it("throws for free plan", async () => {
      await expect(service.createCharge(SHOP_ID, "free")).rejects.toThrow("Free plan does not require a charge");
    });

    it("throws when shop is missing", async () => {
      mockShopFindUnique.mockResolvedValueOnce(null);
      await expect(service.createCharge(SHOP_ID, "growth")).rejects.toThrow("Shop not found");
    });

    it("throws when Shopify returns no appSubscriptionCreate result", async () => {
      fetchMock.mockResolvedValueOnce({ json: async () => ({ data: {} }) });
      await expect(service.createCharge(SHOP_ID, "growth")).rejects.toThrow("Shopify billing API returned no data");
    });

    it("throws with Shopify userErrors messages", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          data: {
            appSubscriptionCreate: {
              userErrors: [{ field: "lineItems", message: "Bad line item" }],
            },
          },
        }),
      });

      await expect(service.createCharge(SHOP_ID, "growth")).rejects.toThrow("Bad line item");
    });

    it("throws when confirmationUrl is missing", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          data: {
            appSubscriptionCreate: {
              appSubscription: { id: "gid://shopify/AppSubscription/123" },
              confirmationUrl: undefined,
              userErrors: [],
            },
          },
        }),
      });

      await expect(service.createCharge(SHOP_ID, "growth")).rejects.toThrow("Shopify did not return a confirmation URL");
    });

    it("creates pending shop plan and returns stripped chargeId", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          data: {
            appSubscriptionCreate: {
              appSubscription: { id: "gid://shopify/AppSubscription/98765" },
              confirmationUrl: "https://confirm",
              userErrors: [],
            },
          },
        }),
      });

      const result = await service.createCharge(SHOP_ID, "growth");
      expect(result).toEqual({ confirmationUrl: "https://confirm", chargeId: "98765" });
      expect(mockShopPlanUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: "PENDING", shopifyChargeId: "98765" }),
          update: expect.objectContaining({ status: "PENDING", shopifyChargeId: "98765" }),
        })
      );
    });
  });

  describe("activateCharge", () => {
    it("throws when charge is missing on Shopify", async () => {
      fetchMock.mockResolvedValueOnce({ json: async () => ({ recurring_application_charge: undefined }) });
      await expect(service.activateCharge(SHOP_ID, "123")).rejects.toThrow("Charge not found on Shopify");
    });

    it("throws when charge is declined", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ recurring_application_charge: { id: 1, status: "declined" } }),
      });
      await expect(service.activateCharge(SHOP_ID, "123")).rejects.toThrow("Charge was declined by merchant");
    });

    it("activates pending charge and stores TRIALING when trial still active", async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      fetchMock
        .mockResolvedValueOnce({
          json: async () => ({
            recurring_application_charge: {
              id: 55,
              status: "pending",
              trial_ends_on: future,
              activated_on: "2026-01-01T00:00:00.000Z",
            },
          }),
        })
        .mockResolvedValueOnce({ json: async () => ({ ok: true }) });

      mockShopPlanFindUnique.mockResolvedValueOnce({ shopId: SHOP_ID, planKey: "growth" } as never);

      await service.activateCharge(SHOP_ID, "55");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockShopPlanUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: "TRIALING", shopifyChargeId: "55" }),
          update: expect.objectContaining({ status: "TRIALING", shopifyChargeId: "55" }),
        })
      );
    });

    it("does not call activate endpoint when charge is already active", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          recurring_application_charge: {
            id: 77,
            status: "active",
            trial_ends_on: null,
            activated_on: "2026-01-01T00:00:00.000Z",
          },
        }),
      });
      mockShopPlanFindUnique.mockResolvedValueOnce({ shopId: SHOP_ID, planKey: "growth" } as never);

      await service.activateCharge(SHOP_ID, "77");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("status/maintenance methods", () => {
    it("cancelSubscription downgrades to free", async () => {
      await service.cancelSubscription(SHOP_ID);
      expect(mockShopPlanUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "free", status: "ACTIVE" }),
          update: expect.objectContaining({ planKey: "free", status: "CANCELLED" }),
        })
      );
    });

    it("processSubscriptionWebhook maps status and sets free plan on cancelled", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({ shopId: SHOP_ID, planKey: "pro" } as never);
      await service.processSubscriptionWebhook(SHOP_ID, { status: "cancelled", id: 11 });

      expect(mockShopPlanUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CANCELLED", planKey: "free" }),
        })
      );
    });

    it("ensurePlanRecord upserts default free plan", async () => {
      await service.ensurePlanRecord(SHOP_ID);
      expect(mockShopPlanUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ planKey: "free", status: "ACTIVE" }) })
      );
    });
  });

  describe("getUsageStats", () => {
    it("returns usage mapped against current plan limits", async () => {
      mockShopPlanFindUnique.mockResolvedValueOnce({
        shopId: SHOP_ID,
        planKey: "growth",
        status: "ACTIVE",
      } as never);
      mockTransaction.mockResolvedValueOnce([4, 2, 1, 3] as never);

      const result = await service.getUsageStats(SHOP_ID);
      expect(result.plan.key).toBe("growth");
      expect(result.usage.experiments).toEqual({ current: 4, max: 10 });
      expect(result.usage.offers).toEqual({ current: 2, max: 5 });
      expect(result.usage.checkoutBlocks).toEqual({ current: 1, max: 10 });
      expect(result.usage.integrations).toEqual({ current: 3, max: 3 });
    });
  });
});
