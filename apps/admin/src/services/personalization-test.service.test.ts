import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalizationTestService } from "./personalization-test.service";

const { mockExpLaunch, mockExpPause, mockGenerateSlug } = vi.hoisted(() => ({
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
  mockGenerateSlug: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    launch: mockExpLaunch,
    pause: mockExpPause,
  })),
}));

vi.mock("@/lib/utils", () => ({
  generateSlug: mockGenerateSlug,
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = vi.mocked(prisma.experiment.findFirst);
const mockFindUnique = vi.mocked(prisma.experiment.findUnique);
const mockCreate = vi.mocked(prisma.experiment.create);

const SHOP_ID = "shop-1";

function makeInput(overrides: Partial<Parameters<PersonalizationTestService["create"]>[1]> = {}) {
  return {
    name: "Personalization test",
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, actions: [] },
      {
        key: "variant-a",
        name: "Variant A",
        isControl: false,
        allocationPercent: 50,
        actions: [{ type: "replace_text", selector: ".hero", content: "Hello" }],
      },
    ],
    ...overrides,
  };
}

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    shopId: SHOP_ID,
    type: "PERSONALIZATION_TEST",
    status: "DRAFT",
    variants: [],
    ...overrides,
  };
}

describe("PersonalizationTestService", () => {
  let service: PersonalizationTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PersonalizationTestService();
    mockGenerateSlug.mockReturnValue("personalization-test");
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(makeExperiment() as never);
    mockFindFirst.mockResolvedValue(makeExperiment() as never);
    mockExpLaunch.mockResolvedValue(makeExperiment({ status: "RUNNING" }) as never);
    mockExpPause.mockResolvedValue(makeExperiment({ status: "PAUSED" }) as never);
  });

  it("throws when allocations do not sum to 100", async () => {
    await expect(
      service.create(
        SHOP_ID,
        makeInput({
          variants: [
            { key: "control", name: "Control", isControl: true, allocationPercent: 20 },
            { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 20 },
          ],
        })
      )
    ).rejects.toThrow("Variant allocations must sum to 100");
  });

  it("generates unique slug with numeric suffix when collision exists", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: "existing" } as never)
      .mockResolvedValueOnce(null);

    await service.create(SHOP_ID, makeInput());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "personalization-test-1" }) })
    );
  });

  it("activate is idempotent when already RUNNING", async () => {
    const running = makeExperiment({ status: "RUNNING" });
    mockFindFirst.mockResolvedValueOnce(running as never);

    const result = await service.activate(SHOP_ID, "exp-1");
    expect(result).toEqual(running);
    expect(mockExpLaunch).not.toHaveBeenCalled();
  });

  it("pause throws when experiment is not RUNNING", async () => {
    mockFindFirst.mockResolvedValueOnce(makeExperiment({ status: "DRAFT" }) as never);
    await expect(service.pause(SHOP_ID, "exp-1")).rejects.toThrow("Cannot pause a test with status");
  });
});
