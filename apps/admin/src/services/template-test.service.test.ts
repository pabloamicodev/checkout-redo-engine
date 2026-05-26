import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateTestService } from "./template-test.service";

const { mockExpCreate, mockExpLaunch, mockExpPause, mockExpArchive, mockExpDuplicate } = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
  mockExpArchive: vi.fn(),
  mockExpDuplicate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
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

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.experiment.findMany);
const mockCount = vi.mocked(prisma.experiment.count);
const mockFindFirst = vi.mocked(prisma.experiment.findFirst);

const SHOP_ID = "shop-1";

function makeData(overrides: Partial<Parameters<TemplateTestService["create"]>[1]> = {}) {
  return {
    name: "Template test",
    templateId: "tmpl-1",
    variants: [
      { name: "Control", isControl: true, allocation: 50 },
      { name: "Variant A", isControl: false, allocation: 50 },
    ],
    ...overrides,
  };
}

describe("TemplateTestService", () => {
  let service: TemplateTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateTestService();
    mockFindMany.mockResolvedValue([] as never);
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue({
      id: "exp-1",
      status: "DRAFT",
      settings: { templateId: "tmpl-1" },
      variants: [],
    } as never);
  });

  it("throws when variants are fewer than 2", async () => {
    await expect(service.create(SHOP_ID, makeData({ variants: [makeData().variants[0]!] }))).rejects.toThrow(
      "at least 2 variants"
    );
  });

  it("throws when control variant is missing", async () => {
    await expect(
      service.create(
        SHOP_ID,
        makeData({
          variants: [
            { name: "A", isControl: false, allocation: 50 },
            { name: "B", isControl: false, allocation: 50 },
          ],
        })
      )
    ).rejects.toThrow("exactly one control variant");
  });

  it("returns items and total from list", async () => {
    mockFindMany.mockResolvedValueOnce([{ id: "exp-1" }] as never);
    mockCount.mockResolvedValueOnce(1);

    const result = await service.list(SHOP_ID, { limit: 10, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("activate throws when another template test is already running", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: "exp-1", status: "DRAFT", settings: { templateId: "tmpl-1" }, variants: [] } as never)
      .mockResolvedValueOnce({ id: "exp-2", name: "Conflicting" } as never);

    await expect(service.activate(SHOP_ID, "exp-1")).rejects.toThrow("already being tested");
  });
});
