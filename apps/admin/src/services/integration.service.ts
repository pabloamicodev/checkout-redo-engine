/**
 * IntegrationService — manages outbound integrations and webhook delivery.
 *
 * Supported integrations: GA4, Klaviyo, Microsoft Clarity, Heap, Segment, Elevar.
 * Outbound webhooks: signed (HMAC-SHA256), retried up to 5 times with exponential backoff.
 * Slack alerts: experiment_started, experiment_completed, winner_found — rate-limited 1/hour/experiment.
 *
 * Guards:
 *  - GUARD: outbound webhooks time out after 5 seconds
 *  - GUARD: webhook signing with HMAC-SHA256 of the raw JSON payload
 *  - GUARD: retry with exponential backoff (delays: 5s, 25s, 125s, 625s, 3125s)
 *  - GUARD: Slack rate limit — 1 alert per experiment per event type per hour (Redis key with TTL)
 *  - GUARD: never block the ingestion pipeline — all delivery runs fire-and-forget
 */

import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Local string-union types (mirrors Prisma enums — avoids @prisma/client
// dependency before `prisma generate` runs in CI/sandbox environments)
// ---------------------------------------------------------------------------
type IntegrationProvider = "GA4" | "KLAVIYO" | "CLARITY" | "HEAP" | "SEGMENT" | "ELEVAR" | "SLACK" | "WEBHOOK" | "RECHARGE";
type IntegrationStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationType =
  | "GA4"
  | "KLAVIYO"
  | "CLARITY"
  | "HEAP"
  | "SEGMENT"
  | "ELEVAR"
  | "SLACK"
  | "OUTBOUND_WEBHOOK";

/** Shape the UI/client components expect for an integration record. */
export interface IntegrationRecord {
  id: string;
  type: IntegrationType;
  enabled: boolean;
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryPayload {
  event: string;
  experimentId?: string;
  variantId?: string;
  shopDomain: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Map UI IntegrationType → Prisma IntegrationProvider
const TYPE_TO_PROVIDER: Record<IntegrationType, IntegrationProvider> = {
  GA4: "GA4",
  KLAVIYO: "KLAVIYO",
  CLARITY: "CLARITY",
  HEAP: "HEAP",
  SEGMENT: "SEGMENT",
  ELEVAR: "ELEVAR",
  SLACK: "SLACK",
  OUTBOUND_WEBHOOK: "WEBHOOK",
};

// Map Prisma IntegrationProvider → UI IntegrationType
const PROVIDER_TO_TYPE: Partial<Record<IntegrationProvider, IntegrationType>> = {
  GA4: "GA4",
  KLAVIYO: "KLAVIYO",
  CLARITY: "CLARITY",
  HEAP: "HEAP",
  SEGMENT: "SEGMENT",
  ELEVAR: "ELEVAR",
  SLACK: "SLACK",
  WEBHOOK: "OUTBOUND_WEBHOOK",
};

const RETRY_DELAYS_MS = [5_000, 25_000, 125_000, 625_000, 3_125_000];
const WEBHOOK_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// IntegrationService
// ---------------------------------------------------------------------------

export class IntegrationService {
  // ---------------------------------------------------------------------------
  // CRUD for Integration records
  // ---------------------------------------------------------------------------

  async list(shopId: string): Promise<IntegrationRecord[]> {
    const rows = await prisma.integration.findMany({
      where: { shopId },
      orderBy: { provider: "asc" },
      select: {
        id: true,
        provider: true,
        status: true,
        configEncrypted: true,
        publicConfig: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((r: (typeof rows)[number]) => this.toRecord(r));
  }

  async get(shopId: string, id: string) {
    const integration = await prisma.integration.findFirst({
      where: { id, shopId },
    });
    if (!integration) throw new Error(`Integration not found: ${id}`);
    return integration;
  }

  async upsert(
    shopId: string,
    type: IntegrationType,
    payload: { enabled: boolean; credentials: Record<string, string>; settings: Record<string, unknown> }
  ) {
    const provider = TYPE_TO_PROVIDER[type];
    const status: IntegrationStatus = payload.enabled ? "CONNECTED" : "DISCONNECTED";
    const configEncrypted = JSON.stringify(payload.credentials);

    const existing = await prisma.integration.findUnique({
      where: { shopId_provider: { shopId, provider } },
    });

    if (existing) {
      return prisma.integration.update({
        where: { id: existing.id },
        data: {
          status,
          configEncrypted,
          publicConfig: payload.settings as never,
        },
      });
    }
    return prisma.integration.create({
      data: {
        shopId,
        provider,
        status,
        configEncrypted,
        publicConfig: payload.settings as never,
      },
    });
  }

  async delete(shopId: string, id: string): Promise<void> {
    await this.get(shopId, id);
    await prisma.integration.delete({ where: { id } });
  }

  async testConnection(shopId: string, id: string): Promise<{ ok: boolean; error?: string }> {
    const integration = await this.get(shopId, id);
    const creds = this.decodeCreds(integration.configEncrypted);

    try {
      switch (integration.provider) {
        case "GA4":
          return this.testGA4(creds);
        case "KLAVIYO":
          return this.testKlaviyo(creds);
        case "CLARITY":
          return this.testClarity(creds);
        case "HEAP":
          return this.testHeap(creds);
        case "SEGMENT":
          return this.testSegment(creds);
        case "ELEVAR":
          return this.testElevar(creds);
        case "SLACK":
          return this.testSlack(creds);
        case "WEBHOOK":
          return this.testWebhook(creds, integration.publicConfig as Record<string, unknown>);
        default:
          return { ok: true };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  // ---------------------------------------------------------------------------
  // Event dispatch — called from EventIngestionService for each event
  // ---------------------------------------------------------------------------

  async dispatchToIntegrations(
    shopId: string,
    shopDomain: string,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const integrations = await prisma.integration.findMany({
      where: { shopId, status: "CONNECTED" },
    });

    for (const integration of integrations) {
      const creds = this.decodeCreds(integration.configEncrypted);
      const settings = integration.publicConfig as Record<string, unknown>;

      switch (integration.provider) {
        case "GA4":
          void this.sendToGA4(creds, payload).catch(() => {});
          break;
        case "KLAVIYO":
          void this.sendToKlaviyo(creds, payload).catch(() => {});
          break;
        case "HEAP":
          void this.sendToHeap(creds, payload).catch(() => {});
          break;
        case "SEGMENT":
          void this.sendToSegment(creds, payload).catch(() => {});
          break;
        case "ELEVAR":
          void this.sendToElevar(creds, payload).catch(() => {});
          break;
        case "WEBHOOK":
          void this.deliverWebhookWithRetry(integration.id, creds, settings, payload, 0).catch(() => {});
          break;
        case "SLACK":
          void this.sendSlackAlert(creds, payload, shopId).catch(() => {});
          break;
        // CLARITY: data enrichment is client-side only via the Clarity JS snippet
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toRecord(row: {
    id: string;
    provider: IntegrationProvider;
    status: IntegrationStatus;
    configEncrypted: string | null;
    publicConfig: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): IntegrationRecord {
    return {
      id: row.id,
      type: PROVIDER_TO_TYPE[row.provider] ?? "GA4",
      enabled: row.status === "CONNECTED",
      credentials: this.decodeCreds(row.configEncrypted),
      settings: (row.publicConfig as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private decodeCreds(encoded: string | null): Record<string, string> {
    if (!encoded) return {};
    try {
      return JSON.parse(encoded) as Record<string, string>;
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // GA4
  // ---------------------------------------------------------------------------

  private async sendToGA4(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const { measurementId, apiSecret } = creds;
    if (!measurementId || !apiSecret) return;

    await fetchWithTimeout(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: payload.data["visitorId"] ?? "unknown",
          events: [
            {
              name: "experiment_impression",
              params: {
                experiment_id: payload.experimentId ?? "",
                variant_id: payload.variantId ?? "",
                event_label: payload.event,
                engagement_time_msec: 1,
              },
            },
          ],
        }),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private async testGA4(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["measurementId"] || !creds["apiSecret"]) {
      return { ok: false, error: "Missing Measurement ID or API Secret" };
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Klaviyo
  // ---------------------------------------------------------------------------

  private async sendToKlaviyo(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const { apiKey } = creds;
    if (!apiKey) return;

    const customerId = payload.data["customerId"] as string | undefined;
    if (!customerId) return;

    await fetchWithTimeout(
      "https://a.klaviyo.com/api/profile-import/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: "2024-10-15",
        },
        body: JSON.stringify({
          data: {
            type: "profile",
            attributes: {
              properties: {
                [`ml_exp_${payload.experimentId}`]: payload.variantId,
                ml_last_experiment: payload.experimentId,
              },
            },
          },
        }),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private async testKlaviyo(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["apiKey"]) return { ok: false, error: "Missing API key" };
    const res = await fetchWithTimeout(
      "https://a.klaviyo.com/api/accounts/",
      { headers: { Authorization: `Klaviyo-API-Key ${creds["apiKey"]}`, revision: "2024-10-15" } },
      WEBHOOK_TIMEOUT_MS
    );
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  }

  // ---------------------------------------------------------------------------
  // Microsoft Clarity — client-side snippet only; server validates Project ID
  // ---------------------------------------------------------------------------

  private async testClarity(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    const { projectId } = creds;
    if (!projectId) return { ok: false, error: "Microsoft Clarity Project ID is required" };
    if (!/^[a-z0-9]{8,24}$/i.test(projectId)) {
      return { ok: false, error: "Invalid Clarity Project ID format" };
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Heap — server-side HTTP Track API
  // ---------------------------------------------------------------------------

  private async sendToHeap(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const { appId } = creds;
    if (!appId) return;

    const identity =
      (payload.data["customerId"] as string | undefined) ??
      (payload.data["visitorId"] as string | undefined);
    if (!identity) return;

    await fetchWithTimeout(
      "https://heapanalytics.com/api/track",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          identity,
          event: payload.event,
          timestamp: payload.timestamp,
          properties: {
            experiment_id: payload.experimentId ?? null,
            variant_id: payload.variantId ?? null,
            shop_domain: payload.shopDomain,
            ...payload.data,
          },
        }),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private async testHeap(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["appId"]) return { ok: false, error: "Heap App ID is required" };
    if (!/^\d+$/.test(creds["appId"])) return { ok: false, error: "Heap App ID must be numeric" };
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Segment — HTTP Track API (Write Key, Basic Auth)
  // ---------------------------------------------------------------------------

  private async sendToSegment(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const { writeKey } = creds;
    if (!writeKey) return;

    const userId = payload.data["customerId"] as string | undefined;
    const anonymousId = payload.data["visitorId"] as string | undefined;
    if (!userId && !anonymousId) return;

    const body: Record<string, unknown> = {
      event: payload.event,
      timestamp: payload.timestamp,
      properties: {
        experiment_id: payload.experimentId ?? null,
        variant_id: payload.variantId ?? null,
        shop_domain: payload.shopDomain,
        ...payload.data,
      },
      context: { app: { name: "MarginLab" } },
    };
    if (userId) body["userId"] = userId;
    if (anonymousId) body["anonymousId"] = anonymousId;

    await fetchWithTimeout(
      "https://api.segment.io/v1/track",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${writeKey}:`).toString("base64")}`,
        },
        body: JSON.stringify(body),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private async testSegment(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["writeKey"]) return { ok: false, error: "Segment Write Key is required" };
    try {
      const res = await fetchWithTimeout(
        "https://api.segment.io/v1/track",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${creds["writeKey"]}:`).toString("base64")}`,
          },
          body: JSON.stringify({
            anonymousId: "marginlab-connection-test",
            event: "connection_test",
            timestamp: new Date().toISOString(),
            properties: { source: "MarginLab" },
          }),
        },
        WEBHOOK_TIMEOUT_MS
      );
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
    }
  }

  // ---------------------------------------------------------------------------
  // Elevar — server-side GTM container (GA4-compatible payload format)
  // ---------------------------------------------------------------------------

  private async sendToElevar(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload
  ): Promise<void> {
    const { containerUrl } = creds;
    if (!containerUrl) return;

    const base = containerUrl.replace(/\/$/, "");
    await fetchWithTimeout(
      `${base}/g/collect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: (payload.data["visitorId"] as string | undefined) ?? "unknown",
          events: [
            {
              name: payload.event,
              params: {
                experiment_id: payload.experimentId ?? null,
                variant_id: payload.variantId ?? null,
                shop_domain: payload.shopDomain,
                engagement_time_msec: 1,
              },
            },
          ],
        }),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private async testElevar(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["containerUrl"]) return { ok: false, error: "Elevar Server Container URL is required" };
    try {
      new URL(creds["containerUrl"]);
    } catch {
      return { ok: false, error: "Invalid container URL" };
    }
    try {
      const base = creds["containerUrl"].replace(/\/$/, "");
      const res = await fetchWithTimeout(`${base}/healthz`, { method: "GET" }, WEBHOOK_TIMEOUT_MS);
      return res.status < 500 ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Container URL not reachable" };
    }
  }

  // ---------------------------------------------------------------------------
  // Outbound webhooks with retry + signing
  // ---------------------------------------------------------------------------

  private async deliverWebhookWithRetry(
    integrationId: string,
    creds: Record<string, string>,
    settings: Record<string, unknown>,
    payload: WebhookDeliveryPayload,
    attempt: number
  ): Promise<void> {
    const { url, secret } = creds;
    if (!url) return;

    const body = JSON.stringify(payload);
    const signature = secret
      ? createHmac("sha256", secret).update(body).digest("hex")
      : undefined;

    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MarginLab-Signature": signature ?? "",
            "X-MarginLab-Event": payload.event,
            "X-MarginLab-Timestamp": payload.timestamp,
          },
          body,
        },
        WEBHOOK_TIMEOUT_MS
      );

      if (!res.ok && attempt < RETRY_DELAYS_MS.length - 1) {
        await delay(RETRY_DELAYS_MS[attempt] ?? 5000);
        return this.deliverWebhookWithRetry(integrationId, creds, settings, payload, attempt + 1);
      }
    } catch (_) {
      if (attempt < RETRY_DELAYS_MS.length - 1) {
        await delay(RETRY_DELAYS_MS[attempt] ?? 5000);
        return this.deliverWebhookWithRetry(integrationId, creds, settings, payload, attempt + 1);
      }
    }
  }

  private async testWebhook(
    creds: Record<string, string>,
    _settings: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string }> {
    if (!creds["url"]) return { ok: false, error: "Webhook URL is required" };
    try {
      new URL(creds["url"]);
    } catch {
      return { ok: false, error: "Invalid webhook URL" };
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Slack alerts — rate-limited 1/experiment/event-type/hour
  // ---------------------------------------------------------------------------

  private async sendSlackAlert(
    creds: Record<string, string>,
    payload: WebhookDeliveryPayload,
    shopId: string
  ): Promise<void> {
    const { webhookUrl } = creds;
    if (!webhookUrl) return;

    const alertableEvents = ["experiment_started", "experiment_completed", "winner_found"];
    if (!alertableEvents.includes(payload.event)) return;

    const rateLimitKey = `ml:slack:${shopId}:${payload.experimentId}:${payload.event}`;
    try {
      const { redis } = await import("@/lib/redis");
      const alreadySent = await redis.get(rateLimitKey);
      if (alreadySent) return;
      await redis.set(rateLimitKey, "1", "EX", 3600);
    } catch {
      // Redis not available — send anyway
    }

    const text = this.buildSlackMessage(payload);
    await fetchWithTimeout(
      webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
      WEBHOOK_TIMEOUT_MS
    );
  }

  private buildSlackMessage(payload: WebhookDeliveryPayload): string {
    switch (payload.event) {
      case "experiment_started":
        return `🚀 *Experiment started*: ${payload.data["experimentName"] ?? payload.experimentId}`;
      case "experiment_completed":
        return `✅ *Experiment completed*: ${payload.data["experimentName"] ?? payload.experimentId}`;
      case "winner_found":
        return `🏆 *Winner found* in ${payload.data["experimentName"] ?? payload.experimentId}: variant *${String(payload.data["winnerVariantKey"])}* — ${String(payload.data["lift"] ?? "")}% lift`;
      default:
        return `MarginLab event: ${payload.event}`;
    }
  }

  private async testSlack(creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    if (!creds["webhookUrl"]) return { ok: false, error: "Slack Webhook URL is required" };
    try {
      const res = await fetchWithTimeout(
        creds["webhookUrl"],
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "✅ MarginLab integration test — this is a test message." }),
        },
        WEBHOOK_TIMEOUT_MS
      );
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
