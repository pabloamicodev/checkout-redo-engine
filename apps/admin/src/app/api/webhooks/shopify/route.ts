import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateWebhook } from "@/lib/shopify";
import { prisma } from "@/lib/prisma";
import { cacheDel } from "@/lib/redis";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { OrderAttributionService } from "@/services/order-attribution.service";
import { BillingService } from "@/services/billing.service";
import { ThemeTestService } from "@/services/theme-test.service";
import { EmailService } from "@/services/email.service";
import { logger } from "@/lib/logger";

const orderAttributionService = new OrderAttributionService();
const billingService = new BillingService();
const themeTestService = new ThemeTestService();
const emailService = new EmailService();

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";

  // Validate HMAC
  const isValid = await validateWebhook(rawBody, hmac);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shop) {
    // Shop not found but webhook valid — return 200 to prevent Shopify retries
    return NextResponse.json({ ok: true });
  }

  // Rate limit inbound webhooks per shop to prevent flooding
  const rl = await checkRateLimit(`webhook:${shopDomain}`, RATE_LIMITS.webhook_inbound);
  if (!rl.allowed) {
    logger.warn("[Webhook] Rate limit exceeded — dropping webhook", { shopDomain, topic });
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log the webhook
  const webhookLog = await prisma.webhookLog.create({
    data: {
      shopId: shop.id,
      topic,
      payload: payload as never,
      status: "received",
    },
  });

  try {
    await processWebhook(shop.id, shopDomain, topic, payload as Record<string, unknown>, webhookLog.id);
  } catch (err) {
    Sentry.captureException(err, { tags: { webhookTopic: topic, shopDomain } });
    logger.error("[Webhook] Processing error", err instanceof Error ? err : undefined, { topic, shopDomain });
  }

  return NextResponse.json({ ok: true });
}

