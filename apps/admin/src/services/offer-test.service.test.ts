import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferTestService } from "./offer-test.service";

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

const SHOP_ID = "shop-1";

function makeInput(overrides: Partial<Parameters<OfferTestService["create"]>[1]> = {}) {
  return {
    name: "Offer test",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50 },
      {
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        modification: { offerType: "POPUP" as const, headline: "Save now", triggerDelay: 0 },
      },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "OFFER_TEST",
    status: "DRAFT",
    variants: [],
    ...overrides,
  };
}

describe("OfferTestService", () => {
  let service: OfferTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OfferTestService();
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockExpCreate.mockResolvedValue(makeExperiment() as never);
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
  });

  it("throws when control variant has modification", async () => {
    const input = makeInput({
      variants: [
        {
          ...makeInput().variants[0]!,
          modification: { offerType: "BANNER", headline: "bad" },
        },
        makeInput().variants[1]!,
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Control variant must not have a modification");
  });

  it("throws for invalid placement", async () => {
    const input = makeInput({
      variants: [
        makeInput().variants[0]!,
        {
          ...makeInput().variants[1]!,
          modification: { offerType: "INVALID" as never, headline: "bad" },
        },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("invalid offerType");
  });

  it("throws for negative triggerDelay", async () => {
    const input = makeInput({
      variants: [
        makeInput().variants[0]!,
        {
          ...makeInput().variants[1]!,
          modification: { offerType: "POPUP", headline: "bad", triggerDelay: -1 },
        },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("triggerDelay must be >= 0");
  });

  it("creates OFFER_TEST through ExperimentService", async () => {
    await service.create(SHOP_ID, makeInput());
    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "OFFER_TEST" })
    );
  });

  it("activate throws for completed experiments", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "COMPLETED" }) as never);
    await expect(service.activate(SHOP_ID, "exp-1")).rejects.toThrow("Cannot activate a completed test");
  });

  it("pause throws for non-running status", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.pause(SHOP_ID, "exp-1")).rejects.toThrow("Cannot pause a test with status");
  });
});
