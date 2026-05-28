import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/offer.service", () => ({
  OfferService: vi.fn().mockImplementation(() => ({
    list: mockList,
    create: mockCreate,
  })),
}));

vi.mock("@/lib/api-middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-middleware")>("@/lib/api-middleware");
  return actual;
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

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
  mockShopFindUnique.mockResolvedValue(SHOP as never);
});

// ─── GET /api/offers ──────────────────────────────────────────────────────────

describe("GET /api/offers", () => {
  it("returns 200 with offer list", async () => {
    mockList.mockResolvedValueOnce({ items: [], total: 0 });

    const req = new NextRequest("http://localhost/api/offers", {
      headers: authHeaders(),
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("passes status filter to service.list", async () => {
    mockList.mockResolvedValueOnce({ items: [], total: 0 });

    const req = new NextRequest("http://localhost/api/offers?status=ACTIVE", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ status: "ACTIVE" })
    );
  });

  it("passes type filter to service.list", async () => {
    mockList.mockResolvedValueOnce({ items: [], total: 0 });

    const req = new NextRequest("http://localhost/api/offers?type=FREE_SHIPPING", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ type: "FREE_SHIPPING" })
    );
  });

  it("returns 401 when shop not found", async () => {
    mockShopFindUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/offers", {
      headers: authHeaders(),
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/offers ─────────────────────────────────────────────────────────

describe("POST /api/offers", () => {
  const validBody = {
    name: "10% Off",
    type: "PERCENTAGE_DISCOUNT",
    discountRules: { percentage: 10 },
    triggerRules: [],
    displaySettings: {},
  };

  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 201 on successful creation", async () => {
    const created = { id: "offer-1", ...validBody, status: "DRAFT" };
    mockCreate.mockResolvedValueOnce(created);

    const req = new NextRequest("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("offer-1");
  });

  it("returns 422 for invalid body (missing name)", async () => {
    const req = new NextRequest("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ type: "PERCENTAGE_DISCOUNT", discountRules: { percentage: 10 } }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 400 when service throws a validation error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("percentage must be between 0 and 100"));

    const req = new NextRequest("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("percentage");
  });
});
