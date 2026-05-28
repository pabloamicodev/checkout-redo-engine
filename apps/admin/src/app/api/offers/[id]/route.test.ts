import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const { mockGet, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/offer.service", () => ({
  OfferService: vi.fn().mockImplementation(() => ({
    get: mockGet,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH, DELETE } from "./route";

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
const OFFER = { id: "offer-1", name: "10% Off", status: "DRAFT" };
const PARAMS = Promise.resolve({ id: "offer-1" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  mockShopFindUnique.mockResolvedValue(SHOP as never);
});

// ─── GET /api/offers/[id] ─────────────────────────────────────────────────────

describe("GET /api/offers/[id]", () => {
  it("returns offer when found", async () => {
    mockGet.mockResolvedValueOnce(OFFER);

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      headers: authHeaders(),
    });
    const res = await GET(req, { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("offer-1");
  });

  it("returns 404 when offer not found", async () => {
    mockGet.mockRejectedValueOnce(new Error("Offer not found"));

    const req = new NextRequest("http://localhost/api/offers/missing", {
      headers: authHeaders(),
    });
    const res = await GET(req, { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("returns 401 when shop not found", async () => {
    mockShopFindUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      headers: authHeaders(),
    });
    const res = await GET(req, { params: PARAMS });
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/offers/[id] ───────────────────────────────────────────────────

describe("PATCH /api/offers/[id]", () => {
  it("updates offer and returns 200", async () => {
    const updated = { ...OFFER, name: "20% Off" };
    mockUpdate.mockResolvedValueOnce(updated);

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "20% Off" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("20% Off");
  });

  it("returns 404 when offer not found", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("Offer not found: offer-1"));

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("returns 400 on validation error from service", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("percentage must be between 0 and 100"));

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "PATCH",
      body: JSON.stringify({ discountRules: { percentage: 110 } }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it("returns 401 when shop not found", async () => {
    mockShopFindUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Test" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, { params: PARAMS });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/offers/[id] ──────────────────────────────────────────────────

describe("DELETE /api/offers/[id]", () => {
  it("deletes offer and returns 204", async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, { params: PARAMS });
    expect(res.status).toBe(204);
  });

  it("returns 400 when offer is ACTIVE", async () => {
    mockDelete.mockRejectedValueOnce(new Error("Cannot delete an ACTIVE offer"));

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("ACTIVE");
  });

  it("returns 404 when offer not found", async () => {
    mockDelete.mockRejectedValueOnce(new Error("Offer not found: offer-1"));

    const req = new NextRequest("http://localhost/api/offers/offer-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, { params: PARAMS });
    expect(res.status).toBe(404);
  });
});
