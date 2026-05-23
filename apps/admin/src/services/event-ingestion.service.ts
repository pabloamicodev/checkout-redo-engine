import { prisma } from "@/lib/prisma";
import { chunk } from "@/lib/utils";
import { redis } from "@/lib/redis";
import { DailyMetricService } from "./daily-metric.service";
import type { z } from "zod";
import type { RuntimeEventSchema } from "@/lib/zod-schemas";

type EventBatch = z.infer<typeof RuntimeEventSchema>;

const VALID_EVENT_TYPES = new Set([
  "PAGE_VIEW", "PRODUCT_VIEW", "COLLECTION_VIEW", "SEARCH",
  "ADD_TO_CART", "REMOVE_FROM_CART", "CART_VIEW",
  "CHECKOUT_STARTED", "CHECKOUT_STEP_VIEWED", "PAYMENT_INFO_SUBMITTED",
  "CHECKOUT_COMPLETED", "CUSTOM", "CHECKOUT_BLOCK_RENDERED",
  "OFFER_VIEWED", "OFFER_CLAIMED", "PRICE_VIEWED",
]);

// In-process cache of registered custom event names (per shop).
// Refreshed on first use and on any validation miss to avoid repeated DB hits.
const customEventCache = new Map<string, Set<string>>();
const CUSTOM_EVENT_CACHE_TTL_MS = 60_000;
const customEventCacheTimestamps = new Map<string, number>();

async function getRegisteredCustomEvents(shopId: string): Promise<Set<string>> {
  const now = Date.now();
  const ts = customEventCacheTimestamps.get(shopId) ?? 0;
  if (customEventCache.has(shopId) && now - ts < CUSTOM_EVENT_CACHE_TTL_MS) {
    return customEventCache.get(shopId)!;
  }
  const events = await prisma.customEvent.findMany({
    where: { shopId },
    select: { name: true },
  });
  const names = new Set(events.map((e: (typeof events)[number]) => e.name));
  customEventCache.set(shopId, names);
  customEventCacheTimestamps.set(shopId, now);
  return names;
}

// Events that contribute to funnel metrics in DailyMetric
const FUNNEL_EVENTS: Record<string, keyof FunnelFlags> = {
  PAGE_VIEW: "pageView",
  PRODUCT_VIEW: "productView",
  ADD_TO_CART: "addToCart",
  CHECKOUT_STARTED: "checkoutStarted",
};

interface FunnelFlags {
  pageView?: boolean;
  productView?: boolean;
  addToCart?: boolean;
  checkoutStarted?: boolean;
}

const dailyMetricService = new DailyMetricService();

export class EventIngestionService {
  async ingest(shopId: string, batch: EventBatch): Promise<{ warnings?: string[] }> {
    // -------------------------------------------------------------------
    // 1. Build event rows for DB insert
    // -------------------------------------------------------------------
    const warnings: string[] = [];

    // GUARD: validate CUSTOM events against registered names.
    // Non-blocking — unregistered events are still ingested but a warning is returned
    // so the caller (API route) can surface it in the response for debugging.
    const customEventNames = batch.events
      .filter((e) => e.eventType.toUpperCase() === "CUSTOM")
      .map((e) => e.eventName);

    if (customEventNames.length > 0) {
      const registered = await getRegisteredCustomEvents(shopId);
      for (const name of customEventNames) {
        if (!registered.has(name)) {
          warnings.push(`Unregistered custom event: "${name}". Register it at /custom-events to track metrics.`);
        }
      }
    }

    const events = batch.events.map((e) => {
      const eventType = VALID_EVENT_TYPES.has(e.eventType.toUpperCase())
        ? e.eventType.toUpperCase()
        : "CUSTOM";

      return {
        shopId,
        experimentId: e.experimentId ?? null,
        variantId: e.variantId ?? null,
        personalizationId: e.personalizationId ?? null,
        visitorId: batch.visitorId,
        sessionId: batch.sessionId ?? null,
        eventName: e.eventName,
        eventType: eventType as never,
        url: e.url ?? null,
        path: e.path ?? null,
        referrer: e.referrer ?? null,
        deviceType: e.deviceType ?? null,
        country: e.country ?? null,
        currency: e.currency ?? null,
        utmSource: e.utmSource ?? null,
        utmMedium: e.utmMedium ?? null,
        utmCampaign: e.utmCampaign ?? null,
        utmContent: e.utmContent ?? null,
        utmTerm: e.utmTerm ?? null,
        metadata: (e.metadata ?? {}) as never,
        occurredAt: new Date(e.occurredAt),
        receivedAt: new Date(),
      };
    });

    // -------------------------------------------------------------------
    // 2. Batch insert (skip duplicates)
    // -------------------------------------------------------------------
    const chunks = chunk(events, 100);
    for (const chunkBatch of chunks) {
      await prisma.event.createMany({
        data: chunkBatch,
        skipDuplicates: true,
      });
    }

    // -------------------------------------------------------------------
    // 3. Update assignment lastSeenAt
    // -------------------------------------------------------------------
    const experimentIds = [
      ...new Set(
        batch.events
          .filter((e) => e.experimentId)
          .map((e) => e.experimentId!)
      ),
    ];

    if (experimentIds.length > 0) {
      await prisma.experimentAssignment.updateMany({
        where: {
          shopId,
          experimentId: { in: experimentIds },
          visitorId: batch.visitorId,
        },
        data: {
          lastSeenAt: new Date(),
          ...(batch.sessionId ? { sessionId: batch.sessionId } : {}),
        },
      });
    }

    // -------------------------------------------------------------------
    // 4. Real-time DailyMetric updates
    //
    // GUARD: Only update if event has experimentId + variantId
    // GUARD: Unique visitor/session tracked via Redis SET (per experiment per day)
    //        to avoid double-counting on multiple events from same visitor
    // -------------------------------------------------------------------
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]!;

