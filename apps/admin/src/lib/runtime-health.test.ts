import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeHealth, recordRuntimeSignal } from "./runtime-health";

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
  },
}));

import { redis } from "@/lib/redis";

const mockSet = vi.mocked(redis.set);
const mockGet = vi.mocked(redis.get);

describe("runtime-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue("OK" as never);
  });

  it("records runtime signals with namespaced key + TTL", async () => {
    recordRuntimeSignal("shop.myshopify.com", "assignment");
    await Promise.resolve();

    expect(mockSet).toHaveBeenCalledWith(
      "rh:shop.myshopify.com:assignment",
      expect.any(String),
      "EX",
      172800
    );
  });

  it("swallows set errors so storefront path is not blocked", async () => {
    mockSet.mockRejectedValueOnce(new Error("redis down"));
    expect(() => recordRuntimeSignal("shop.myshopify.com", "config_fetch")).not.toThrow();
    await Promise.resolve();
  });

  it("returns current signal timestamps", async () => {
    mockGet
      .mockResolvedValueOnce("2026-01-01T00:00:00.000Z" as never)
      .mockResolvedValueOnce("2026-01-01T01:00:00.000Z" as never)
      .mockResolvedValueOnce("2026-01-01T02:00:00.000Z" as never)
      .mockResolvedValueOnce("2026-01-01T03:00:00.000Z" as never);

    const result = await getRuntimeHealth("shop.myshopify.com");

    expect(result).toEqual({
      lastConfigFetch: "2026-01-01T00:00:00.000Z",
      lastAssignment: "2026-01-01T01:00:00.000Z",
      lastCartSync: "2026-01-01T02:00:00.000Z",
      lastEventIngested: "2026-01-01T03:00:00.000Z",
    });
  });

  it("returns null health values when redis read fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("redis down"));
    const result = await getRuntimeHealth("shop.myshopify.com");
    expect(result).toEqual({
      lastConfigFetch: null,
      lastAssignment: null,
      lastCartSync: null,
      lastEventIngested: null,
    });
  });
});
