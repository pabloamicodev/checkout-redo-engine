/**
 * Standalone BullMQ worker — run with:
 *   tsx src/jobs/aggregation.worker.ts
 * from the apps/admin directory.
 *
 * Processes daily-metric-aggregation jobs: calls reAggregateShop()
 * to rebuild DailyMetric rows from raw events. Self-healing — safe to
 * run concurrently with real-time EventIngestionService increments
 * because batch mode overwrites from COUNT aggregates, not prior values.
 */

import { Worker } from "bullmq";
import { DailyMetricService } from "@/services/daily-metric.service";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import {
  QUEUE_NAMES,
  type AggregationJobData,
  type AggregationJobResult,
} from "./queue";

const dailyMetricService = new DailyMetricService();

function redisOpts() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "6379", 10),
    password: u.password || undefined,
    db: parseInt(u.pathname.replace("/", "") || "0", 10),
    maxRetriesPerRequest: null as null,
    enableOfflineQueue: false,
  };
}

const worker = new Worker<AggregationJobData, AggregationJobResult>(
  QUEUE_NAMES.DAILY_METRIC_AGGREGATION,
  async (job) => {
    const { shopId, triggerType } = job.data;
    logger.info("[aggregation-worker] job starting", { jobId: job.id, triggerType, shopId });

    await job.updateProgress(0);
    const { processed } = await dailyMetricService.reAggregateShop(shopId);
    await job.updateProgress(100);

    logger.info("[aggregation-worker] job processed", { jobId: job.id, shopId, processed });
    return { processed };
  },
  {
    connection: redisOpts(),
    concurrency: 2,
    stalledInterval: 30_000,
    lockDuration: 60_000,
  }
);

worker.on("completed", (job, result) => {
  logger.info("[aggregation-worker] job completed", { jobId: job.id, processed: result.processed });
});

worker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { jobId: job?.id, worker: "aggregation" } });
  logger.error("[aggregation-worker] job failed", err, { jobId: job?.id });
});

worker.on("error", (err) => {
  Sentry.captureException(err, { tags: { worker: "aggregation" } });
  logger.error("[aggregation-worker] worker error", err);
});

logger.info("[aggregation-worker] started, waiting for jobs");

async function shutdown() {
  logger.info("[aggregation-worker] shutting down");
  const forceExit = setTimeout(() => {
    logger.warn("[aggregation-worker] shutdown timeout — forcing exit");
    process.exit(1);
  }, 15_000);
  await logger.flush();
  await worker.close();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
