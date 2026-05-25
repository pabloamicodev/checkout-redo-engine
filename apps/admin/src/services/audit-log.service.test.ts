import { describe, it, expect, vi, beforeEach } from "vitest";

// test-setup.ts globally mocks this module — unmock it here so we test the real class
vi.unmock("@/services/audit-log.service");

import { AuditLogService } from "./audit-log.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockCreate = vi.mocked(prisma.auditLog.create);
const mockFindMany = vi.mocked(prisma.auditLog.findMany);
const mockCount = vi.mocked(prisma.auditLog.count);
const mockTransaction = vi.mocked(prisma.$transaction);

const BASE_INPUT = {
  shopId: "shop-1",
  entityType: "Offer",
  entityId: "offer-1",
  action: "CREATE",
};

describe("AuditLogService.log", () => {
  let svc: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AuditLogService();
  });

  it("creates an audit log record with all fields", async () => {
    mockCreate.mockResolvedValue({} as never);

    await svc.log({
      ...BASE_INPUT,
      actorId: "user-1",
      actorEmail: "user@example.com",
      entityName: "Summer Sale",
      before: { status: "DRAFT" },
      after: { status: "ACTIVE" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: "shop-1",
          actorId: "user-1",
          actorEmail: "user@example.com",
          entityType: "Offer",
          entityId: "offer-1",
          entityName: "Summer Sale",
          action: "CREATE",
          ipAddress: "1.2.3.4",
          userAgent: "Mozilla/5.0",
        }),
      })
    );
  });

  it("defaults actorId to 'system' when not provided", async () => {
    mockCreate.mockResolvedValue({} as never);

    await svc.log(BASE_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: "system" }),
      })
    );
  });

  it("swallows errors — does not throw when prisma fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB down"));

    await expect(svc.log(BASE_INPUT)).resolves.toBeUndefined();
  });
});

describe("AuditLogService.list", () => {
  let svc: AuditLogService;

  const LOGS = [{ id: "log-1", action: "CREATE" }];

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AuditLogService();
    mockTransaction.mockImplementation(async (ops: unknown) => {
      return Promise.all(ops as Array<Promise<unknown>>);
    });
    mockFindMany.mockResolvedValue(LOGS as never);
    mockCount.mockResolvedValue(1);
  });

  it("returns logs and total with no filters", async () => {
    const result = await svc.list("shop-1");

    expect(result.logs).toEqual(LOGS);
    expect(result.total).toBe(1);
  });

  it("applies entityType filter", async () => {
    await svc.list("shop-1", { entityType: "Offer" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: "Offer" }),
      })
    );
  });

  it("applies entityId filter", async () => {
    await svc.list("shop-1", { entityId: "offer-1" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityId: "offer-1" }),
      })
    );
  });

  it("applies action filter", async () => {
    await svc.list("shop-1", { action: "DELETE" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "DELETE" }),
      })
    );
  });

  it("applies limit and offset", async () => {
    await svc.list("shop-1", { limit: 10, offset: 20 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });

  it("defaults limit to 50 and offset to 0", async () => {
    await svc.list("shop-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 })
    );
  });

  it("orders by createdAt desc", async () => {
    await svc.list("shop-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });
});
