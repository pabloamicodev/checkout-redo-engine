import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

// ─── Hoisted service mocks ────────────────────────────────────────────────────

const { mockGet, mockUpdate, mockArchive } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockArchive: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/experiment.service", () => ({
  ExperimentService: vi.fn().mockImplementation(() => ({
    get: mockGet,
    update: mockUpdate,
    archive: mockArchive,
  })),
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH, DELETE } from "./route";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

const TEST_API_KEY = "test-api-key";
const TEST_API_SECRET = "test-api-secret";
const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };
const EXP = { id: "exp-1", name: "Test", status: "DRAFT" };

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://test-shop.myshopify.com/admin",
    dest: "https://test-shop.myshopify.com",
    aud: TEST_API_KEY,
    sub: "12345",
    exp: now + 3600, nbf: now - 10, iat: now, jti: "jti",
  })).toString("base64url");
  const sig = createHmac("sha256", TEST_API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function authHeaders() {
  return { authorization: `Bearer ${makeJwt()}` };
}

function routeParams(id = "exp-1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  // NODE_ENV is already "test" in vitest
  mockShopFindUnique.mockResolvedValue(SHOP as never);
});

// ─── GET /api/experiments/[id] ────────────────────────────────────────────────

describe("GET /api/experiments/[id]", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1");
    const res = await GET(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns experiment on success", async () => {
    mockGet.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      headers: authHeaders(),
    });
    const res = await GET(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.experiment).toEqual(EXP);
  });

  it("returns 404 when experiment not found", async () => {
    mockGet.mockRejectedValueOnce(new Error("Experiment not found"));
    const req = new NextRequest("http://localhost/api/experiments/unknown", {
      headers: authHeaders(),
    });
    const res = await GET(req, routeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("scopes query to shopId — multi-tenant isolation", async () => {
    mockGet.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      headers: authHeaders(),
    });
    await GET(req, routeParams());
    expect(mockGet).toHaveBeenCalledWith("shop-1", "exp-1");
  });
});

// ─── PATCH /api/experiments/[id] ─────────────────────────────────────────────

describe("PATCH /api/experiments/[id]", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (trafficAllocation out of range)", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ trafficAllocation: 150 }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, routeParams());
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Validation failed");
  });

  it("returns updated experiment on success", async () => {
    const updated = { ...EXP, name: "Updated Name" };
    mockUpdate.mockResolvedValueOnce(updated);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.experiment as Record<string, unknown>).name).toBe("Updated Name");
  });

  it("passes actorId to service.update", async () => {
    mockUpdate.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    await PATCH(req, routeParams());
    expect(mockUpdate).toHaveBeenCalledWith("shop-1", "exp-1", expect.any(Object), "12345");
  });

  it("returns 422 for business rule violation", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("Variant allocations must sum to 100%"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
      headers: { "content-type": "application/json", ...authHeaders() },
    });
    const res = await PATCH(req, routeParams());
    expect(res.status).toBe(422);
  });
});

// ─── DELETE /api/experiments/[id] ────────────────────────────────────────────

describe("DELETE /api/experiments/[id]", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns 200 with success:true on archive", async () => {
    mockArchive.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await DELETE(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it("calls service.archive with correct shopId and experimentId", async () => {
    mockArchive.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1", {
      method: "DELETE",
      headers: authHeaders(),
    });
    await DELETE(req, routeParams("exp-1"));
    expect(mockArchive).toHaveBeenCalledWith("shop-1", "exp-1", "12345");
  });
});
