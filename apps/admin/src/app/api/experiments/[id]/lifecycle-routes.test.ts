/**
 * Tests for the 4 experiment lifecycle action routes:
 * POST /api/experiments/[id]/launch
 * POST /api/experiments/[id]/pause
 * POST /api/experiments/[id]/complete
 * POST /api/experiments/[id]/archive
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

// ─── Hoisted service mocks ────────────────────────────────────────────────────

const { mockLaunch, mockPause, mockComplete, mockArchive } = vi.hoisted(() => ({
  mockLaunch: vi.fn(),
  mockPause: vi.fn(),
  mockComplete: vi.fn(),
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
    launch: mockLaunch,
    pause: mockPause,
    complete: mockComplete,
    archive: mockArchive,
  })),
}));

import { prisma } from "@/lib/prisma";

const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

// Lazy-import the route handlers after mocks are set up
const { POST: launchPOST } = await import("./launch/route");
const { POST: pausePOST } = await import("./pause/route");
const { POST: completePOST } = await import("./complete/route");
const { POST: archivePOST } = await import("./archive/route");

const TEST_API_KEY = "test-api-key";
const TEST_API_SECRET = "test-api-secret";
const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };
const EXP = { id: "exp-1", name: "Test Experiment", status: "RUNNING" };

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

// ─── POST /launch ─────────────────────────────────────────────────────────────

describe("POST /api/experiments/[id]/launch", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", { method: "POST" });
    const res = await launchPOST(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns launched experiment on success", async () => {
    mockLaunch.mockResolvedValueOnce({ ...EXP, status: "RUNNING" });
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await launchPOST(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.experiment as Record<string, unknown>).status).toBe("RUNNING");
  });

  it("calls service.launch with shopId, id, actorId", async () => {
    mockLaunch.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", {
      method: "POST",
      headers: authHeaders(),
    });
    await launchPOST(req, routeParams("exp-1"));
    expect(mockLaunch).toHaveBeenCalledWith("shop-1", "exp-1", "12345");
  });

  it("returns 422 for invalid status transition", async () => {
    mockLaunch.mockRejectedValueOnce(new Error("Cannot update: invalid status transition"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await launchPOST(req, routeParams());
    expect(res.status).toBe(422);
  });
});

// ─── POST /pause ──────────────────────────────────────────────────────────────

describe("POST /api/experiments/[id]/pause", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1/pause", { method: "POST" });
    const res = await pausePOST(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns paused experiment on success", async () => {
    mockPause.mockResolvedValueOnce({ ...EXP, status: "PAUSED" });
    const req = new NextRequest("http://localhost/api/experiments/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await pausePOST(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.experiment as Record<string, unknown>).status).toBe("PAUSED");
  });

  it("calls service.pause with shopId, id, actorId", async () => {
    mockPause.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    await pausePOST(req, routeParams("exp-1"));
    expect(mockPause).toHaveBeenCalledWith("shop-1", "exp-1", "12345");
  });

  it("returns 422 when pausing from non-RUNNING status", async () => {
    mockPause.mockRejectedValueOnce(new Error("Cannot update: cannot pause from DRAFT"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await pausePOST(req, routeParams());
    expect(res.status).toBe(422);
  });
});

// ─── POST /complete ───────────────────────────────────────────────────────────

describe("POST /api/experiments/[id]/complete", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1/complete", { method: "POST" });
    const res = await completePOST(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns completed experiment on success", async () => {
    mockComplete.mockResolvedValueOnce({ ...EXP, status: "COMPLETED" });
    const req = new NextRequest("http://localhost/api/experiments/exp-1/complete", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await completePOST(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.experiment as Record<string, unknown>).status).toBe("COMPLETED");
  });

  it("calls service.complete with shopId, id, actorId", async () => {
    mockComplete.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1/complete", {
      method: "POST",
      headers: authHeaders(),
    });
    await completePOST(req, routeParams("exp-1"));
    expect(mockComplete).toHaveBeenCalledWith("shop-1", "exp-1", "12345");
  });

  it("returns 422 for invalid status transition", async () => {
    mockComplete.mockRejectedValueOnce(new Error("Cannot update: cannot complete from DRAFT"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/complete", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await completePOST(req, routeParams());
    expect(res.status).toBe(422);
  });
});

// ─── POST /archive ────────────────────────────────────────────────────────────

describe("POST /api/experiments/[id]/archive", () => {
  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/experiments/exp-1/archive", { method: "POST" });
    const res = await archivePOST(req, routeParams());
    expect(res.status).toBe(401);
  });

  it("returns archived experiment on success", async () => {
    mockArchive.mockResolvedValueOnce({ ...EXP, status: "ARCHIVED" });
    const req = new NextRequest("http://localhost/api/experiments/exp-1/archive", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await archivePOST(req, routeParams());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.experiment as Record<string, unknown>).status).toBe("ARCHIVED");
  });

  it("calls service.archive with shopId, id, actorId", async () => {
    mockArchive.mockResolvedValueOnce(EXP);
    const req = new NextRequest("http://localhost/api/experiments/exp-1/archive", {
      method: "POST",
      headers: authHeaders(),
    });
    await archivePOST(req, routeParams("exp-1"));
    expect(mockArchive).toHaveBeenCalledWith("shop-1", "exp-1", "12345");
  });

  it("returns 404 when experiment not found", async () => {
    mockArchive.mockRejectedValueOnce(new Error("Experiment not found"));
    const req = new NextRequest("http://localhost/api/experiments/gone/archive", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await archivePOST(req, routeParams("gone"));
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid status transition on archive", async () => {
    mockArchive.mockRejectedValueOnce(new Error("Cannot update: invalid status transition"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/archive", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await archivePOST(req, routeParams());
    expect(res.status).toBe(422);
  });
});

// ─── Unexpected errors → 500 ──────────────────────────────────────────────────

describe("lifecycle routes — unexpected service errors return 500", () => {
  it("launch returns 500 on database failure", async () => {
    mockLaunch.mockRejectedValueOnce(new Error("Database connection reset"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await launchPOST(req, routeParams());
    expect(res.status).toBe(500);
  });

  it("pause returns 500 on database failure", async () => {
    mockPause.mockRejectedValueOnce(new Error("Database connection reset"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/pause", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await pausePOST(req, routeParams());
    expect(res.status).toBe(500);
  });

  it("complete returns 500 on database failure", async () => {
    mockComplete.mockRejectedValueOnce(new Error("Database connection reset"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/complete", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await completePOST(req, routeParams());
    expect(res.status).toBe(500);
  });

  it("archive returns 500 on database failure", async () => {
    mockArchive.mockRejectedValueOnce(new Error("Database connection reset"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/archive", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await archivePOST(req, routeParams());
    expect(res.status).toBe(500);
  });

  it("500 error body does not leak internal details", async () => {
    mockLaunch.mockRejectedValueOnce(new Error("DB_PASS=supersecret connection failed"));
    const req = new NextRequest("http://localhost/api/experiments/exp-1/launch", {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await launchPOST(req, routeParams());
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("supersecret");
  });
});
