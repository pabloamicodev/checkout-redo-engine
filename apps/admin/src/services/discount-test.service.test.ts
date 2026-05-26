import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscountTestService } from "./discount-test.service";

const {
  mockExpCreate,
  mockExpList,
  mockExpGet,
  mockExpLaunch,
  mockExpPause,
  mockExpArchive,
  mockExpDuplicate,
} = vi.hoisted(() => ({
  mockExpCreate: vi.fn(),
  mockExpList: vi.fn(),
  mockExpGet: vi.fn(),
  mockExpLaunch: vi.fn(),
  mockExpPause: vi.fn(),
  mockExpArchive: vi.fn(),
  mockExpDuplicate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    create: mockExpCreate,
    list: mockExpList,
    get: mockExpGet,
    launch: mockExpLaunch,
    pause: mockExpPause,
    archive: mockExpArchive,
    duplicate: mockExpDuplicate,
  })),
}));

import { prisma } from "@/lib/prisma";

const mockUpdate = vi.mocked(prisma.experiment.update);
const SHOP_ID = "shop-1";

function makeInput(
  overrides: Partial<Parameters<DiscountTestService["create"]>[1]> = {}
): Parameters<DiscountTestService["create"]>[1] {
  return {
    name: "Discount test",
    discountType: "PERCENTAGE",
    variants: [
      { name: "Control", isControl: true, allocation: 50 },
      { name: "Variant A", isControl: false, allocation: 50, discountValue: 10 },
    ],
    ...overrides,
  };
}

describe("DiscountTestService", () => {
  let service: DiscountTestService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiscountTestService();
    mockExpCreate.mockResolvedValue({ id: "exp-1" } as never);
    mockExpGet.mockResolvedValue({ id: "exp-1" } as never);
    mockExpList.mockResolvedValue({ experiments: [], total: 0 } as never);
    mockUpdate.mockResolvedValue({ id: "exp-1" } as never);
  });

  it("throws when variants are less than 2", async () => {
    await expect(service.create(SHOP_ID, makeInput({ variants: [makeInput().variants[0]!] }))).rejects.toThrow(
      "at least 2 variants"
    );
  });

  it("throws when control variant count is not exactly one", async () => {
    await expect(
      service.create(
        SHOP_ID,
        makeInput({
          variants: [
            { name: "A", isControl: false, allocation: 50, discountValue: 10 },
            { name: "B", isControl: false, allocation: 50, discountValue: 10 },
          ],
        })
      )
    ).rejects.toThrow("Exactly one control variant required");
  });

  it("throws when percentage exceeds 100", async () => {
    await expect(
      service.create(
        SHOP_ID,
        makeInput({
          variants: [
            { name: "Control", isControl: true, allocation: 50 },
            { name: "Variant A", isControl: false, allocation: 50, discountValue: 150 },
          ],
        })
      )
    ).rejects.toThrow("cannot exceed 100%");
  });

  it("creates DISCOUNT_TEST through ExperimentService", async () => {
    await service.create(SHOP_ID, makeInput());
    expect(mockExpCreate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ type: "DISCOUNT_TEST" })
    );
  });

  it("list delegates with DISCOUNT_TEST type", async () => {
    await service.list(SHOP_ID, { status: "RUNNING" });
    expect(mockExpList).toHaveBeenCalledWith(SHOP_ID, expect.objectContaining({ type: "DISCOUNT_TEST" }));
  });

  it("update trims name and writes prisma update", async () => {
    await service.update(SHOP_ID, "exp-1", { name: "  New Name  " });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "New Name" }) })
    );
  });
});
