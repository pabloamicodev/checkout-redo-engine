import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutTestService } from "./checkout-test.service";

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
    checkoutBlock: {
      findMany: vi.fn(),
    },
    experimentVariant: {
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
const mockCheckoutFindMany = vi.mocked(prisma.checkoutBlock.findMany);
const mockVariantFindMany = vi.mocked(prisma.experimentVariant.findMany);

const SHOP_ID = "shop-1";

function makeCreateInput(overrides: Partial<Parameters<CheckoutTestService["create"]>[1]> = {}) {
  return {
    name: "Checkout Test",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, checkoutBlockIds: [] },
      { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 50, checkoutBlockIds: ["block-1"] },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "CHECKOUT_TEST",
    status: "DRAFT",
    variants: [
      { id: "v1", key: "control", name: "Control", isControl: true, checkoutBlockIds: [] },
      { id: "v2", key: "variant-a", name: "Variant A", isControl: false, checkoutBlockIds: ["block-1"] },
    ],
    ...overrides,
  };
}

describe("CheckoutTestService", () => {
  let service: CheckoutTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CheckoutTestService();
    mockCheckoutFindMany.mockResolvedValue([{ id: "block-1" }] as never);
    mockVariantFindMany.mockResolvedValue([] as never);
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockExpCreate.mockResolvedValue(makeExperiment() as never);
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
  });

  it("throws when variants are less than 2", async () => {
    const input = makeCreateInput({ variants: [makeCreateInput().variants[0]!] });
    await expect(service.create(SHOP_ID, input)).rejects.toThrow("at least 2 variants");
  });

  it("throws when control variant references blocks", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, checkoutBlockIds: ["block-1"] },
        makeCreateInput().variants[1]!,
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Control variant must not reference checkout blocks");
  });

  it("throws when non-control variant has no block", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        { ...makeCreateInput().variants[1]!, checkoutBlockIds: [] },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("must reference at least one checkout block");
  });

  it("throws when referenced block is missing", async () => {
    mockCheckoutFindMany.mockResolvedValue([] as never);
    await expect(service.create(SHOP_ID, makeCreateInput())).rejects.toThrow("Checkout block(s) not found");
  });

  it("throws when block is already used by another running checkout test", async () => {
    mockVariantFindMany.mockResolvedValue([
      { experiment: { name: "Live test" }, checkoutBlockIds: ["block-1"] },
    ] as never);

    await expect(service.create(SHOP_ID, makeCreateInput())).rejects.toThrow("already used in the running test");
  });

  it("creates experiment via ExperimentService with CHECKOUT_TEST type", async () => {
    await service.create(SHOP_ID, makeCreateInput());

    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "CHECKOUT_TEST" })
    );
  });

  it("activate is idempotent when already RUNNING", async () => {
    const running = makeExperiment({ status: "RUNNING" });
    mockFindFirst.mockResolvedValueOnce(running as never);

    const result = await service.activate(SHOP_ID, "exp-1");
    expect(result).toEqual(running);
    expect(mockExpLaunch).not.toHaveBeenCalled();
  });

  it("pause throws when status is not RUNNING", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.pause(SHOP_ID, "exp-1")).rejects.toThrow("Cannot pause a test with status");
  });
});
