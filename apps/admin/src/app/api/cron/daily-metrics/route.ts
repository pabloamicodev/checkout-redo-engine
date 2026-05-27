/**
 * GET /api/cron/daily-metrics
 *
 * Called by Vercel Cron daily at 03:00 UTC (configured in vercel.json).
 * Re-aggregates DailyMetric rows for all active shops from raw events.
 *
 * GUARD: Protected by CRON_SECRET — returns 401 if missing or wrong.
 * GUARD: Idempotent — uses upsert so running twice produces the same result.
 * GUARD: Processes yesterday's date by default; accepts ?date=YYYY-MM-DD override.
 * GUARD: Processes shops in batches of 10 to avoid DB connection exhaustion.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { DailyMetricService } from "@/services/daily-metric.service";
import { logger } from "@/lib/logger";

const dailyMetricService = new DailyMetricService();
const BATCH_SIZE = 10;

export async function GET(request: NextRequest) {
  // GUARD: secret check — fails closed if CRON_SECRET is not set
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  // Default to yesterday in UTC
  const targetDate = dateParam
    ? new Date(dateParam)
    : (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      })();

  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  // Get all shops with active experiments
  const shops = await prisma.shop.findMany({
    where: {
      uninstalledAt: null,
      experiments: { some: { status: { in: ["RUNNING", "PAUSED"] } } },
    },
    select: { id: true, shopDomain: true },
  });

  let processed = 0;
  let errors = 0;

  type ShopRow = (typeof shops)[number];

  // Process in batches to limit concurrency
  for (let i = 0; i < shops.length; i += BATCH_SIZE) {
    const batch = shops.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (shop: ShopRow) => {
        try {
          await dailyMetricService.aggregateForDate(shop.id, targetDate);
          processed++;
        } catch (err) {
          errors++;
          Sentry.captureException(err, {
            tags: { cron: "daily-metrics", shopDomain: shop.shopDomain },
          });
          logger.error(
            "[Cron] Failed to aggregate metrics for shop",
            err instanceof Error ? err : undefined,
            { shopDomain: shop.shopDomain, date: targetDate.toISOString().split("T")[0] }
          );
        }
      })
    );
  }

  logger.info("[Cron] daily-metrics complete", {
    date: targetDate.toISOString().split("T")[0],
    shops: shops.length,
    processed,
    errors,
  });

  return NextResponse.json({
    ok: true,
    date: targetDate.toISOString().split("T")[0],
    shops: shops.length,
    processed,
    errors,
  });
}
