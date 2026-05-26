/**
 * Tests for price-test sub-routes:
 *   GET/PATCH/DELETE  /api/price-tests/[id]
 *   POST              /api/price-tests/[id]/activate
 *   POST              /api/price-tests/[id]/pause
 *   POST              /api/price-tests/[id]/rollout
 *   POST              /api/price-tests/[id]/rollback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGet, mockUpdate, mockDelete,
  mockActivate, mockPause,
  mockRollout, mockRollback,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockActivate: vi.fn(),
  mockPause: vi.fn(),
  mockRollout: vi.fn(),
  mockRollback: vi.fn(),
}));

const mockGetShopId = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
    experiment: { delete: vi.fn() },
    billingSubscription: { findFirst: vi.fn() },
  },
}));

vi.mock("@/services/price-test.service", () => ({
  PriceTestService: vi.fn().mockImplementation(() => ({
    get: mockGet,
    update: mockUpdate,
    activate: mockActivate,
    pause: mockPause,
    rollout: mockRollout,
    rollback: mockRollback,
  })),
}));

vi.mock("@/lib/api-shop", () => ({
  getShopId: mockGetShopId,
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimitHeaders: vi.fn(),
  RATE_LIMITS: { admin_api: {} },
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH, DELETE } from "./route";
import { POST as POSTActivate } from "./activate/route";
import { POST as POSTPause } from "./pause/route";
import { POST as POSTRollout } from "./rollout/route";
import { POST as POSTRollback } from "./rollback/route";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const mockExpDelete = vi.mocked(prisma.experiment.delete);

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const TEST_API_KEY = "test-api-key";
const TEST_API_SECRET = "test-api-secret";

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://test-shop.myshopify.com/admin",
    dest: "https://test-shop.myshopify.com",
    aud: TEST_API_KEY,
    sub: "12345",
    exp: now + 3600,
    nbf: now - 10,
    iat: now,
    jti: "test-jti",
  })).toString("base64url");
  const sig = createHmac("sha256", TEST_API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function authHeaders() {
  return { authorization: `Bearer ${makeJwt()}` };
}

const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };
const EXPERIMENT = { id: "exp-1", name: "My Price Test", status: "DRAFT" };
const PARAMS = { params: Promise.resolve({ id: "exp-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  mockGetShopId.mockResolvedValue("shop-1");
  mockShopFindUnique.mockResolvedValue(SHOP as never);
  mockGet.mockResolvedValue(EXPERIMENT);
  mockUpdate.mockResolvedValue(EXPERIMENT);
  mockActivate.mockResolvedValue({ ...EXPERIMENT, status: "RUNNING" });
  mockPause.mockResolvedValue({ ...EXPERIMENT, status: "PAUSED" });
  mockRollout.mockResolvedValue({ rolledOut: 1, backup: [] });
  mockRollback.mockResolvedValue({ restored: 1 });
  mockExpDelete.mockResolvedValue({} as never);
});

// ─── GET /api/price-tests/[id] ────────────────────────────────────────────────

describe("GET /api/price-tests/[id]", () => {
  it("returns 404 when shop not found", async () => {
    mockGetShopId.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests/exp-1");
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 200 with experiment when found", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      headers: authHeaders(),
    });
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("exp-1");
  });

  it("returns 404 when service throws not found", async () => {
    mockGet.mockRejectedValueOnce(new Error("Price test not found"));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      headers: authHeaders(),
    });
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/price-tests/[id] ─────────────────────────────────────────────

describe("PATCH /api/price-tests/[id]", () => {
  it("returns 404 when shop not found", async () => {
    mockGetShopId.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 200 with updated experiment", async () => {
    mockUpdate.mockResolvedValueOnce({ ...EXPERIMENT, name: "New Name" });
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("New Name");
  });

  it("returns 422 for empty name", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(422);
  });

  it("returns 404 when service throws not found", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("Price test not found"));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "PATCH",
      body: "{ invalid",
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/price-tests/[id] ────────────────────────────────────────────

describe("DELETE /api/price-tests/[id]", () => {
  it("returns 404 when shop not found", async () => {
    mockGetShopId.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(204);
    expect(mockExpDelete).toHaveBeenCalledWith({ where: { id: "exp-1" } });
  });

  it("returns 404 when experiment not found", async () => {
    mockGet.mockRejectedValueOnce(new Error("Price test not found"));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/price-tests/[id]/activate ─────────────────────────────────────

describe("POST /api/price-tests/[id]/activate", () => {
  it("returns 404 when shop not found", async () => {
    mockGetShopId.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/activate", { method: "POST" });
    const res = await POSTActivate(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 200 with running experiment on success", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/activate", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTActivate(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("RUNNING");
  });

  it("returns 404 when experiment not found", async () => {
    mockActivate.mockRejectedValueOnce(new Error("Price test not found"));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/activate", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTActivate(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 422 when experiment cannot be activated (COMPLETED)", async () => {
    mockActivate.mockRejectedValueOnce(new Error("Cannot activate a completed test"));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/activate", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTActivate(req, PARAMS);
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/price-tests/[id]/pause ────────────────────────────────────────

describe("POST /api/price-tests/[id]/pause", () => {
  it("returns 404 when shop not found", async () => {
    mockGetShopId.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/pause", { method: "POST" });
    const res = await POSTPause(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 200 with paused experiment on success", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTPause(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("PAUSED");
  });

  it("returns 422 when experiment is not running", async () => {
    mockPause.mockRejectedValueOnce(new Error("Cannot pause a test with status \"DRAFT\""));
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTPause(req, PARAMS);
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/price-tests/[id]/rollout ──────────────────────────────────────

describe("POST /api/price-tests/[id]/rollout", () => {
  const ROLLOUT_BODY = {
    winnerVariantId: "var-test",
    confirmationToken: "exp-1",
  };

  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: JSON.stringify(ROLLOUT_BODY),
      headers: { "content-type": "application/json" },
    });
    const res = await POSTRollout(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 200 with rollout result on success", async () => {
    mockRollout.mockResolvedValueOnce({ rolledOut: 3, backup: [{ variantId: "v-1" }] });

    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: JSON.stringify(ROLLOUT_BODY),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POSTRollout(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.rolledOut).toBe(3);
  });

  it("returns 422 when confirmationToken is missing", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: JSON.stringify({ winnerVariantId: "var-test" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POSTRollout(req, PARAMS);
    expect(res.status).toBe(422);
  });

  it("returns 400 when wrong confirmationToken", async () => {
    mockRollout.mockRejectedValueOnce(new Error("Invalid confirmation token — pass the experiment ID to confirm rollout"));

    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: JSON.stringify({ winnerVariantId: "var-test", confirmationToken: "WRONG" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POSTRollout(req, PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("Invalid confirmation token");
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: "{ bad json",
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POSTRollout(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("passes shopId, experimentId, winnerVariantId, confirmationToken, shopDomain to service", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollout", {
      method: "POST",
      body: JSON.stringify(ROLLOUT_BODY),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    await POSTRollout(req, PARAMS);
    expect(mockRollout).toHaveBeenCalledWith(
      "shop-1",
      "exp-1",
      "var-test",
      "exp-1",
      "test-shop.myshopify.com"
    );
  });
});

// ─── POST /api/price-tests/[id]/rollback ─────────────────────────────────────

describe("POST /api/price-tests/[id]/rollback", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollback", { method: "POST" });
    const res = await POSTRollback(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 200 with restored count on success", async () => {
    mockRollback.mockResolvedValueOnce({ restored: 2 });

    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollback", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTRollback(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.restored).toBe(2);
  });

  it("returns 400 when no backup exists", async () => {
    mockRollback.mockRejectedValueOnce(new Error("No rollout backup found — rollback is not available for this test"));

    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollback", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTRollback(req, PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("No rollout backup found");
  });

  it("returns 400 when backup is older than 30 days", async () => {
    mockRollback.mockRejectedValueOnce(new Error("Rollback not available — backup is older than 30 days"));

    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollback", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await POSTRollback(req, PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("30 days");
  });

  it("passes shopId, experimentId, shopDomain to service", async () => {
    const req = new NextRequest("http://localhost/api/price-tests/exp-1/rollback", {
      method: "POST",
      headers: authHeaders(),
    });
    await POSTRollback(req, PARAMS);
    expect(mockRollback).toHaveBeenCalledWith("shop-1", "exp-1", "test-shop.myshopify.com");
  });
});
