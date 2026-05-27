/**
 * GET /api/cron/retention-cleanup
 *
 * Called by Vercel Cron weekly at 04:00 UTC Sunday (configured in vercel.json).
 * Purges raw Event and ExperimentAssignment rows older than the retention window.
 * DailyMetric aggregates are kept indefinitely — only raw telemetry is pruned.
 *
 * GUARD: Protected by CRON_SECRET.
 * GUARD: Accepts ?retentionDays=N override (default 90).
 * GUARD: Processes in batches to avoid locking the table for too long.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DEFAULT_RETENTION_DAYS = 90;
const BATCH_SIZE = 5_000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const retentionDays = Number(searchParams.get("retentionDays") ?? DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    return NextResponse.json({ error: "Invalid retentionDays" }, { status: 400 });
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

  let eventsDeleted = 0;
  let assignmentsDeleted = 0;

  try {
    // Delete raw events in batches
    while (true) {
      const ids = await prisma.event.findMany({
        where: { occurredAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (ids.length === 0) break;
      const { count } = await prisma.event.deleteMany({
        where: { id: { in: ids.map((r) => r.id) } },
      });
      eventsDeleted += count;
      if (ids.length < BATCH_SIZE) break;
    }

    // Delete stale assignments (visitors whose assignment is older than retention window)
    while (true) {
      const ids = await prisma.experimentAssignment.findMany({
        where: { firstSeenAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (ids.length === 0) break;
      const { count } = await prisma.experimentAssignment.deleteMany({
        where: { id: { in: ids.map((r) => r.id) } },
      });
      assignmentsDeleted += count;
      if (ids.length < BATCH_SIZE) break;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: "retention-cleanup" } });
    logger.error("[Cron] retention-cleanup failed", err instanceof Error ? err : undefined, {
      cutoff: cutoff.toISOString(),
      retentionDays,
      eventsDeleted,
      assignmentsDeleted,
    });
    return NextResponse.json({ error: "Retention cleanup failed" }, { status: 500 });
  }

  logger.info("[Cron] retention-cleanup complete", {
    cutoff: cutoff.toISOString(),
    retentionDays,
    eventsDeleted,
    assignmentsDeleted,
  });

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    retentionDays,
    eventsDeleted,
    assignmentsDeleted,
  });
}
