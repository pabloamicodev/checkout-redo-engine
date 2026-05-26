import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { IntegrationService } from "./integration.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integration: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const mockFindMany = vi.mocked(prisma.integration.findMany);
const mockFindFirst = vi.mocked(prisma.integration.findFirst);
const mockFindUnique = vi.mocked(prisma.integration.findUnique);
const mockUpdate = vi.mocked(prisma.integration.update);
const mockCreate = vi.mocked(prisma.integration.create);
const mockDelete = vi.mocked(prisma.integration.delete);
const mockRedisGet = vi.mocked(redis.get);
const mockRedisSet = vi.mocked(redis.set);

const SHOP_ID = "shop-1";

const payload = {
  event: "experiment_started",
  experimentId: "exp-1",
  variantId: "v1",
  shopDomain: "demo.myshopify.com",
  timestamp: "2026-01-01T00:00:00.000Z",
  data: { experimentName: "Homepage CTA" },
};

describe("IntegrationService", () => {
  let service: IntegrationService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    service = new IntegrationService();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    mockFindMany.mockResolvedValue([] as never);
    mockFindFirst.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({} as never);
    mockCreate.mockResolvedValue({} as never);
    mockDelete.mockResolvedValue({} as never);
    mockRedisGet.mockResolvedValue(null as never);
    mockRedisSet.mockResolvedValue("OK" as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("list/get/delete", () => {
    it("maps stored integrations to UI records", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "i-1",
          provider: "WEBHOOK",
          status: "CONNECTED",
          configEncrypted: '{"url":"https://hook"}',
          publicConfig: { retries: true },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "i-2",
          provider: "RECHARGE",
          status: "ERROR",
          configEncrypted: "not-json",
          publicConfig: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ] as never);

      const result = await service.list(SHOP_ID);

      expect(result[0]).toMatchObject({
        type: "OUTBOUND_WEBHOOK",
        enabled: true,
        credentials: { url: "https://hook" },
      });
      expect(result[1]).toMatchObject({ type: "GA4", enabled: false, credentials: {}, settings: {} });
    });

    it("throws when get cannot find the integration", async () => {
      await expect(service.get(SHOP_ID, "missing")).rejects.toThrow("Integration not found: missing");
    });

    it("deletes an integration after ownership check", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "i-1" } as never);
      await service.delete(SHOP_ID, "i-1");
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "i-1" } });
    });
  });

  describe("upsert", () => {
    it("updates existing provider record", async () => {
      mockFindUnique.mockResolvedValueOnce({ id: "existing" } as never);
      await service.upsert(SHOP_ID, "GA4", {
        enabled: true,
        credentials: { measurementId: "G-123" },
        settings: { stream: "main" },
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "existing" },
          data: expect.objectContaining({ status: "CONNECTED" }),
        })
      );
    });

    it("creates a new integration when provider is missing", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      await service.upsert(SHOP_ID, "SLACK", {
        enabled: false,
        credentials: { webhookUrl: "https://slack" },
        settings: {},
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: "SLACK", status: "DISCONNECTED" }),
        })
      );
    });
  });

  describe("testConnection", () => {
    it("validates GA4 credentials", async () => {
      mockFindFirst.mockResolvedValueOnce({ provider: "GA4", configEncrypted: "{}" } as never);
      const result = await service.testConnection(SHOP_ID, "ga4");
      expect(result).toEqual({ ok: false, error: "Missing Measurement ID or API Secret" });
    });

    it("returns HTTP status for failed Klaviyo auth", async () => {
      mockFindFirst.mockResolvedValueOnce({
        provider: "KLAVIYO",
        configEncrypted: '{"apiKey":"k-test"}',
      } as never);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await service.testConnection(SHOP_ID, "klaviyo");
      expect(result).toEqual({ ok: false, error: "HTTP 401" });
    });

    it("validates webhook URL formatting", async () => {
      mockFindFirst.mockResolvedValueOnce({
        provider: "WEBHOOK",
        configEncrypted: '{"url":"invalid-url"}',
        publicConfig: {},
      } as never);

      const result = await service.testConnection(SHOP_ID, "wh");
      expect(result).toEqual({ ok: false, error: "Invalid webhook URL" });
    });

    it("returns thrown slack request errors", async () => {
      mockFindFirst.mockResolvedValueOnce({
        provider: "SLACK",
        configEncrypted: '{"webhookUrl":"https://hooks.slack.com/services/T/B/X"}',
      } as never);
      fetchMock.mockRejectedValueOnce(new Error("timeout"));

      const result = await service.testConnection(SHOP_ID, "slack");
      expect(result).toEqual({ ok: false, error: "timeout" });
    });

    it("defaults unknown providers to ok", async () => {
      mockFindFirst.mockResolvedValueOnce({ provider: "RECHARGE", configEncrypted: "{}" } as never);
      const result = await service.testConnection(SHOP_ID, "other");
      expect(result).toEqual({ ok: true });
    });
  });

  describe("dispatchToIntegrations", () => {
    it("invokes connected integration destinations without blocking", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "ga4",
          provider: "GA4",
          status: "CONNECTED",
          configEncrypted: '{"measurementId":"G-1","apiSecret":"secret"}',
          publicConfig: {},
        },
        {
          id: "kl",
          provider: "KLAVIYO",
          status: "CONNECTED",
          configEncrypted: '{"apiKey":"k","customerId":"x"}',
          publicConfig: {},
        },
        {
          id: "sl",
          provider: "SLACK",
          status: "CONNECTED",
          configEncrypted: '{"webhookUrl":"https://hooks.slack.com/services/T/B/X"}',
          publicConfig: {},
        },
      ] as never);

      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      await service.dispatchToIntegrations(SHOP_ID, payload.shopDomain, {
        ...payload,
        data: { customerId: "c-1", visitorId: "v-1", experimentName: "Hero test" },
      });

      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe("webhook retry + slack rate limiting", () => {
    it("retries failed webhook once and signs payload", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({ ok: true, status: 200 });

      const promise = (service as any).deliverWebhookWithRetry(
        "webhook-1",
        { url: "https://example.com/hook", secret: "whsec" },
        {},
        payload,
        0
      );

      await vi.advanceTimersByTimeAsync(5_000);
      await promise;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstCall = fetchMock.mock.calls[0];
      const headers = (firstCall?.[1] as RequestInit).headers as Record<string, string>;
      const body = (firstCall?.[1] as RequestInit).body as string;
      const expectedSignature = createHmac("sha256", "whsec").update(body).digest("hex");
      expect(headers["X-MarginLab-Signature"]).toBe(expectedSignature);
    });

    it("skips slack delivery when alert already sent in the hour", async () => {
      mockRedisGet.mockResolvedValueOnce("1" as never);
      await (service as any).sendSlackAlert(
        { webhookUrl: "https://hooks.slack.com/services/T/B/X" },
        payload,
        SHOP_ID
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("still sends slack message if redis is unavailable", async () => {
      mockRedisGet.mockRejectedValueOnce(new Error("redis down"));
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
      await (service as any).sendSlackAlert(
        { webhookUrl: "https://hooks.slack.com/services/T/B/X" },
        payload,
        SHOP_ID
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
