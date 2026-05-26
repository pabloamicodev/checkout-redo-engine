import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShippingTestService } from "./shipping-test.service";

const { mockExpCreate, mockExpLaunch, mockExpPause } = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    orderAttribution: {
      findMany: vi.fn(),
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

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockOrderFindMany = vi.mocked(prisma.orderAttribution.findMany);

const SHOP_ID = "shop-1";

function makeInput(overrides: Partial<Parameters<ShippingTestService["create"]>[1]> = {}) {
  return {
    name: "Shipping test",
    trafficAllocation: 100,
    progressBarEnabled: true,
    progressBarMessageTemplate: "{{remaining}} away",
    useDeliveryCustomization: false,
    variants: [
      {
        key: "control",
        name: "Control",
        isControl: true,
        allocationPercent: 50,
        freeShippingThreshold: 75,
        progressBarMessage: "Spend {{remaining}}",
      },
      {
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        freeShippingThreshold: 50,
        progressBarMessage: "Only {{remaining}} left",
      },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "SHIPPING_TEST",
    status: "DRAFT",
    variants: [
      { id: "v1", key: "control", name: "Control", isControl: true },
      { id: "v2", key: "variant-a", name: "Variant A", isControl: false },
    ],
    ...overrides,
  };
}

describe("ShippingTestService", () => {
  let service: ShippingTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShippingTestService();
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockOrderFindMany.mockResolvedValue([] as never);
    mockExpCreate.mockResolvedValue(makeExperiment() as never);
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
  });

  it("throws when variant threshold is negative", async () => {
    const input = makeInput({
      variants: [
        makeInput().variants[0]!,
        { ...makeInput().variants[1]!, freeShippingThreshold: -1 },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("free shipping threshold must be >= 0");
  });

  it("throws when allocations do not sum to 100", async () => {
    const input = makeInput({
      variants: [
        { ...makeInput().variants[0]!, allocationPercent: 40 },
        { ...makeInput().variants[1]!, allocationPercent: 40 },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Variant allocations must sum to 100");
  });

  it("creates SHIPPING_TEST and includes shippingConfig", async () => {
    await service.create(SHOP_ID, makeInput());

    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({
        type: "SHIPPING_TEST",
        shippingConfig: expect.objectContaining({ progressBarEnabled: true }),
      })
    );
  });

  it("activate is idempotent when already running", async () => {
    const running = makeExperiment({ status: "RUNNING" });
    mockFindFirst.mockResolvedValueOnce(running as never);
    const result = await service.activate(SHOP_ID, "exp-1");
    expect(result).toEqual(running);
    expect(mockExpLaunch).not.toHaveBeenCalled();
  });

  it("computes analytics per variant", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeExperiment({
        variants: [
          { id: "v1", key: "control", name: "Control", isControl: true },
          { id: "v2", key: "variant-a", name: "Variant A", isControl: false },
        ],
      }) as never
    );
    mockOrderFindMany.mockResolvedValueOnce([
      { variantId: "v1", netRevenue: 100, estimatedShippingCost: 0, grossProfit: 60 },
      { variantId: "v1", netRevenue: 50, estimatedShippingCost: 5, grossProfit: 30 },
      { variantId: "v2", netRevenue: 120, estimatedShippingCost: 0, grossProfit: 80 },
    ] as never);

    const result = await service.getAnalytics(SHOP_ID, "exp-1");
    expect(result.variantStats).toHaveLength(2);
    expect(result.variantStats[0]).toEqual(
      expect.objectContaining({
        variantId: "v1",
        totalOrders: 2,
        totalRevenue: 150,
        avgShippingCost: 2.5,
        freeShippingRate: 0.5,
      })
    );
  });
});
