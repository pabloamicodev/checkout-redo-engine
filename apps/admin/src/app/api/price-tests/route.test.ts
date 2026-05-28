import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
}));

const mockGetShopId = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
    billingSubscription: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/api-shop", () => ({
  getShopId: mockGetShopId,
}));

vi.mock("@/services/price-test.service", () => ({
  PriceTestService: vi.fn().mockImplementation(() => ({
    list: mockList,
    create: mockCreate,
  })),
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimitHeaders: vi.fn(),
  RATE_LIMITS: { admin_api: {} },
}));

// ─── Mocks for auth middleware (withShopAuth for POST) ────────────────────────

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

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);
const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };

const VALID_BODY = {
  name: "My Price Test",
  trafficAllocation: 100,
  enforcementStrategy: "DISPLAY_ONLY",
  variants: [
    {
      key: "control",
      name: "Control",
      isControl: true,
      allocationPercent: 50,
      priceOverrides: [
        { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "29.99" },
      ],
    },
    {
      key: "variant-a",
      name: "Variant A",
      isControl: false,
      allocationPercent: 50,
      priceOverrides: [
        { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "24.99" },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  // GET uses getShopId (api-shop) — mocked to return shopId directly
  mockGetShopId.mockResolvedValue("shop-1");
  // POST uses withShopAuth — still needs prisma.shop.findUnique
  mockShopFindUnique.mockResolvedValue(SHOP as never);
  mockList.mockResolvedValue({ items: [], total: 0 });
  mockCreate.mockResolvedValue({ id: "exp-1", name: "My Price Test", status: "DRAFT" });
});

// ─── GET /api/price-tests ─────────────────────────────────────────────────────

describe("GET /api/price-tests", () => {
  it("returns 401 when shop is not found", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/price-tests", {
      headers: authHeaders(),
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns list with 200", async () => {
    const created = { id: "exp-1", name: "Price Test" };
    mockList.mockResolvedValueOnce({ items: [created], total: 1 });

    const req = new NextRequest("http://localhost/api/price-tests", {
      headers: authHeaders(),
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.total).toBe(1);
    expect((body.items as unknown[]).length).toBe(1);
  });

  it("passes status filter to service.list", async () => {
    const req = new NextRequest("http://localhost/api/price-tests?status=RUNNING", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ status: "RUNNING" })
    );
  });

  it("passes page parameter to service.list", async () => {
    const req = new NextRequest("http://localhost/api/price-tests?page=3", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ page: 3 })
    );
  });

  it("resolves shop from JWT and calls service.list", async () => {
    const req = new NextRequest("http://localhost/api/price-tests", {
      headers: authHeaders(),
    });
    await GET(req);
    expect(mockList).toHaveBeenCalledWith("shop-1", expect.any(Object));
  });
});

// ─── POST /api/price-tests ────────────────────────────────────────────────────

describe("POST /api/price-tests", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 201 with created experiment on success", async () => {
    const created = { id: "exp-1", name: "My Price Test", status: "DRAFT" };
    mockCreate.mockResolvedValueOnce(created);

    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("exp-1");
  });

  it("returns 422 for missing required field (name)", async () => {
    const { name: _omitted, ...bodyWithoutName } = VALID_BODY;
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(bodyWithoutName),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 422 for fewer than 2 variants", async () => {
    const body = { ...VALID_BODY, variants: [VALID_BODY.variants[0]] };
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid price format (non-decimal)", async () => {
    const body = {
      ...VALID_BODY,
      variants: [
        {
          ...VALID_BODY.variants[0],
          priceOverrides: [
            { shopifyVariantId: "gid://shopify/ProductVariant/111", shopifyProductId: "gid://shopify/Product/999", price: "not-a-price" },
          ],
        },
        VALID_BODY.variants[1],
      ],
    };
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 400 when service throws validation error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Allocations must sum to 100 (got 110)"));

    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("Allocations must sum to 100");
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: "{ invalid json !!!",
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("passes shopId to service.create", async () => {
    const req = new NextRequest("http://localhost/api/price-tests", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    await POST(req);
    expect(mockCreate).toHaveBeenCalledWith("shop-1", expect.any(Object));
  });
});
