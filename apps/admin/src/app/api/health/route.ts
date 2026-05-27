import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const VERSION = process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0";

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB ping
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks["db"] = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks["db"] = { ok: false, error: err instanceof Error ? err.message : "DB ping failed" };
  }

  // Redis ping
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks["redis"] = { ok: true, latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks["redis"] = { ok: false, error: err instanceof Error ? err.message : "Redis ping failed" };
  }

  // Shopify API reachability — lightweight check against Shopify status page
  const shopifyStart = Date.now();
  try {
    const res = await fetch("https://www.shopifystatus.com/api/v2/status.json", {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { status?: { indicator?: string } };
    const indicator = data?.status?.indicator ?? "unknown";
    checks["shopify_api"] = {
      ok: indicator === "none",
      latencyMs: Date.now() - shopifyStart,
      ...(indicator !== "none" ? { error: `Shopify status: ${indicator}` } : {}),
    };
  } catch (err) {
    checks["shopify_api"] = {
      ok: false,
      latencyMs: Date.now() - shopifyStart,
      error: err instanceof Error ? err.message : "Shopify API unreachable",
    };
  }

  // Env var presence check (no values exposed)
  const requiredEnvs = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "ENCRYPTION_KEY", "HOST", "CRON_SECRET", "RESEND_API_KEY"];
  const missingEnvs = requiredEnvs.filter((k) => !process.env[k]);
  checks["env"] = {
    ok: missingEnvs.length === 0,
    ...(missingEnvs.length > 0 ? { error: `Missing: ${missingEnvs.join(", ")}` } : {}),
  };

  // Redis is optional — treat it as a warning, not a hard failure
  const criticalChecks = Object.entries(checks)
    .filter(([key]) => key !== "redis")
    .every(([, c]) => c.ok);
  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? "ok" : criticalChecks ? "degraded" : "unhealthy";

  return NextResponse.json(
    {
      status,
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: status === "unhealthy" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
