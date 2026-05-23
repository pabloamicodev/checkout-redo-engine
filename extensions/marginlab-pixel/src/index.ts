// @ts-nocheck — Shopify Web Pixel extension: types provided at build time by Shopify CLI.
/**
 * MarginLab Web Pixel Extension
 *
 * Tracks Shopify standard events and enriches them with experiment
 * assignment context for accurate order and funnel attribution.
 *
 * Runs in a sandboxed Web Worker context — no DOM access.
 * Uses the Shopify Web Pixel API.
 */

import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings, init }) => {
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const apiBase = (settings as Record<string, string>).apiBase ?? "";
  const shopDomain = init.data?.shop?.permanentDomain ?? "";

  // ---------------------------------------------------------------------------
  // Customer privacy / consent guard
  // Web Pixels run in an isolated Worker so we use init.data.customerPrivacy.
  // Analytics tracking requires "analytics" consent category.
  // ---------------------------------------------------------------------------
  function hasAnalyticsConsent(): boolean {
    const privacy = init.data?.customerPrivacy;
    // If consent data is unavailable, default to allowed (merchant is responsible
    // for configuring Shopify's consent collection).
    if (!privacy) return true;
    // Shopify customer privacy API — `analyticsProcessingAllowed` is the correct field.
    return (privacy as Record<string, unknown>).analyticsProcessingAllowed !== false;
  }

  // ---------------------------------------------------------------------------
  // Event deduplication
  // Prevent double-fire of the same event within a short window (e.g. SPAs
  // that trigger page_viewed twice on hydration).
  // ---------------------------------------------------------------------------
  const recentEvents = new Map<string, number>();
  const DEDUP_WINDOW_MS = 500;

  function isDuplicate(key: string): boolean {
    const last = recentEvents.get(key);
    const now = Date.now();
    if (last && now - last < DEDUP_WINDOW_MS) return true;
    recentEvents.set(key, now);
    // Prune old entries to avoid unbounded growth
    if (recentEvents.size > 50) {
      const oldest = recentEvents.keys().next().value;
      if (oldest) recentEvents.delete(oldest);
    }
    return false;
  }

  // Extract MarginLab visitor ID from localStorage equivalent
  // In Web Pixel context we use browser.cookie / browser.localStorage
  function getVisitorId(): string {
    return browser.cookie.get("_ml_vid") ?? browser.localStorage.getItem("_ml_vid") ?? "";
  }

  function getSessionId(): string {
    return browser.cookie.get("_ml_sid") ?? "";
  }

  function getAssignments(): Record<string, string> {
    try {
      const raw = browser.localStorage.getItem("_ml_assignments");
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch {}
    return {};
  }

  function buildEventPayload(
    eventName: string,
    eventType: string,
    metadata: Record<string, unknown>,
    checkoutToken?: string
  ) {
    const assignments = getAssignments();
    const firstAssignment = Object.entries(assignments)[0];

    return {
      shopDomain,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      events: [
        {
          eventName,
          eventType,
          experimentId: firstAssignment?.[0] ?? undefined,
          variantId: firstAssignment?.[1] ?? undefined,
          url: "",
          path: "",
          metadata: {
            ...metadata,
            allAssignments: assignments,
            checkoutToken,
          },
          occurredAt: new Date().toISOString(),
        },
      ],
    };
  }

  function send(eventName: string, payload: ReturnType<typeof buildEventPayload>) {
    if (!apiBase || !shopDomain) return;
    if (!hasAnalyticsConsent()) return;
    if (isDuplicate(eventName + "|" + payload.visitorId)) return;

    browser.sendBeacon(apiBase + "/api/runtime/events", JSON.stringify(payload));
  }

  // ---------------------------------------------------------------------------
  // Standard event subscribers
  // ---------------------------------------------------------------------------

  analytics.subscribe("page_viewed", (event) => {
    const key = "page_viewed";
    send(key, buildEventPayload("page_viewed", "PAGE_VIEW", {
      pageTitle: event.data?.document?.title,
      pageUrl: event.data?.document?.location?.href,
    }));
  });

  analytics.subscribe("product_viewed", (event) => {
    const product = event.data?.productVariant?.product;
    const key = "product_viewed|" + (product?.id ?? "");
    send(key, buildEventPayload("product_viewed", "PRODUCT_VIEW", {
      productId: product?.id,
      productTitle: product?.title,
      variantId: event.data?.productVariant?.id,
      price: event.data?.productVariant?.price?.amount,
      currency: event.data?.productVariant?.price?.currencyCode,
    }));
  });

  analytics.subscribe("collection_viewed", (event) => {
    const key = "collection_viewed|" + (event.data?.collection?.id ?? "");
    send(key, buildEventPayload("collection_viewed", "COLLECTION_VIEW", {
      collectionId: event.data?.collection?.id,
      collectionTitle: event.data?.collection?.title,
    }));
  });

  analytics.subscribe("search_submitted", (event) => {
    send("search_submitted", buildEventPayload("search_submitted", "SEARCH", {
      query: event.data?.searchResult?.query,
    }));
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    const variant = event.data?.cartLine?.merchandise;
    const cost = event.data?.cartLine?.cost;
    const key = "add_to_cart|" + (event.data?.cartLine?.id ?? "");
    send(key, buildEventPayload("product_added_to_cart", "ADD_TO_CART", {
      cartLineId: event.data?.cartLine?.id,
      productId: variant?.product?.id,
      variantId: variant?.id,
      quantity: event.data?.cartLine?.quantity,
      price: cost?.totalAmount?.amount,
      currency: cost?.totalAmount?.currencyCode,
    }));
  });

  analytics.subscribe("cart_viewed", (event) => {
    const cart = event.data?.cart;
    const key = "cart_viewed|" + (cart?.id ?? "");
    send(key, buildEventPayload("cart_viewed", "CART_VIEW", {
      cartId: cart?.id,
      cartToken: cart?.token,
      totalQuantity: cart?.totalQuantity,
      subtotal: cart?.cost?.subtotalAmount?.amount,
      currency: cart?.cost?.subtotalAmount?.currencyCode,
    }));
  });

  analytics.subscribe("checkout_started", (event) => {
    const checkout = event.data?.checkout;
    const key = "checkout_started|" + (checkout?.token ?? "");
    send(key, buildEventPayload(
      "checkout_started",
      "CHECKOUT_STARTED",
      {
        checkoutId: checkout?.token,
        subtotalPrice: checkout?.subtotalPrice?.amount,
        totalPrice: checkout?.totalPrice?.amount,
        lineItemsCount: checkout?.lineItems?.length,
        currency: checkout?.currencyCode,
      },
      checkout?.token
    ));
  });

  analytics.subscribe("checkout_completed", (event) => {
    const order = event.data?.checkout;
    // checkout_completed should never be deduped — use a unique order key
    const key = "checkout_completed|" + (order?.order?.id ?? order?.token ?? Date.now());
    send(key, buildEventPayload(
      "checkout_completed",
      "CHECKOUT_COMPLETED",
      {
        orderId: order?.order?.id,
        orderName: order?.order?.name,
        subtotalPrice: order?.subtotalPrice?.amount,
        totalPrice: order?.totalPrice?.amount,
        totalDiscounts: order?.totalDiscountsAmount?.amount,
        currency: order?.currencyCode,
        lineItemsCount: order?.lineItems?.length,
      },
      order?.token
    ));
  });

  analytics.subscribe("payment_info_submitted", (event) => {
    send("payment_info_submitted", buildEventPayload("payment_info_submitted", "PAYMENT_INFO_SUBMITTED", {
      checkoutToken: event.data?.checkout?.token,
    }));
  });

  analytics.subscribe("checkout_contact_info_submitted", (_event) => {
    send("checkout_step_contact", buildEventPayload("checkout_step_viewed", "CHECKOUT_STEP_VIEWED", {
      step: "contact",
    }));
  });

  analytics.subscribe("checkout_shipping_info_submitted", (_event) => {
    send("checkout_step_shipping", buildEventPayload("checkout_step_viewed", "CHECKOUT_STEP_VIEWED", {
      step: "shipping",
    }));
  });
});
