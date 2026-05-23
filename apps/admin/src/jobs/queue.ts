import { Queue } from "bullmq";

export interface AggregationJobData {
  shopId: string;
  triggerType: "scheduled" | "manual";
}

export interface AggregationJobResult {
  processed: number;
}

// BullMQ requires maxRetriesPerRequest: null on the ioredis connection
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

export const QUEUE_NAMES = {
  DAILY_METRIC_AGGREGATION: "ml:daily-metric-aggregation",
} as const;

export const dailyMetricQueue = new Queue<AggregationJobData, AggregationJobResult>(
  QUEUE_NAMES.DAILY_METRIC_AGGREGATION,
  {
    connection: redisOpts(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
    },
  }
);
