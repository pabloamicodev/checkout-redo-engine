import { vi } from "vitest";

// ── External infrastructure — never hit real services in unit/integration tests ──

vi.mock("@/lib/redis", () => ({
  cacheDelPattern: vi.fn().mockResolvedValue(undefined),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100, remaining: 99, resetAt: Date.now() + 60000 }),
  applyRateLimitHeaders: vi.fn(),
  RATE_LIMITS: { admin_api: {}, runtime_assign: {}, runtime_events: {} },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) => cb({})),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/services/audit-log.service", () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@/services/billing.service", () => ({
  BillingService: vi.fn().mockImplementation(() => ({
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, max: 100 }),
    getShopPlan: vi.fn().mockResolvedValue({ plan: "pro", isActive: true }),
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100, remaining: 99, resetAt: Date.now() + 60000 }),
  applyRateLimitHeaders: vi.fn(),
  RATE_LIMITS: {
    admin_api: { windowMs: 60000, max: 100 },
    runtime_assign: { windowMs: 60000, max: 500 },
    runtime_events: { windowMs: 60000, max: 200 },
  },
}));

// ── Failure scenario helpers ──────────────────────────────────────────────────
//
// Global mocks above always succeed. For failure scenarios, override per-test
// using mockRejectedValueOnce / mockResolvedValueOnce. Common recipes:
//
// Redis failure:
//   import { cacheGet } from "@/lib/redis";
//   vi.mocked(cacheGet).mockRejectedValueOnce(new Error("Redis ECONNREFUSED"));
//
// Rate limit exceeded:
//   import { checkRateLimit } from "@/lib/rate-limit";
//   vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, limit: 100, remaining: 0, resetAt: Date.now() + 60000 });
//
// Billing limit hit:
//   import { BillingService } from "@/services/billing.service";
//   vi.mocked(BillingService).mockImplementationOnce(() => ({
//     checkLimit: vi.fn().mockResolvedValue({ allowed: false, current: 10, max: 10 }),
//     getShopPlan: vi.fn().mockResolvedValue({ plan: "free", isActive: true }),
//   }));
//
// Audit log failure (fire-and-forget — should never block a request):
//   import { AuditLogService } from "@/services/audit-log.service";
//   vi.mocked(AuditLogService).mockImplementationOnce(() => ({
//     log: vi.fn().mockRejectedValue(new Error("Audit DB down")),
//   }));
