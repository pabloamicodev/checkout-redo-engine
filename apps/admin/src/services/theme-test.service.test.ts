import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeTestService } from "./theme-test.service";

const {
  mockExpCreate,
  mockExpLaunch,
  mockExpPause,
  mockExpArchive,
  mockExpDuplicate,
  mockGetShopifyRestFetch,
  mockRestFetch,
} = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
  mockExpArchive: vi.fn(),
  mockExpDuplicate: vi.fn(),
  mockGetShopifyRestFetch: vi.fn(),
  mockRestFetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    shop: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    create: mockExpCreate,
    launch: mockExpLaunch,
    pause: mockExpPause,
    archive: mockExpArchive,
    duplicate: mockExpDuplicate,
  })),
}));

vi.mock("@/lib/shopify-admin-rest", () => ({
  getShopifyRestFetch: mockGetShopifyRestFetch,
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockFindMany = vi.mocked(prisma.experiment.findMany);
const mockUpdate = vi.mocked(prisma.experiment.update);
const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

const SHOP_ID = "shop-1";

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "THEME_TEST",
    status: "DRAFT",
    variants: [
      { id: "v1", name: "Control", isControl: true, settings: { themeId: 100 } },
      { id: "v2", name: "Variant A", isControl: false, settings: { themeId: 200 } },
    ],
    ...overrides,
  };
}

describe("ThemeTestService", () => {
  let service: ThemeTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ThemeTestService();

    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockShopFindUnique.mockResolvedValue({ shopDomain: "shop.myshopify.com" } as never);
    mockGetShopifyRestFetch.mockResolvedValue(mockRestFetch as never);
    mockRestFetch.mockResolvedValue({
      themes: [
        { id: 100, name: "Live", role: "main" },
        { id: 200, name: "Variant", role: "unpublished" },
      ],
    });
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockFindMany.mockResolvedValue([] as never);
    mockUpdate.mockResolvedValue({} as never);
  });

  it("activate throws when another theme test is already running", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeExperiment() as never)
      .mockResolvedValueOnce({ id: "exp-2", name: "Other running" } as never);

    await expect(service.activate(SHOP_ID, "exp-1")).rejects.toThrow("already running");
  });

  it("activate continues when Shopify verification error is swallowed", async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeExperiment({ variants: [{ id: "v1", name: "Control", isControl: true, settings: { themeId: 999 } }] }) as never)
      .mockResolvedValueOnce(null);

    await expect(service.activate(SHOP_ID, "exp-1")).resolves.toBeDefined();
    expect(mockExpLaunch).toHaveBeenCalledWith(SHOP_ID, "exp-1");
  });

  it("pauseAllRunningForShop pauses all running experiments", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "exp-1", name: "A" },
      { id: "exp-2", name: "B" },
    ] as never);

    const result = await service.pauseAllRunningForShop(SHOP_ID, "webhook-test");
    expect(result.paused).toBe(2);
    expect(result.ids).toEqual(["exp-1", "exp-2"]);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
