import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomEventService } from "./custom-event.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.customEvent.findMany);
const mockFindFirst = vi.mocked(prisma.customEvent.findFirst);
const mockFindUnique = vi.mocked(prisma.customEvent.findUnique);
const mockCreate = vi.mocked(prisma.customEvent.create);
const mockUpdate = vi.mocked(prisma.customEvent.update);
const mockDelete = vi.mocked(prisma.customEvent.delete);

const SHOP = "shop-1";
const EVENT = { id: "evt-1", shopId: SHOP, name: "page_view", displayName: "Page View" };

describe("CustomEventService.list", () => {
  let svc: CustomEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CustomEventService();
    mockFindMany.mockResolvedValue([EVENT] as never);
  });

  it("returns events for the shop", async () => {
    const result = await svc.list(SHOP);
    expect(result.events).toEqual([EVENT]);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: SHOP } })
    );
  });

  it("orders by createdAt desc", async () => {
    await svc.list(SHOP);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });
});

describe("CustomEventService.get", () => {
  let svc: CustomEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CustomEventService();
  });

  it("returns the event when found", async () => {
    mockFindFirst.mockResolvedValue(EVENT as never);
    const result = await svc.get(SHOP, "evt-1");
    expect(result).toEqual(EVENT);
  });

  it("throws when event not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.get(SHOP, "missing")).rejects.toThrow("Custom event not found");
  });
});

describe("CustomEventService.create", () => {
  let svc: CustomEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CustomEventService();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(EVENT as never);
  });

  it("creates a custom event with valid name", async () => {
    await svc.create(SHOP, { name: "page_view", displayName: "Page View" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: SHOP,
          name: "page_view",
          displayName: "Page View",
        }),
      })
    );
  });

  it("throws when name contains uppercase letters", async () => {
    await expect(
      svc.create(SHOP, { name: "PageView", displayName: "Page View" })
    ).rejects.toThrow("name must be lowercase alphanumeric with underscores only");
  });

  it("throws when name contains spaces", async () => {
    await expect(
      svc.create(SHOP, { name: "page view", displayName: "Page View" })
    ).rejects.toThrow("name must be lowercase alphanumeric with underscores only");
  });

  it("throws when name contains hyphens", async () => {
    await expect(
      svc.create(SHOP, { name: "page-view", displayName: "Page View" })
    ).rejects.toThrow("name must be lowercase alphanumeric with underscores only");
  });

  it("accepts names with underscores and numbers", async () => {
    await expect(
      svc.create(SHOP, { name: "page_view_2", displayName: "Page View 2" })
    ).resolves.toBeDefined();
  });

  it("throws when event name already exists for this shop", async () => {
    mockFindUnique.mockResolvedValue(EVENT as never);
    await expect(
      svc.create(SHOP, { name: "page_view", displayName: "Page View" })
    ).rejects.toThrow('A custom event named "page_view" already exists');
  });

  it("stores empty schema when not provided", async () => {
    await svc.create(SHOP, { name: "page_view", displayName: "Page View" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schema: {} }),
      })
    );
  });

  it("stores provided schema", async () => {
    const schema = { url: { type: "string" } };
    await svc.create(SHOP, { name: "page_view", displayName: "Page View", schema });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schema }),
      })
    );
  });
});

describe("CustomEventService.update", () => {
  let svc: CustomEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CustomEventService();
    mockFindFirst.mockResolvedValue(EVENT as never);
    mockUpdate.mockResolvedValue({ ...EVENT, displayName: "Updated" } as never);
  });

  it("updates displayName", async () => {
    await svc.update(SHOP, "evt-1", { displayName: "Updated" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: { displayName: "Updated" },
      })
    );
  });

  it("updates description", async () => {
    await svc.update(SHOP, "evt-1", { description: "A description" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { description: "A description" },
      })
    );
  });

  it("updates schema", async () => {
    const schema = { url: { type: "string" } };
    await svc.update(SHOP, "evt-1", { schema });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { schema },
      })
    );
  });

  it("throws when event not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.update(SHOP, "missing", { displayName: "X" })).rejects.toThrow(
      "Custom event not found"
    );
  });
});

describe("CustomEventService.delete", () => {
  let svc: CustomEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CustomEventService();
    mockFindFirst.mockResolvedValue(EVENT as never);
    mockDelete.mockResolvedValue({} as never);
  });

  it("deletes the event", async () => {
    await svc.delete(SHOP, "evt-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "evt-1" } });
  });

  it("throws when event not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(svc.delete(SHOP, "missing")).rejects.toThrow("Custom event not found");
  });
});