async function processWebhook(
  shopId: string,
  shopDomain: string,
  topic: string,
  payload: Record<string, unknown>,
  logId: string
): Promise<void> {
  try {
    switch (topic) {
      case "orders/create":
      case "orders/updated":
      case "orders/paid":
      case "orders/cancelled": {
        // Idempotency guard for orders/create — Shopify may retry on timeout/5xx.
        // orders/updated and orders/paid are designed to be re-processed (they update, not insert).
        if (topic === "orders/create") {
          const shopifyOrderId = String((payload as Record<string, unknown>).id ?? "");
          if (shopifyOrderId) {
            const existing = await prisma.orderAttribution.findFirst({
              where: { shopId, shopifyOrderId },
              select: { id: true },
            });
            if (existing) break;
          }
        }
        await orderAttributionService.processOrder(shopId, payload);
        break;
      }

      case "refunds/create":
        await orderAttributionService.processRefund(shopId, payload);
        break;

      case "products/update":
      case "variants/in_stock":
      case "variants/out_of_stock":
        // Invalidate the runtime config cache so storefronts pick up product changes
        await cacheDel(`runtime:config:${shopDomain}`);
        break;

      case "app/uninstalled":
        // Clear encrypted access token on uninstall (security + GDPR best practice).
        // uninstalledAt is set so reinstall can detect previous installs.
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            uninstalledAt: new Date(),
            accessTokenEncrypted: "", // revoke stored token — forces re-auth on reinstall
          },
        });
        break;

      case "app_subscriptions/update":
        await billingService.processSubscriptionWebhook(shopId, payload);
        break;

      case "checkouts/update": {
        // Shopify sets abandoned_checkout_url when a checkout goes stale (≈1 hour of inactivity).
        // Look up any active AbandonedCart personalization and send a recovery email.
        const checkout = payload as Record<string, unknown>;
        const abandonedUrl = checkout.abandoned_checkout_url as string | undefined;
        const email = checkout.email as string | undefined;
        if (!abandonedUrl || !email) break;

        const personalization = await prisma.personalization.findFirst({
          where: { shopId, type: "ABANDONED_CART", status: "ACTIVE" },
          orderBy: { priority: "asc" },
        });

        if (!personalization) break;

        const mods = personalization.modifications as Array<Record<string, unknown>>;
        const bannerMod = mods.find((m) => m["type"] === "announcement_bar") ?? mods[0];

        const lineItems = (checkout.line_items as Array<Record<string, unknown>> | undefined) ?? [];
        const cartItems = lineItems.map((item) => ({
          title: String(item["title"] ?? "Item"),
          quantity: Number(item["quantity"] ?? 1),
          price: String(item["price"] ?? "0.00"),
        }));

        // Find an offer code linked to this personalization if any
        let offerCode: string | undefined;
        if (personalization.offerIds?.[0]) {
          const offer = await prisma.offer.findUnique({
            where: { id: personalization.offerIds[0] },
            select: { discountRules: true },
          });
          if (offer) {
            const rules = offer.discountRules as Record<string, unknown> | null;
            offerCode = rules?.["code"] as string | undefined;
          }
        }

        void emailService
          .sendAbandonedCartEmail({
            to: email,
            shopDomain,
            checkoutUrl: abandonedUrl,
            cartItems,
            message: String(bannerMod?.["message"] ?? "You left something in your cart"),
            subtext: bannerMod?.["subtext"] as string | undefined,
            ctaLabel: bannerMod?.["ctaLabel"] as string | undefined,
            offerCode,
          })
          .catch((err) => logger.error("[Webhook checkouts/update] Email send error", err instanceof Error ? err : undefined, { shopDomain }));
        break;
      }

      case "themes/publish": {
        // A merchant manually published a theme while a theme test may be running.
        // Auto-pause any RUNNING theme tests for this shop to avoid data corruption.
        const themeId = payload.id as number | undefined;
        const themeName = (payload.name as string | undefined) ?? "Unknown theme";
        const reason = `themes/publish webhook: merchant published theme "${themeName}" (ID: ${themeId ?? "unknown"}) — auto-paused to protect experiment integrity`;
        const result = await themeTestService.pauseAllRunningForShop(shopId, reason);
        if (result.paused > 0) {
          logger.warn("[Webhook themes/publish] Auto-paused theme test(s)", {
            shopDomain,
            paused: result.paused,
            ids: result.ids,
            themeId,
            themeName,
          });
        }
        break;
      }

      case "customers/data_request": {
        // GDPR: export all data we hold about this customer
        const gdprCustomer = (payload as Record<string, unknown>).customer as Record<string, unknown> | undefined;
        const customerId = String(gdprCustomer?.id ?? "");
        const customerEmail = String(gdprCustomer?.email ?? "");
        const orders = await prisma.orderAttribution.findMany({
          where: { shopId, customerId },
          select: {
            shopifyOrderId: true,
            shopifyOrderName: true,
            visitorId: true,
            sessionId: true,
            attributedAt: true,
          },
        });
        const visitorIds = orders.map((o: (typeof orders)[number]) => o.visitorId).filter(Boolean) as string[];
        const [events, assignments] = await Promise.all([
          prisma.event.findMany({
            where: { shopId, visitorId: { in: visitorIds } },
            select: { eventName: true, eventType: true, occurredAt: true, url: true },
          }),
          prisma.experimentAssignment.findMany({
            where: { shopId, visitorId: { in: visitorIds } },
            select: { experimentId: true, variantId: true, firstSeenAt: true, lastSeenAt: true },
          }),
        ]);
        logger.info("[GDPR customers/data_request]", {
          shopDomain,
          customerId,
          customerEmail,
          orders: orders.length,
          events: events.length,
          assignments: assignments.length,
        });
        // Shopify does not require us to send this data anywhere — just acknowledge receipt.
        // For App Store compliance the log above is the audit trail.
        break;
      }

      case "customers/redact": {
        // GDPR: anonymise/delete all PII tied to this customer
        const redactCustomer = (payload as Record<string, unknown>).customer as Record<string, unknown> | undefined;
        const customerIdToRedact = String(redactCustomer?.id ?? "");
        if (customerIdToRedact) {
          // Collect visitorIds BEFORE nullifying — updateMany wipes them, so findMany after returns 0 rows
          const affectedOrders = await prisma.orderAttribution.findMany({
            where: { shopId, customerId: customerIdToRedact },
            select: { visitorId: true },
          });
          const visitorIds = affectedOrders.map((o: (typeof affectedOrders)[number]) => o.visitorId).filter(Boolean) as string[];

          // Nullify PII fields on order attributions (keep aggregate metrics)
          await prisma.orderAttribution.updateMany({
            where: { shopId, customerId: customerIdToRedact },
            data: { customerId: null, visitorId: null, sessionId: null, cartToken: null, checkoutToken: null },
          });

          // Delete raw events and assignments linked to those visitors
          if (visitorIds.length > 0) {
            await prisma.event.deleteMany({ where: { shopId, visitorId: { in: visitorIds } } });
            await prisma.experimentAssignment.deleteMany({ where: { shopId, visitorId: { in: visitorIds } } });
          }
        }
        logger.info("[GDPR customers/redact] PII nullified", { shopDomain, customerId: customerIdToRedact });
        break;
      }

      case "shop/redact": {
        // GDPR: merchant uninstalled 90+ days ago — delete all their data
        // Cascade deletes handle most relations via Prisma schema onDelete: Cascade.
        // We delete the Shop record which cascades to all related data.
        const shopRecord = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
        if (shopRecord) {
          await prisma.shop.delete({ where: { id: shopRecord.id } });
          logger.info("[GDPR shop/redact] All data deleted", { shopDomain });
        } else {
          logger.info("[GDPR shop/redact] Shop not found or already deleted", { shopDomain });
        }
        break;
      }

      default:
        logger.warn("[Webhook] Unhandled topic", { topic, shopDomain });
    }

    await prisma.webhookLog.update({
      where: { id: logId },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (error) {
    await prisma.webhookLog.update({
      where: { id: logId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
