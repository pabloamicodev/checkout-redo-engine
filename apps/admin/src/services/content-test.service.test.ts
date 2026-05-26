import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentTestService } from "./content-test.service";

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
    experimentVariant: {
      findFirst: vi.fn(),
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
const mockVariantFindFirst = vi.mocked(prisma.experimentVariant.findFirst);
const mockVariantUpdate = vi.mocked(prisma.experimentVariant.update);

const SHOP_ID = "shop-1";

function makeCreateInput(overrides: Partial<Parameters<ContentTestService["create"]>[1]> = {}) {
  return {
    name: "Content test",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, modifications: [] },
      {
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        modifications: [{ type: "replace_text" as const, selector: ".hero h1", textValue: "New title" }],
      },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "CONTENT_TEST",
    status: "DRAFT",
    variants: [],
    ...overrides,
  };
}

describe("ContentTestService", () => {
  let service: ContentTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentTestService();
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockVariantFindFirst.mockResolvedValue({
      id: "var-1",
      experimentId: "exp-1",
      isControl: false,
      modifications: [],
    } as never);
    mockVariantUpdate.mockResolvedValue({ id: "var-1" } as never);
    mockExpCreate.mockResolvedValue(makeExperiment() as never);
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
  });

  it("throws when control variant includes modifications", async () => {
    const input = makeCreateInput({
      variants: [
        { ...makeCreateInput().variants[0]!, modifications: [{ type: "replace_text", selector: ".x", textValue: "x" }] },
        makeCreateInput().variants[1]!,
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Control variant must not have modifications");
  });

  it("throws when non-control variant has no modifications", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        { ...makeCreateInput().variants[1]!, modifications: [] },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("must have at least one modification");
  });

  it("throws for invalid modification type", async () => {
    const input = makeCreateInput({
      variants: [
        makeCreateInput().variants[0]!,
        {
          ...makeCreateInput().variants[1]!,
          modifications: [{ type: "not_real" as never, selector: ".x" }],
        },
      ],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("invalid type");
  });

  it("throws for invalid targeting rule", async () => {
    const input = makeCreateInput({
      targetingRules: [{ type: "bad_type" as never, value: "x" }],
    });

    await expect(service.create(SHOP_ID, input)).rejects.toThrow("Targeting rule 1: invalid type");
  });

  it("creates experiment via ExperimentService", async () => {
    await service.create(SHOP_ID, makeCreateInput());
    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "CONTENT_TEST" })
    );
  });

  it("addModification rejects control variant", async () => {
    mockVariantFindFirst.mockResolvedValueOnce({
      id: "var-ctrl",
      experimentId: "exp-1",
      isControl: true,
      modifications: [],
    } as never);

    await expect(
      service.addModification(SHOP_ID, "exp-1", "var-ctrl", { type: "replace_text", selector: ".x", textValue: "y" })
    ).rejects.toThrow("Cannot add modifications to the control variant");
  });

  it("addModification appends modification for non-control", async () => {
    await service.addModification(SHOP_ID, "exp-1", "var-1", {
      type: "replace_text",
      selector: ".hero",
      textValue: "Updated",
    });

    expect(mockVariantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modifications: expect.arrayContaining([expect.objectContaining({ type: "replace_text" })]) }),
      })
    );
  });

  it("removeModification throws when index is out of range", async () => {
    mockVariantFindFirst.mockResolvedValueOnce({
      id: "var-1",
      experimentId: "exp-1",
      isControl: false,
      modifications: [{ type: "replace_text", selector: ".x", textValue: "x" }],
    } as never);

    await expect(service.removeModification(SHOP_ID, "exp-1", "var-1", 9)).rejects.toThrow("out of range");
  });
});
