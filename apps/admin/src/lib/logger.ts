/**
 * Structured production logger for MarginLab admin.
 *
 * In development (or when AXIOM_TOKEN is not set):
 *   → writes formatted JSON to console.
 *
 * In production (AXIOM_TOKEN + AXIOM_DATASET present):
 *   → ships logs to Axiom via their Ingest REST API.
 *   → batches up to 100 events or 2 s, whichever comes first.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Experiment created", { experimentId, shopId });
 *   logger.warn("Plan limit approached", { shopId, used, limit });
 *   logger.error("Webhook processing failed", error, { topic, shopId });
 */

import { getRequestCtx } from "@/lib/request-context";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

interface AxiomEvent {
  _time: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  request_id?: string;
  shop_id?: string;
  shop_domain?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Axiom batch sender
// ---------------------------------------------------------------------------

const AXIOM_DATASET = process.env.AXIOM_DATASET ?? "marginlab";
const AXIOM_TOKEN = process.env.AXIOM_TOKEN ?? "";
const AXIOM_INGEST_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 2000;

let batch: AxiomEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch(): Promise<void> {
  if (batch.length === 0) return;

  const events = batch.splice(0, batch.length);

  try {
    await fetch(AXIOM_INGEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(events),
    });
  } catch {
    // Swallow — logger must never throw
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBatch();
  }, FLUSH_INTERVAL_MS);
}

function sendToAxiom(event: AxiomEvent): void {
  batch.push(event);
  if (batch.length >= BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushBatch();
  } else {
    scheduleFlush();
  }
}

// ---------------------------------------------------------------------------
// Core log function
// ---------------------------------------------------------------------------

const SERVICE = "marginlab-admin";
const ENV = process.env.NODE_ENV ?? "development";
const IS_PRODUCTION = ENV === "production";
const USE_AXIOM = IS_PRODUCTION && Boolean(AXIOM_TOKEN);

function log(
  level: LogLevel,
  message: string,
  errorOrMeta?: Error | LogMeta | null,
  extraMeta?: LogMeta
): void {
  // Separate Error from plain meta
  let err: Error | undefined;
  let meta: LogMeta = {};

  if (errorOrMeta instanceof Error) {
    err = errorOrMeta;
    meta = extraMeta ?? {};
  } else if (errorOrMeta && typeof errorOrMeta === "object") {
    meta = errorOrMeta;
  }

  const reqCtx = getRequestCtx();

  const event: AxiomEvent = {
    _time: new Date().toISOString(),
    level,
    message,
    service: SERVICE,
    environment: ENV,
    ...(reqCtx?.requestId ? { request_id: reqCtx.requestId } : {}),
    ...(reqCtx?.shopId ? { shop_id: reqCtx.shopId } : {}),
    ...(reqCtx?.shopDomain ? { shop_domain: reqCtx.shopDomain } : {}),
    ...meta,
    ...(err
      ? {
          error_name: err.name,
          error_message: err.message,
          error_stack: err.stack,
        }
      : {}),
  };

  if (USE_AXIOM) {
    sendToAxiom(event);
    return;
  }

  // Development: pretty console output
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  consoleFn(JSON.stringify(event, null, 2));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    log("debug", message, meta);
  },

  info(message: string, meta?: LogMeta): void {
    log("info", message, meta);
  },

  warn(message: string, meta?: LogMeta): void {
    log("warn", message, meta);
  },

  error(message: string, error?: Error | null, meta?: LogMeta): void {
    log("error", message, error, meta);
  },

  /** Force-flush the Axiom batch. Call in graceful-shutdown hooks. */
  async flush(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flushBatch();
  },
};
