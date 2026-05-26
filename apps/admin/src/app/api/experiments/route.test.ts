import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

// ─── Hoisted service mocks ────────────────────────────────────────────────────

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    list: mockList,
    create: mockCreate,
  })),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

// ─── JWT helper ───────────────────────────────────────────────────────────────

const TEST_API_KEY = "test-api-key";
const TEST_API_SECRET = "test-api-secret";

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://test-shop.myshopify.com/admin",
      dest: "https://test-shop.myshopify.com",
      aud: TEST_API_KEY,
      sub: "12345",
      exp: now + 3600,
      nbf: now - 10,
      iat: now,
      jti: "test-jti",
    })
  ).toString("base64url");
  const sig = createHmac("sha256", TEST_API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function authHeaders() {
  return { authorization: `Bearer ${makeJwt()}` };
}

const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  // NODE_ENV is already "test" in vitest
  mockShopFindUnique.mockResolvedValue(SHOP as never);
});

// ─── GET /api/experiments ─────────────────────────────────────────────────────

describe("GET /api/experiments", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns experiments list with 200", async () => {
    mockList.mockResolvedValueOnce({ experiments: [], total: 0 });

    const req = new NextRequest("http://localhost/api/experiments", {
      headers: authHeaders(),
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.experiments).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("passes status filter to service.list", async () => {
    mockList.mockResolvedValueOnce({ experiments: [], total: 0 });

    const req = new NextRequest("http://localhost/api/experiments?status=RUNNING", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith("shop-1", expect.objectContaining({ status: "RUNNING" }));
  });

  it("passes search query to service.list", async () => {
    mockList.mockResolvedValueOnce({ experiments: [], total: 0 });

    const req = new NextRequest("http://localhost/api/experiments?q=price%20test", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith("shop-1", expect.objectContaining({ search: "price test" }));
  });
});

// ─── POST /api/experiments ────────────────────────────────────────────────────

describe("POST /api/experiments", () => {
  const validBody = {
    name: "My Price Test",
    type: "PRICE_TEST",
    hypothesis: "Lower price increases conversion",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50 },
      { key: "variant-a", name: "Variant A", isControl: false, allocationPercent: 50 },
    ],
  };

  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (missing name)", async () => {
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ type: "PRICE_TEST", variants: [] }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Validation failed");
  });

  it("returns 201 and created experiment on success", async () => {
    const created = { id: "exp-1", name: "My Price Test", status: "DRAFT" };
    mockCreate.mockResolvedValueOnce(created);

    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.experiment).toEqual(created);
  });

  it("passes shopId and actorId to service.create", async () => {
    mockCreate.mockResolvedValueOnce({ id: "exp-1" });

    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    await POST(req);
    expect(mockCreate).toHaveBeenCalledWith("shop-1", expect.any(Object), "12345");
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: "{ invalid json !!!",
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when service throws an unexpected error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Database connection reset"));
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("500 response body does not leak internal error details", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB_PASS=topsecret internal error"));
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("topsecret");
  });

  it("returns 400 for empty body", async () => {
    const req = new NextRequest("http://localhost/api/experiments", {
      method: "POST",
      body: "",
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
