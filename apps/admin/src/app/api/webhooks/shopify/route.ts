import { NextRequest, NextResponse } from "next/server";
import { validateWebhook } from "@/lib/shopify";
import { prisma } from "@/lib/prisma";
import { OrderAttributionService } from "@/services/order-attribution.service";
import { BillingService } from "@/services/billing.service";
import { ThemeTestService } from "@/services/theme-test.service";

const orderAttributionService = new OrderAttributionService();
const billingService = new BillingService();
const themeTestService = new ThemeTestService();

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

  // Process webhook asynchronously (don't await to return 200 quickly)
  processWebhook(shop.id, shopDomain, topic, payload as Record<string, unknown>, webhookLog.id).catch(
    (err) => console.error("[Webhook] Processing error:", err)
  );

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
        await orderAttributionService.processOrder(shopId, payload);
        break;

      case "refunds/create":
        await orderAttributionService.processRefund(shopId, payload);
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

      case "themes/publish": {
        // A merchant manually published a theme while a theme test may be running.
        // Auto-pause any RUNNING theme tests for this shop to avoid data corruption.
        const themeId = payload.id as number | undefined;
        const themeName = (payload.name as string | undefined) ?? "Unknown theme";
        const reason = `themes/publish webhook: merchant published theme "${themeName}" (ID: ${themeId ?? "unknown"}) — auto-paused to protect experiment integrity`;
        const result = await themeTestService.pauseAllRunningForShop(shopId, reason);
        if (result.paused > 0) {
          console.warn(
            `[Webhook themes/publish] Auto-paused ${result.paused} theme test(s) for shop ${shopDomain}: ${result.ids.join(", ")}`
          );
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
        const events = await prisma.event.findMany({
          where: {
            shopId,
            visitorId: { in: orders.map((o: (typeof orders)[number]) => o.visitorId).filter(Boolean) as string[] },
          },
          select: { eventName: true, eventType: true, occurredAt: true, url: true },
        });
        console.log(
          `[GDPR customers/data_request] shop=${shopDomain} customerId=${customerId} email=${customerEmail}` +
            ` orders=${orders.length} events=${events.length}`,
          JSON.stringify({ orders, events })
        );
        // Shopify does not require us to send this data anywhere — just acknowledge receipt.
        // For App Store compliance the log above is the audit trail.
        break;
      }

      case "customers/redact": {
        // GDPR: anonymise/delete all PII tied to this customer
        const redactCustomer = (payload as Record<string, unknown>).customer as Record<string, unknown> | undefined;
        const customerIdToRedact = String(redactCustomer?.id ?? "");
        if (customerIdToRedact) {
          // Nullify customerId on order attributions (keep aggregate metrics, remove PII)
          await prisma.orderAttribution.updateMany({
            where: { shopId, customerId: customerIdToRedact },
            data: { customerId: null, visitorId: null, sessionId: null, cartToken: null, checkoutToken: null },
          });
          // Delete raw events linked to the same visitor IDs
          // (visitor IDs are already anonymised UUIDs but Shopify may still request deletion)
          const affectedOrders = await prisma.orderAttribution.findMany({
            where: { shopId, customerId: customerIdToRedact },
            select: { visitorId: true },
          });
          const visitorIds = affectedOrders.map((o: (typeof affectedOrders)[number]) => o.visitorId).filter(Boolean) as string[];
          if (visitorIds.length > 0) {
            await prisma.event.deleteMany({ where: { shopId, visitorId: { in: visitorIds } } });
            await prisma.experimentAssignment.deleteMany({ where: { shopId, visitorId: { in: visitorIds } } });
          }
        }
        console.log(`[GDPR customers/redact] shop=${shopDomain} customerId=${customerIdToRedact} — PII nullified`);
        break;
      }

      case "shop/redact": {
        // GDPR: merchant uninstalled 90+ days ago — delete all their data
        // Cascade deletes handle most relations via Prisma schema onDelete: Cascade.
        // We delete the Shop record which cascades to all related data.
        const shopRecord = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
        if (shopRecord) {
          await prisma.shop.delete({ where: { id: shopRecord.id } });
          console.log(`[GDPR shop/redact] shop=${shopDomain} — all data deleted`);
        } else {
          console.log(`[GDPR shop/redact] shop=${shopDomain} — already deleted or not found`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled topic: ${topic}`);
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
