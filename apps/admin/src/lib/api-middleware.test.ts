import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { getShopFromRequest, withShopAuth, withRuntimeAuth } from "./api-middleware";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
const mockShopFindUnique = vi.mocked(prisma.shop.findUnique);

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const TEST_API_KEY = "test-api-key";
const TEST_API_SECRET = "test-api-secret";

function makeJwt(overrides: Partial<{
  dest: string;
  aud: string;
  exp: number;
  nbf: number;
  iat: number;
  sub: string;
  iss: string;
  secret: string;
  corruptSignature: boolean;
}> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const {
    dest = "https://test-shop.myshopify.com",
    aud = TEST_API_KEY,
    exp = now + 3600,
    nbf = now - 10,
    iat = now,
    sub = "12345",
    iss = "https://test-shop.myshopify.com/admin",
    secret = TEST_API_SECRET,
    corruptSignature = false,
  } = overrides;

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss, dest, aud, sub, exp, nbf, iat, jti: "test-jti" })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sig = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${header}.${payload}.${corruptSignature ? sig.split("").reverse().join("") : sig}`;
}

function makeRequest(url: string, options: {
  headers?: Record<string, string>;
  method?: string;
} = {}): NextRequest {
  return new NextRequest(url, {
    method: options.method ?? "GET",
    headers: options.headers ?? {},
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockShopFindUnique.mockReset(); // flush any unconsumed mockResolvedValueOnce queue
  process.env.SHOPIFY_API_KEY = TEST_API_KEY;
  process.env.SHOPIFY_API_SECRET = TEST_API_SECRET;
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── getShopFromRequest — JWT path ────────────────────────────────────────────

describe("getShopFromRequest — JWT", () => {
  it("resolves shop from valid JWT", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const result = await getShopFromRequest(req);
    expect(result?.shopId).toBe("shop-1");
    expect(result?.shopDomain).toBe("test-shop.myshopify.com");
  });

  it("extracts actorId from JWT sub when not 0", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ sub: "99999" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result?.actorId).toBe("99999");
  });

  it("sets actorId to undefined when sub is 0", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ sub: "0" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result?.actorId).toBeUndefined();
  });

  it("rejects expired JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ exp: now - 60 })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
    expect(mockShopFindUnique).not.toHaveBeenCalled();
  });

  it("rejects JWT with wrong audience", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ aud: "wrong-app-key" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT with tampered signature", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ corruptSignature: true })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT signed with wrong secret", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ secret: "wrong-secret" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT with dest not matching myshopify.com", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ dest: "https://attacker.com" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects malformed Bearer token (not 3 parts)", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer not.valid" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when shop is not in database", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });
});

// ─── getShopFromRequest — cookie fallback ─────────────────────────────────────

describe("getShopFromRequest — cookie fallback", () => {
  it("resolves shop from shopify_session_shop cookie", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-2", shopDomain: "cookie-shop.myshopify.com" } as never);
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "shopify_session_shop=cookie-shop.myshopify.com" },
    });
    const result = await getShopFromRequest(req);
    expect(result?.shopId).toBe("shop-2");
    expect(result?.shopDomain).toBe("cookie-shop.myshopify.com");
  });

  it("rejects cookie domain that does not end in .myshopify.com", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "shopify_session_shop=attacker.com" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });
});

// ─── getShopFromRequest — X-Shop-Domain dev fallback ─────────────────────────

describe("getShopFromRequest — X-Shop-Domain fallback", () => {
  it("resolves shop from X-Shop-Domain header in non-production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-3", shopDomain: "dev-shop.myshopify.com" } as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { "x-shop-domain": "dev-shop.myshopify.com" },
    });
    const result = await getShopFromRequest(req);
    expect(result?.shopId).toBe("shop-3");
  });

  it("does not use X-Shop-Domain header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest("http://localhost/api/test", {
      headers: { "x-shop-domain": "dev-shop.myshopify.com" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
    expect(mockShopFindUnique).not.toHaveBeenCalled();
  });
});

// ─── withShopAuth ─────────────────────────────────────────────────────────────

describe("withShopAuth", () => {
  it("calls handler with shopId when auth succeeds", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    await withShopAuth(req, handler);
    expect(handler).toHaveBeenCalledWith("shop-1", "12345");
  });

  it("returns 401 when no valid auth", async () => {
    const req = makeRequest("http://localhost/api/test");
    const handler = vi.fn();
    const res = await withShopAuth(req, handler);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 404 when handler throws 'not found' error", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const handler = vi.fn().mockRejectedValue(new Error("Experiment not found"));
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const res = await withShopAuth(req, handler);
    expect(res.status).toBe(404);
  });

  it("returns 422 when handler throws validation error", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const handler = vi.fn().mockRejectedValue(new Error("Variant allocations must sum to 100%"));
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const res = await withShopAuth(req, handler);
    expect(res.status).toBe(422);
  });

  it("returns 500 for unexpected errors", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const handler = vi.fn().mockRejectedValue(new Error("Database connection failed"));
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const res = await withShopAuth(req, handler);
    expect(res.status).toBe(500);
  });

  it("never returns secrets in error body", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1", shopDomain: "test-shop.myshopify.com" } as never);
    const handler = vi.fn().mockRejectedValue(new Error(`Secret: ${TEST_API_SECRET}`));
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt()}` },
    });
    const res = await withShopAuth(req, handler);
    const body = await res.json() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain(TEST_API_SECRET);
  });
});

// ─── withRuntimeAuth ──────────────────────────────────────────────────────────

