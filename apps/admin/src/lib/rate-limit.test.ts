import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/rate-limit");

import { applyRateLimitHeaders, checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/redis", () => ({
  redis: {
    pipeline: vi.fn(),
    zrange: vi.fn(),
  },
}));

import { redis } from "@/lib/redis";

const mockPipeline = vi.mocked(redis.pipeline);
const mockZrange = vi.mocked(redis.zrange);

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests under the limit and computes reset timestamp", async () => {
    const exec = vi.fn().mockResolvedValue([[null, 1], [null, 2], [null, 1], [null, 1]]);
    const pipelineObj = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec,
    };
    mockPipeline.mockReturnValue(pipelineObj as never);
    mockZrange.mockResolvedValueOnce(["entry", "1000"] as never);

    const result = await checkRateLimit("shop-1:runtime", { limit: 5, windowSeconds: 60 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.resetAt).toBe(61000);
  });

  it("blocks when count reached the limit", async () => {
    const exec = vi.fn().mockResolvedValue([[null, 1], [null, 5], [null, 1], [null, 1]]);
    const pipelineObj = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec,
    };
    mockPipeline.mockReturnValue(pipelineObj as never);
    mockZrange.mockResolvedValueOnce(["entry", "2000"] as never);

    const result = await checkRateLimit("shop-1:runtime", { limit: 5, windowSeconds: 30 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(32000);
  });

  it("fails open when redis throws", async () => {
    mockPipeline.mockImplementation(() => {
      throw new Error("redis unavailable");
    });

    const result = await checkRateLimit("shop-1:runtime", { limit: 10, windowSeconds: 60 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.limit).toBe(10);
  });

  it("adds standard headers and Retry-After when blocked", () => {
    const headers = new Headers();
    applyRateLimitHeaders(headers, {
      allowed: false,
      remaining: 0,
      limit: 10,
      resetAt: Date.now() + 9000,
    });

    expect(headers.get("X-RateLimit-Limit")).toBe("10");
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(headers.get("Retry-After")).toBeTruthy();
  });
});
