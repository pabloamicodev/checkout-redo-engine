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
  const url = process.env.REDIS_URL;
  if (!url) {
    // During Next.js build time REDIS_URL is not set — return a placeholder.
    // The queue is never actually used at build time.
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null as null, enableOfflineQueue: false };
  }
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
  DAILY_METRIC_AGGREGATION: "ml-daily-metric-aggregation",
} as const;

// Lazy singleton — not instantiated at module load time (avoids Next.js build errors)
let _dailyMetricQueue: Queue<AggregationJobData, AggregationJobResult> | null = null;

export function getDailyMetricQueue(): Queue<AggregationJobData, AggregationJobResult> {
  if (!_dailyMetricQueue) {
    _dailyMetricQueue = new Queue<AggregationJobData, AggregationJobResult>(
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
  }
  return _dailyMetricQueue;
}

/** @deprecated Use getDailyMetricQueue() instead */
export const dailyMetricQueue = new Proxy({} as Queue<AggregationJobData, AggregationJobResult>, {
  get(_target, prop) {
    return getDailyMetricQueue()[prop as keyof Queue<AggregationJobData, AggregationJobResult>];
  },
});
