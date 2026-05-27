import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// Cache helpers
export const CACHE_TTL = {
  RUNTIME_CONFIG: 30,       // 30 seconds — experiments update infrequently
  EXPERIMENT_LIST: 60,      // 1 minute
  ANALYTICS_DAILY: 300,     // 5 minutes
  ASSIGNMENT: 3600 * 24,    // 24 hours
} as const;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Cache failures are non-fatal
  }
}