describe("withRuntimeAuth", () => {
  it("calls handler with shopDomain for valid shop", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1" } as never);
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const req = makeRequest("http://localhost/api/runtime/assign?shop=test-shop.myshopify.com");
    await withRuntimeAuth(req, handler);
    expect(handler).toHaveBeenCalledWith("test-shop.myshopify.com");
  });

  it("returns 400 when shop domain is missing", async () => {
    const req = makeRequest("http://localhost/api/runtime/assign");
    const handler = vi.fn();
    const res = await withRuntimeAuth(req, handler);
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 for unknown shop domain", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/runtime/assign?shop=unknown.myshopify.com");
    const handler = vi.fn();
    const res = await withRuntimeAuth(req, handler);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns benign 200 for bot user agents", async () => {
    const botAgents = [
      "Googlebot/2.1",
      "bingbot/2.0",
      "python-requests/2.28.0",
    ];
    for (const ua of botAgents) {
      const req = makeRequest("http://localhost/api/runtime/assign?shop=test.myshopify.com", {
        headers: { "user-agent": ua },
      });
      const res = await withRuntimeAuth(req, vi.fn());
      expect(res.status).toBe(200);
    }
  });

  it("rejects POST with content-length above 64KB", async () => {
    const req = makeRequest("http://localhost/api/runtime/events?shop=test.myshopify.com", {
      method: "POST",
      headers: { "content-length": String(65 * 1024 + 1) },
    });
    const res = await withRuntimeAuth(req, vi.fn());
    expect(res.status).toBe(413);
  });

  it("adds security headers to every response", async () => {
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-1" } as never);
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const req = makeRequest("http://localhost/api/runtime/assign?shop=test-shop.myshopify.com");
    const res = await withRuntimeAuth(req, handler);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("does not leak shop existence — returns 401 not 404 for unknown shop", async () => {
    mockShopFindUnique.mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/runtime/assign?shop=unknown.myshopify.com");
    const res = await withRuntimeAuth(req, vi.fn());
    // 401 not 404 — prevents enumeration of valid shop domains
    expect(res.status).toBe(401);
  });
});

// ─── getShopFromRequest — JWT structural edge cases ───────────────────────────

describe("getShopFromRequest — JWT structural edge cases", () => {
  it("rejects JWT with future nbf (token not yet valid)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ nbf: now + 3600 })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects token with non-base64url characters", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer !!!.!!!.!!!" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects empty Authorization header value", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: "" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT with only one segment (no dots)", async () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer onlyone" },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT where payload is valid base64 but not JSON", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const notJson = Buffer.from("this-is-not-json").toString("base64url");
    const sig = createHmac("sha256", TEST_API_SECRET).update(`${header}.${notJson}`).digest("base64url");
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${header}.${notJson}.${sig}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });

  it("rejects JWT missing the exp claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Manually build a JWT with no exp field
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "https://test-shop.myshopify.com/admin",
      dest: "https://test-shop.myshopify.com",
      aud: TEST_API_KEY,
      sub: "12345",
      nbf: now - 10,
      iat: now,
      jti: "test-jti",
      // exp intentionally omitted
    })).toString("base64url");
    const sig = createHmac("sha256", TEST_API_SECRET).update(`${header}.${payload}`).digest("base64url");
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${header}.${payload}.${sig}` },
    });
    const result = await getShopFromRequest(req);
    expect(result).toBeNull();
  });
});

// ─── getShopFromRequest — actorId from JWT sub claim ─────────────────────────

describe("getShopFromRequest — actorId from JWT sub claim", () => {
  const SHOP = { id: "shop-1", shopDomain: "test-shop.myshopify.com" };

  it("non-numeric sub passes through as-is (actorId = the string)", async () => {
    mockShopFindUnique.mockResolvedValueOnce(SHOP as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ sub: "abc" })}` },
    });
    const result = await getShopFromRequest(req);
    // Auth succeeds; actorId is the raw string value from sub
    expect(result).not.toBeNull();
    expect(result?.actorId).toBe("abc");
  });

  it("float sub passes through as-is (actorId = the float string)", async () => {
    mockShopFindUnique.mockResolvedValueOnce(SHOP as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ sub: "123.5" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result?.actorId).toBe("123.5");
  });

  it('sub === "0" maps to actorId undefined (surface-level token)', async () => {
    mockShopFindUnique.mockResolvedValueOnce(SHOP as never);
    const req = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${makeJwt({ sub: "0" })}` },
    });
    const result = await getShopFromRequest(req);
    expect(result?.actorId).toBeUndefined();
  });
});

// ─── Multi-tenant isolation ───────────────────────────────────────────────────

describe("multi-tenant isolation", () => {
  it("shop A cannot get shop B resources — resolves correct shopId per JWT", async () => {
    // Shop A JWT
    const jwtA = makeJwt({ dest: "https://shop-a.myshopify.com" });
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-id-a", shopDomain: "shop-a.myshopify.com" } as never);
    const reqA = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${jwtA}` },
    });
    const resultA = await getShopFromRequest(reqA);

    // Shop B JWT
    const jwtB = makeJwt({ dest: "https://shop-b.myshopify.com" });
    mockShopFindUnique.mockResolvedValueOnce({ id: "shop-id-b", shopDomain: "shop-b.myshopify.com" } as never);
    const reqB = makeRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${jwtB}` },
    });
    const resultB = await getShopFromRequest(reqB);

    expect(resultA?.shopId).toBe("shop-id-a");
    expect(resultB?.shopId).toBe("shop-id-b");
    expect(resultA?.shopId).not.toBe(resultB?.shopId);
  });
});