    // Group events by experiment+variant for batch DailyMetric updates
    type ExperimentVariantKey = `${string}:${string}`;
    const groupedFunnel = new Map<ExperimentVariantKey, FunnelFlags>();

    for (const event of batch.events) {
      if (!event.experimentId || !event.variantId) continue;

      const eventType = VALID_EVENT_TYPES.has(event.eventType.toUpperCase())
        ? event.eventType.toUpperCase()
        : "CUSTOM";

      const funnelKey = FUNNEL_EVENTS[eventType];
      if (!funnelKey) continue;

      const key: ExperimentVariantKey = `${event.experimentId}:${event.variantId}`;
      const existing = groupedFunnel.get(key) ?? {};
      existing[funnelKey] = true;
      groupedFunnel.set(key, existing);
    }

    for (const [key, flags] of groupedFunnel) {
      const [experimentId, variantId] = key.split(":") as [string, string];

      // Check unique visitor for this experiment+day via Redis
      const visitorRedisKey = `ml:uv:${shopId}:${experimentId}:${variantId}:${todayStr}`;
      const sessionRedisKey = `ml:us:${shopId}:${experimentId}:${variantId}:${todayStr}`;

      let isNewVisitor = false;
      let isNewSession = false;

      try {
        // SADD returns 1 if it was a new member, 0 if already existed
        const addedVisitor = await redis.sadd(visitorRedisKey, batch.visitorId);
        isNewVisitor = addedVisitor === 1;

        // Set TTL to 48h so Redis doesn't grow forever
        if (isNewVisitor) {
          await redis.expire(visitorRedisKey, 48 * 3600);
        }

        if (batch.sessionId) {
          const addedSession = await redis.sadd(sessionRedisKey, batch.sessionId);
          isNewSession = addedSession === 1;
          if (isNewSession) {
            await redis.expire(sessionRedisKey, 48 * 3600);
          }
        }
      } catch {
        // Redis failure is non-fatal — fall back to always counting
        // (slight over-count, corrected by hourly batch aggregation)
        isNewVisitor = true;
        isNewSession = !!batch.sessionId;
      }

      await dailyMetricService.incrementFromEvent({
        shopId,
        experimentId,
        variantId,
        date: today,
        newVisitor: isNewVisitor,
        newSession: isNewSession,
        pageView: flags.pageView,
        productView: flags.productView,
        addToCart: flags.addToCart,
        checkoutStarted: flags.checkoutStarted,
      });
    }

    return warnings.length > 0 ? { warnings } : {};
  }

  async getRecentEvents(
    shopId: string,
    filters: {
      experimentId?: string;
      visitorId?: string;
      eventType?: string;
      limit?: number;
    }
  ) {
    return prisma.event.findMany({
      where: {
        shopId,
        ...(filters.experimentId ? { experimentId: filters.experimentId } : {}),
        ...(filters.visitorId ? { visitorId: filters.visitorId } : {}),
        ...(filters.eventType ? { eventType: filters.eventType as never } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: filters.limit ?? 100,
    });
  }
}
