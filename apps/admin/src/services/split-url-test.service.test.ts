import { beforeEach, describe, expect, it, vi } from "vitest";
import { SplitUrlTestService } from "./split-url-test.service";

const {
  mockExpCreate,
  mockExpLaunch,
  mockExpPause,
  mockExpComplete,
  mockExpDuplicate,
} = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
  mockExpComplete: vi.fn(),
  mockExpDuplicate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    experimentAssignment: {
      groupBy: vi.fn(),
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
    complete: mockExpComplete,
    duplicate: mockExpDuplicate,
  })),
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockAssignmentGroupBy = vi.mocked(prisma.experimentAssignment.groupBy);
const mockOrderFindMany = vi.mocked(prisma.orderAttribution.findMany);

const SHOP_ID = "shop-1";

function makeInput(overrides: Partial<Parameters<SplitUrlTestService["create"]>[1]> = {}) {
  return {
    name: "Split URL",
    baseUrl: "/products/x",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, redirectUrl: null },
      { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 50, redirectUrl: "/alt" },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "SPLIT_URL_TEST",
    status: "DRAFT",
    variants: [
      { id: "v1", key: "control", name: "Control", isControl: true, redirectUrl: null },
      { id: "v2", key: "variant-a", name: "Variant A", isControl: false, redirectUrl: "/alt" },
    ],
    ...overrides,
  };
}

describe("SplitUrlTestService", () => {
  let service: SplitUrlTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SplitUrlTestService();
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockAssignmentGroupBy.mockResolvedValue([] as never);
    mockOrderFindMany.mockResolvedValue([] as never);
    mockExpCreate.mockResolvedValue(makeExperiment() as never);
  });

  it("throws when control has redirect URL", async () => {
    const input = makeInput({
      variants: [
        { ...makeInput().variants[0]!, redirectUrl: "/should-not" },
        makeInput().variants[1]!,
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Control variant must not have a redirect URL");
  });

  it("throws when two variants share the same redirect URL", async () => {
    const input = makeInput({
      variants: [
        makeInput().variants[0]!,
        { ...makeInput().variants[1]!, redirectUrl: "/dup" },
        { key: "variant-b", name: "Variant B", isControl: false, allocationPercent: 0, redirectUrl: "/dup" },
      ],
    });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Duplicate redirect URL");
  });

  it("creates SPLIT_URL_TEST via ExperimentService", async () => {
    await service.create(SHOP_ID, makeInput());
    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "SPLIT_URL_TEST" })
    );
  });

  it("computes analytics by variant", async () => {
    mockAssignmentGroupBy.mockResolvedValueOnce([
      { variantId: "v1", _count: { visitorId: 10 } },
      { variantId: "v2", _count: { visitorId: 20 } },
    ] as never);
    mockOrderFindMany.mockResolvedValueOnce([
      { variantId: "v2", netRevenue: 100 },
      { variantId: "v2", netRevenue: 50 },
    ] as never);

    const rows = await service.getAnalytics(SHOP_ID, "exp-1");
    expect(rows[1]).toEqual(
      expect.objectContaining({ visitors: 20, orders: 2, revenue: 150, conversionRate: 0.1 })
    );
  });
});
