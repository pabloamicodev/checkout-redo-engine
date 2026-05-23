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
    console.log(
      `[aggregation-worker] job=${job.id} type=${triggerType} shop=${shopId} starting`
    );

    await job.updateProgress(0);
    const { processed } = await dailyMetricService.reAggregateShop(shopId);
    await job.updateProgress(100);

    console.log(
      `[aggregation-worker] job=${job.id} shop=${shopId} processed=${processed} experiments`
    );
    return { processed };
  },
  {
    connection: redisOpts(),
    concurrency: 2,
  }
);

worker.on("completed", (job, result) => {
  console.log(`[aggregation-worker] job=${job.id} completed processed=${result.processed}`);
});

worker.on("failed", (job, err) => {
  console.error(`[aggregation-worker] job=${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(`[aggregation-worker] worker error: ${err.message}`);
});

console.log("[aggregation-worker] started, waiting for jobs...");

async function shutdown() {
  console.log("[aggregation-worker] shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
