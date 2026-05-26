# MarginLab — Full Platform Reference

> A/B testing, personalization, and profit analytics for Shopify stores.

---

## Table of Contents

- [Technical Reference](#technical-reference)
  - [Architecture Overview](#architecture-overview)
  - [Database Models](#database-models)
  - [Experiment Types & Flows](#experiment-types--flows)
  - [API Routes](#api-routes)
  - [Services](#services)
  - [Shopify Extensions](#shopify-extensions)
  - [Validations & Guards](#validations--guards)
  - [Analytics Engine](#analytics-engine)
  - [Integrations](#integrations)
  - [Security & Auth](#security--auth)
  - [Performance & Caching](#performance--caching)
- [Non-Technical Reference](#non-technical-reference)
  - [What Does MarginLab Do?](#what-does-marginlab-do)
  - [Features Explained Simply](#features-explained-simply)
  - [How A/B Testing Works](#how-ab-testing-works)
  - [What Gets Protected & Validated](#what-gets-protected--validated)
  - [Analytics & Reporting](#analytics--reporting)
  - [Integrations (Non-Technical)](#integrations-non-technical)

---

# Technical Reference

## Architecture Overview

MarginLab is a multi-tenant Shopify SaaS app built as a **Next.js monorepo** deployed on Vercel, with Shopify extensions for storefront interaction.

```
checkout-redo-engine/
├── apps/admin/              # Next.js admin dashboard + REST API
│   └── src/
│       ├── app/             # Pages + API routes (App Router)
│       ├── services/        # Business logic layer
│       └── lib/             # Shared utilities, middleware, caching
├── extensions/              # Shopify extensions (Functions, UI, Theme, Pixel)
├── prisma/                  # PostgreSQL schema
└── tests/                   # Extension test suites
```

**Stack:**
- **Frontend**: Next.js 14 App Router, React, Tailwind CSS
- **Backend**: Next.js API routes, PostgreSQL (Prisma ORM), Redis (Upstash)
- **Shopify**: Shopify Functions (WASM via javy), Checkout UI Extensions, Theme App Extension, Web Pixel
- **Hosting**: Vercel (admin), Shopify CDN (extensions)
- **Analytics**: Redis for real-time unique tracking; PostgreSQL DailyMetric aggregates for dashboards; optional ClickHouse adapter for high-volume queries

---

## Database Models

### `Shop`
Central tenant record. One row per installed Shopify store.

| Field | Type | Notes |
|---|---|---|
| `shopDomain` | String | Unique. e.g. `store.myshopify.com` |
| `accessToken` | String | AES-encrypted Shopify access token |
| `settings` | JSON | Dynamic config: feature flags, function GIDs, cached configs |
| `timezone`, `currency` | String | For analytics display |
| `plan` | Relation | → `ShopPlan` |

Relations: owns all Experiments, Variants, Personalizations, Offers, CheckoutBlocks, Events, Orders, Integrations, CustomEvents, AuditLogs.

---

### `Experiment`
Core model for all A/B test types.

**Status lifecycle:**
```
DRAFT → QA → PREVIEW → SCHEDULED → RUNNING → PAUSED → COMPLETED → ARCHIVED
```

**Supported types (11):**
```
PRICE_TEST          DISCOUNT_TEST       SHIPPING_TEST
OFFER_TEST          COMBINATION_TEST    CONTENT_TEST
SPLIT_URL_TEST      TEMPLATE_TEST       THEME_TEST
CHECKOUT_TEST       PERSONALIZATION_TEST
```

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `trafficAllocation` | Float | % of total traffic that enters this test |
| `assignmentStrategy` | Enum | `VISITOR` / `SESSION` / `CUSTOMER` |
| `targetingRules` | JSON | AND/OR groups of conditions |
| `goals` | JSON | Primary + secondary conversion goals |
| `priceConfig` | JSON | Price enforcement strategy and overrides |
| `discountConfig` | JSON | Discount type, value, eligible items |
| `shippingConfig` | JSON | Shipping method operations |
| `mutuallyExclusiveGroupId` | FK | Prevents overlapping test assignment |

**Constraints enforced:**
- Variant allocations must sum to exactly 100%
- Exactly one variant must be `isControl = true`
- Slug is unique per shop

---

### `ExperimentVariant`
One record per arm of an A/B test.

| Field | Type | Notes |
|---|---|---|
| `key` | String | e.g. `control`, `variant_a` |
| `allocation` | Float | % of experiment traffic |
| `modifications` | JSON | DOM/CSS changes (content tests) |
| `priceOverrides` | JSON | Array of `{shopifyVariantId, price, compareAtPrice}` |
| `redirectUrl` | String | Target URL (split-URL tests) |
| `previewToken` | String | Unique token for QA force-assignment |

---

### `ExperimentAssignment`
One row per visitor+experiment pair. Persisted after first assignment.

| Field | Type | Notes |
|---|---|---|
| `visitorId` | String | Hashed browser fingerprint |
| `source` | Enum | `COOKIE` / `URL_PARAM` / `CART_ATTRIBUTE` / `CUSTOMER_ID` / `SERVER_SIDE` |
| `context` | JSON | Device, country, UTM, landing page, referrer at assignment time |
| `firstSeenAt` | DateTime | When assigned |
| `lastSeenAt` | DateTime | Updated on each subsequent event |

**Constraint:** Unique on `(experimentId, visitorId)`.

---

### `Personalization`
Persistent (non-test) customer experience rules.

**Types (8):**
```
OFFER       CHECKOUT    CONTENT         PRICE_DISPLAY
BANNER      SHIPPING_MESSAGE    ABANDONED_CART  POST_PURCHASE
```

**Status lifecycle:**
```
DRAFT → ACTIVE → PAUSED → ARCHIVED
```

**Key fields:**
- `priority` — lower value evaluated first (sequential waterfall, first match wins)
- `targetingRules` — same JSON structure as Experiment targeting
- `startsAt` / `endsAt` — optional scheduling

---

### `Offer`
Reusable discount/incentive objects (Offer Library).

**Types (11):**
```
PERCENTAGE_DISCOUNT     FIXED_AMOUNT_DISCOUNT   PRODUCT_DISCOUNT
ORDER_DISCOUNT          FREE_SHIPPING           FREE_GIFT
VOLUME_DISCOUNT         QUANTITY_BREAK          BUY_X_GET_Y
TIERED_PROGRESS_BAR     CAMPAIGN_LINK_OFFER
```

**Guard:** Once `ACTIVE`, only `name` and `displaySettings` can be modified. Any change to discount value, trigger rules, or eligible products requires pausing first.

---

### `CheckoutBlock`
UI widgets injected into the Shopify checkout.

**Types (10):**
```
TRUST_BADGES        SOCIAL_PROOF        GUARANTEE
SHIPPING_MESSAGE    PAYMENT_ICONS       PRODUCT_UPSELL
CUSTOM_CONTENT      IMAGE_WITH_TEXT     URGENCY_MESSAGE
SECURITY_MESSAGE
```

**Guard:** Same as Offer — once `ACTIVE`, structural changes are blocked. Only name and styles are editable.

---

### `Event`
Raw event log from the storefront.

**Event types (16):**
```
PAGE_VIEW               PRODUCT_VIEW            COLLECTION_VIEW
SEARCH                  ADD_TO_CART             REMOVE_FROM_CART
CART_VIEW               CHECKOUT_STARTED        CHECKOUT_STEP_VIEWED
PAYMENT_INFO_SUBMITTED  CHECKOUT_COMPLETED      CUSTOM
CHECKOUT_BLOCK_RENDERED OFFER_VIEWED            OFFER_CLAIMED
PRICE_VIEWED
```

**Key fields:** `visitorId`, `sessionId`, `experimentId`, `variantId`, `personalizationId`, `cartToken`, `checkoutToken`, `url`, `deviceType`, `country`, `utmSource/Medium/Campaign`, `currency`, `occurredAt` (client time), `receivedAt` (server time).

---

### `OrderAttribution`
Financial record linking Shopify orders to experiments.

| Field | Type | Notes |
|---|---|---|
| `subtotalPrice` | Decimal | Pre-discount order value |
| `totalDiscounts` | Decimal | Applied discounts |
| `netRevenue` | Decimal | Revenue after discounts + tax |
| `cogs` | Decimal | Sum of ProductCost per line item |
| `estimatedShippingCost` | Decimal | Configurable flat or % rate |
| `transactionFee` | Decimal | Payment processor fee |
| `grossProfit` | Decimal | `netRevenue - COGS` |
| `contributionMargin` | Decimal | `(grossProfit / netRevenue) × 100` |

**Constraint:** Unique on `(shopId, shopifyOrderId)` — prevents double attribution.

---

### `DailyMetric`
Pre-aggregated analytics, one row per experiment/variant/day.

Stores: `visitors`, `sessions`, `pageViews`, `productViews`, `addToCarts`, `checkoutsStarted`, `orders`, `revenue`, `netRevenue`, `discounts`, `shippingRevenue`, `tax`, `cogs`, `grossProfit`, plus derived rates: `conversionRate`, `addToCartRate`, `checkoutRate`, `aov`, `revenuePerVisitor`, `profitPerVisitor`.

**Constraint:** Unique on `(shopId, experimentId, variantId, date)`.

---

### `Integration`

**Supported providers:**
```
GA4     KLAVIYO     ELEVAR      CLARITY
HEAP    SEGMENT     RECHARGE    WEBHOOK     SLACK
```

**Fields:** `config` (AES-encrypted API keys/tokens), `publicConfig` (non-sensitive settings), `status` (`CONNECTED` / `DISCONNECTED` / `ERROR` / `PENDING`).

---

### `ShopPlan`

**Status values:**
```
TRIALING    ACTIVE      DECLINED    EXPIRED
FROZEN      CANCELLED   PENDING
```

Linked to Shopify's recurring application charge ID. Status is kept in sync via the `app_subscriptions/update` webhook.

---

### `AuditLog`
Immutable event log of all merchant actions.

Fields: `actorId`, `actorEmail`, `entityType`, `entityId`, `entityName`, `action`, `before` (JSON snapshot), `after` (JSON snapshot), `ipAddress`, `userAgent`.

---

## Experiment Types & Flows

### Price Test

**Purpose:** Test different price points and measure revenue/conversion impact.

**Enforcement strategies:**
- `DISPLAY_ONLY` — JavaScript overrides the displayed price; Shopify charges the original price. No backend discount needed.
- `SHOPIFY_FUNCTION` — An Order Discount Function applies the delta as a discount, so the actual checkout price matches the displayed price.

**Flow:**
1. Merchant creates test; control variant auto-set to current Shopify price.
2. Validation: `testPrice > 0`, allocations sum to 100%, one control.
3. Launch: syncs discount rules to Function config metafield via `FunctionConfigService`.
4. Runtime assigns visitors → returns `priceOverrides[]` in assignment response.
5. `marginlab-runtime.js` applies CSS/DOM overrides to display test price.
6. Analytics compares conversion rate, AOV, revenue per visitor, and profit per visitor.
7. **Rollout**: backs up original prices in `shop.settings`; applies winner via Shopify `productVariantsBulkUpdate`. Requires `confirmationToken === experimentId` (CSRF-style guard).
8. **Rollback**: restores backed-up prices.

---

### Discount Test

**Purpose:** Test different discount incentives (%, fixed amount, BOGO, free shipping) to find the optimal offer.

**Flow:**
1. Configure control (no discount) + variants (varying discounts).
2. Launch → writes `VariantDiscountRule[]` to Order Discount Function metafield.
3. Shopify Function reads cart attribute `_ml_exp_<8-char-experimentId>` to identify assigned variant.
4. Applies matching discount to eligible cart items.
5. Analytics tracks redemption rate, net revenue impact, and AOV change.

---

### Shipping Test

**Purpose:** A/B test which shipping methods appear or how they're labeled at checkout.

**Operations:**
- `hide` — hides any shipping method whose title contains a given substring (case-insensitive).
- `rename` — renames a shipping method's display title.

**Flow:**
1. Configure per-variant shipping rules.
2. Launch → writes `ShippingRule[]` to Delivery Customization Function metafield.
3. `marginlab-runtime.js` writes `_ml_experiments: JSON.stringify({shortId: variantKey})` to cart.
4. Delivery Customization Function reads the JSON attribute, matches rules, returns hide/rename operations.
5. Analytics tracks shipping method selection rate and order completion.

**Key constraint resolved:** The Delivery Customization API's `Cart` type only exposes `attribute(key: String)` (single key lookup), not `attributes[]` (full array). The consolidated `_ml_experiments` JSON attribute solves this constraint without requiring the function to know experiment IDs at schema compile time.

---

### Content Test

**Purpose:** Test DOM/CSS modifications — copy, button labels, colors, layout, images.

**Modification operation types:** `update-text`, `add-class`, `remove-class`, `set-style`, `set-display`, `set-attribute`, `append-html`, `prepend-html`.

**Flow:**
1. Merchant defines modifications as `{ selector, operation, value }[]` per variant.
2. Runtime applies changes client-side after DOM ready.
3. Analytics tracks engagement and conversion by variant.

---

### Split URL Test

**Purpose:** Test entirely different pages (different routes or domains).

**Flow:**
1. Control = current URL; variants = alternate URLs.
2. Runtime redirects visitor to variant URL immediately after assignment.
3. Web Pixel on both pages tracks events with the same `visitorId` + `experimentId`.
4. Analytics aggregates cross-URL funnel metrics.

---

### Offer Test

**Purpose:** Test whether showing a specific offer widget increases conversion or AOV.

**Flow:**
1. Attach an Offer Library item to a specific experiment variant.
2. Assignment response includes `offerIds[]` for the visitor's variant.
3. Runtime renders the offer widget on the storefront.
4. Analytics tracks `OFFER_VIEWED`, `OFFER_CLAIMED`, conversion lift, AOV impact.

---

### Checkout Block Test

**Purpose:** Test which checkout UI widgets (trust badges, urgency, upsells) improve completion rates.

**Flow:**
1. Attach a CheckoutBlock to an experiment variant.
2. Shopify Checkout UI Extension renders the block at the configured `target` position.
3. Analytics tracks `CHECKOUT_BLOCK_RENDERED`, checkout starts, and completions.

---

### Personalization (Always-On Rules)

**Purpose:** Persistent audience rules that personalize the experience without statistical testing.

**Targeting dimensions:**
```
deviceType          country             currency
URL path            UTM parameters      cart value (min/max)
product IDs         visitor type        customer status
isNewVisitor        isReturningCustomer referrer
```

**Evaluation:** Sorted by `priority` (ASC). First matching rule applies. Evaluated server-side at assignment and client-side in the runtime.

**Scheduling:** Optional `startsAt` / `endsAt` fields enable time-boxed personalizations. Validation enforces `endsAt > now` and `endsAt > startsAt`.

---

## API Routes

### Experiment & Test CRUD

Every test type exposes the same route structure under `/api/{type}`:

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/{type}` | List. Filters: `status`, `type`, `search`, `limit`, `offset` |
| `POST` | `/api/{type}` | Create. Validates schema + plan limits |
| `GET` | `/api/{type}/[id]` | Fetch with variants and event counts |
| `PATCH` | `/api/{type}/[id]` | Update. Certain fields blocked by status |
| `POST` | `/api/{type}/[id]/launch` | → RUNNING. Syncs Function configs |
| `POST` | `/api/{type}/[id]/pause` | → PAUSED. Deregisters Function configs |
| `POST` | `/api/{type}/[id]/complete` | → COMPLETED |
| `POST` | `/api/{type}/[id]/duplicate` | Clone with fresh variants |
| `GET` | `/api/{type}/[id]/analytics` | Aggregated performance metrics |
| `GET` | `/api/{type}/[id]/analytics/segments` | Breakdown by `deviceType`, `country`, `utmSource` |

**Price-test only:**

| Method | Route | Guard |
|---|---|---|
| `POST` | `/api/price-tests/[id]/rollout` | Requires `confirmationToken === experimentId` + price backup written first |
| `POST` | `/api/price-tests/[id]/rollback` | Restores prices from backup in `shop.settings` |

---

### Runtime API (`/api/runtime/*`)

All routes require `X-Shop-Domain` header. Rate-limited per `visitorId` (assignment) or per `shopDomain` (config, events).

**`GET /api/runtime/config`**
Returns active experiments, offers, blocks, and personalizations for the storefront. Cached in Redis (SWR 30s/60s). Intentionally excludes access tokens, COGS, and PII.

**`POST /api/runtime/assignment`**

Input:
```json
{
  "visitorId": "...",
  "sessionId": "...",
  "context": {
    "deviceType": "mobile",
    "country": "US",
    "cartValue": 120.00,
    "isNewVisitor": true,
    "utmSource": "google",
    "forceVariants": {}
  }
}
```

Logic:
1. Fetch existing assignments (avoids re-hashing on return visits).
2. Evaluate targeting rules for unassigned experiments.
3. Apply `forceVariants` override for QA/preview mode.
4. Run `assignVariant(visitorId, experimentId, variants)` — deterministic hash for stable bucket.
5. Persist new `ExperimentAssignment` records.
6. Return assignments with `modifications`, `priceOverrides`, `redirectUrl`, `checkoutBlockIds`, `offerIds`.

**`POST /api/runtime/events`**

Input: `{ visitorId, sessionId, events[] }` with each event having `type`, `experimentId`, `variantId`, `occurredAt`, and optional metadata.

Processing pipeline:
1. Validate custom event names against registered `CustomEvent` records (non-blocking — bad names generate warnings, never drop events).
2. Batch insert in chunks of 100 (`skipDuplicates: true`).
3. Update `ExperimentAssignment.lastSeenAt`.
4. Real-time `DailyMetric` updates via Redis `SADD` for unique visitor/session deduplication, then atomic counter increments.

---

### Billing API (`/api/billing/*`)

| Route | Description |
|---|---|
| `GET /api/billing/plans` | List plans with limits and current usage |
| `POST /api/billing/subscribe` | Create Shopify recurring charge → return `confirmationUrl` |
| `GET /api/billing/callback` | Shopify OAuth redirect after approval → activate plan |
| `POST /api/billing/cancel` | Cancel recurring charge |

**Plan limits:**

| Plan | Running Tests | Active Offers | Checkout Blocks |
|---|---|---|---|
| Free | 1 | 1 | 1 |
| Growth | 5 | 5 | 3 |
| Pro | Unlimited | 25 | 10 |
| Enterprise | Unlimited | Unlimited | Unlimited |

---

### Webhooks (`/api/webhooks/shopify`)

All routes validate Shopify HMAC-SHA256 signature before processing.

| Topic | Handler |
|---|---|
| `app/uninstalled` | Delete shop record + clean up sessions |
| `app_subscriptions/update` | Sync plan status from Shopify charge record |
| `orders/created` | Attribute order to experiment/personalization; compute profit |
| `orders/paid` | Update attribution financial status |
| `orders/cancelled` | Mark attribution cancelled |
| `products/update` | Invalidate product cache |
| `variants/in_stock` / `out_of_stock` | Invalidate variant cache |

---

## Services

### `ExperimentService`

**Guards applied at every write:**
- `variants.reduce((sum, v) => sum + v.allocation, 0) === 100` — allocation total enforced.
- `variants.filter(v => v.isControl).length === 1` — exactly one control required.
- RUNNING experiments: block changes to `type`, `variants`, `targetingRules`, `trafficAllocation`.
- COMPLETED / ARCHIVED: fully immutable.
- Slug unique per shop (collision check before insert).

**Launch side effects:**
- `FunctionConfigService.registerDiscountExperiment()` for `DISCOUNT_TEST`.
- `FunctionConfigService.registerPriceExperiment()` for `PRICE_TEST` with `SHOPIFY_FUNCTION` strategy.
- `FunctionConfigService.registerShippingExperiment()` for `SHIPPING_TEST` with `useDeliveryCustomization: true`.

**Deregister side effects (pause / complete):**
- Corresponding `deregister*()` calls remove the experiment's rules from Function metafields.

---

### `FunctionConfigService`

Manages Shopify Order Discount Function and Delivery Customization Function configuration.

**State stored in `shop.settings`:**
- `functionDiscountIds` — `{ shopDomain → GID }` for the automatic order discount node.
- `functionDeliveryCustomizationIds` — `{ shopDomain → GID }` for the delivery customization node.

**`registerDiscountExperiment(shopDomain, config)`:**
1. Lazy-create automatic discount node via `discountAutomaticAppCreate` if GID not stored.
2. Read current metafield JSON (`discount_rules[]`).
3. Remove stale rules for the same `experiment_id` (prevents duplicates on re-launch).
4. Append new `VariantDiscountRule` entries.
5. Write updated JSON back to metafield.

**`registerShippingExperiment(shopDomain, config)`:**
1. Lazy-create `DeliveryCustomization` node.
2. Read current `shipping_rules[]` metafield.
3. Remove stale entries for the same `experiment_id`.
4. Append new `ShippingRule` entries with per-variant operations.
5. Write back.

**Deregister (both types):** Read current rules → filter out entries matching `experiment_id` → write back. No-op if GID not stored (idempotent).

---

### `AnalyticsService`

**Statistical tests:**

*Conversion rate — two-proportion Z-test:*
```
z = (p1 - p2) / sqrt(p̂(1-p̂)(1/n1 + 1/n2))
p-value derived from standard normal CDF
```

*Revenue per visitor — Welch's t-test:*
```
t = (mean1 - mean2) / sqrt(var1/n1 + var2/n2)
Degrees of freedom via Welch–Satterthwaite equation
```

*Minimum detectable effect:*
```
n = (z_α + z_β)² × (p(1-p) × 2) / mde²
Defaults: 80% power, 5% MDE, 95% confidence
```

**Peeking warning:** If a winner is detected and the experiment has run fewer than 7 days, the response includes `peekingWarning: true`.

**Data source hierarchy:**
1. `DailyMetric` table (primary, fast).
2. Raw `Event` queries for date ranges not yet aggregated.
3. Redis unique sets for live visitor/session deduplication.

---

### `IntegrationService`

**Outbound webhook delivery:**
- Signs payload: `HMAC-SHA256(merchantSecret, JSON.stringify(payload))` in `X-MarginLab-Signature` header.
- Timeout: 5 seconds per attempt.
- Retry schedule (exponential backoff): `[5s, 25s, 125s, 625s, 3125s]` — 5 total attempts.
- Fire-and-forget: never blocks event ingestion pipeline.

**Slack rate limiting:**
- Redis key: `slack:{shopId}:{experimentId}:{alertType}` with 3600s TTL.
- One alert per experiment per event type per hour maximum.

---

### `BillingService`

**Plan guard flow:**
1. `checkLimit(shopId, resource)` counts only RUNNING experiments / ACTIVE offers+blocks / CONNECTED integrations.
2. If at limit → `{ allowed: false, limit, current, upgradeRequired: true }`.
3. API layer converts this to `402 Payment Required` with upgrade URL.

**Charge activation:**
1. `POST /api/billing/subscribe` → calls `appSubscriptionCreate`, returns `confirmationUrl`.
2. Merchant approves on Shopify → redirects to `/api/billing/callback?charge_id=...`.
3. Service calls `appSubscriptionActivate`.
4. Updates `ShopPlan.status = ACTIVE`, stores `shopifyChargeId`.

---

### `EventIngestionService`

**Pipeline:**
1. Validate custom event names (non-blocking).
2. `prisma.event.createMany({ skipDuplicates: true })` in chunks of 100.
3. Update `ExperimentAssignment.lastSeenAt` for known visitors.
4. For events with `experimentId` + `variantId`:
   - `SADD uv:{expId}:{varId}:{date} {visitorId}` → unique visitor count.
   - `SADD us:{expId}:{varId}:{date} {sessionId}` → unique session count.
   - Atomic `DailyMetric` upsert: increment counter, recompute derived rates.

---

## Shopify Extensions

### `marginlab-order-discount` (Shopify Function)

**Target:** `purchase.order-discount.run`

**Config metafield structure:**
```json
{
  "discount_rules": [
    {
      "experiment_id": "abc12345",
      "variant_key": "variant_b",
      "discount_type": "PERCENTAGE",
      "value": 15,
      "minimum_cart_value": 50,
      "message": "15% off for test group"
    }
  ],
  "offer_rules": [
    {
      "offer_id": "xyz789",
      "discount_type": "FIXED_AMOUNT",
      "value": 10,
      "requires_activation": true
    }
  ]
}
```

**Application strategy:** `DiscountApplicationStrategy.First` — first matching rule wins.

**Edge cases handled:**
- `minimum_cart_value` threshold enforced before matching.
- `requires_activation` offer rules only apply when visitor has explicitly activated the offer.
- No-op if metafield null or JSON malformed.
- No-op if cart attribute for the experiment is absent.

---

### `marginlab-delivery-customization` (Shopify Function)

**Target:** `purchase.delivery-customization.run`

**Key design constraint:** The Delivery Customization API's `Cart` type only exposes `attribute(key: String)` (single lookup), not `attributes[]`. The function reads one consolidated JSON attribute:

```
Cart attribute: "_ml_experiments"
Value:          {"abc12345": "variant_b", "def67890": "control"}
```

The runtime writes both individual `_ml_exp_<id>` attributes (for order-discount function) AND the consolidated `_ml_experiments` JSON (for delivery-customization function) simultaneously.

**Config metafield structure:**
```json
{
  "shipping_rules": [
    {
      "experiment_id": "abc12345678",
      "variant_key": "variant_b",
      "operations": [
        { "type": "hide", "title_contains": "Express" },
        { "type": "rename", "title_from": "Standard", "title_to": "Free Delivery" }
      ]
    }
  ]
}
```

**Matching:**
- `shortId = experiment_id.slice(0, 8)`.
- Check `assignments[shortId] === rule.variant_key`.
- `hide`: case-insensitive `option.title.includes(title_contains)`.
- `rename`: case-insensitive `option.title.includes(title_from)`.
- Iterates all delivery groups and applies matching operations across all.

---

### `marginlab-pixel` (Web Pixel)

**Context:** Shopify sandboxed Web Worker. Uses `browser.cookie` and `browser.localStorage` APIs (no direct DOM access).

**Subscribed Shopify events:**
```
page_viewed, product_viewed, collection_viewed, search_submitted,
product_added_to_cart, product_removed_from_cart, cart_viewed,
checkout_started, checkout_completed, payment_info_submitted,
checkout_step_viewed, checkout_address_info_submitted
```

**Pipeline:**
1. Read `visitorId`, `sessionId`, `_ml_assignments` from `browser.localStorage`.
2. Map Shopify event → MarginLab event schema.
3. Deduplicate: skip if same `(type, checkoutToken)` seen within 500ms.
4. Enrich with `experimentId`, `variantId` from stored assignments.
5. Send via `sendBeacon()` to `/api/runtime/events`.
6. Consent gate: pause collection until `analytics.subscribe('checkout.privacy.accepted')`.

---

### `marginlab-theme` (Theme App Extension + Runtime Asset)

**`marginlab-runtime.js` responsibilities:**
1. Init `visitorId` (UUID v4, persisted in cookie + localStorage).
2. Init `sessionId` (UUID v4, per-session).
3. Fetch `/api/runtime/config` → active experiments, offers, personalizations.
4. Fetch `/api/runtime/assignment` → variant assignments.
5. Apply `modifications[]` for content tests (DOM/CSS changes).
6. Apply `priceOverrides[]` — update price elements via JS.
7. Apply `redirectUrl` — client-side redirect for split-URL tests.
8. Write cart attributes:
   - `_ml_exp_<shortId>: variantKey` (per experiment — for order-discount function)
   - `_ml_experiments: JSON.stringify({shortId: variantKey, ...})` (consolidated — for delivery-customization function)
   - `_ml_visitor_id: visitorId`
9. Track events: page view, product view, add to cart, cart changes.
10. Anti-flicker: applies `visibility: hidden` to body until runtime resolves. Auto-reveals after configurable timeout to prevent indefinitely blank screens on script failure.

---

### `volume-discount` (Shopify Function)

**Target:** `purchase.product-discount.run`

**Logic:**
- Reads tier config from product metafield: `[{ quantity, percentage, tag, discountLabel }]`.
- Sums total quantity per product across all cart lines.
- Finds best matching tier (highest `quantity ≤ totalQty`).
- Applies `percentage` discount per matching cart line.
- Returns discount with `discountLabel` message.

**Edge cases:** No tier match → no discount. Discount applied per line, not once on cart total.

---

### Other Extensions (Pre-existing — Do Not Modify)

| Extension | Type | Purpose |
|---|---|---|
| `checkout-step-tracker` | UI Extension | Track checkout step completion events |
| `checkout-trust-social-proof` | UI Extension | Trust badges, review counts, social proof widgets |
| `fda-disclaimer` | UI Extension | Regulatory compliance disclaimers |
| `order-duplicator` | UI Extension | Post-purchase order duplication (subscription upsell) |
| `order-duplicator-discount` | Shopify Function | Apply discount to duplicated orders |
| `redo-offer` | UI Extension | Offer redemption and activation widget |
| `subscription-terms` | UI Extension | Subscription agreement terms display |
| `utm-attribution` | UI Extension | UTM parameter capture and persistence |

---

## Validations & Guards

### Input Validation (Zod schemas)

| Schema | Key validations |
|---|---|
| `CreateExperimentSchema` | `name` required, `type` valid enum, variants array with allocations summing to 100 |
| `CreateOfferSchema` | Discount rules validated per offer type (see table below) |
| `CreateCheckoutBlockSchema` | `type` valid enum, `position` valid checkout target |
| `CreatePriceTestSchema` | Price > 0 per variant, one control variant |
| `AssignmentRequestSchema` | `visitorId` UUID format, `context` object with typed fields |
| `RuntimeEventSchema` | Event `type` valid enum, `occurredAt` valid ISO datetime |

**Offer type discount validations:**

| Offer Type | Rule |
|---|---|
| `PERCENTAGE_DISCOUNT`, `PRODUCT_DISCOUNT` | `0 < percentage ≤ 100` |
| `FIXED_AMOUNT_DISCOUNT`, `ORDER_DISCOUNT` | `amount > 0` |
| `FREE_SHIPPING` | Optional `minimumCartValue ≥ 0` |
| `VOLUME_DISCOUNT`, `QUANTITY_BREAK`, `TIERED_PROGRESS_BAR` | At least one tier with `quantity > 0` |
| `BUY_X_GET_Y` | `buyQuantity ≥ 1`, `getQuantity ≥ 1` |

---

### Auth Middleware

| Middleware | Applied to | Mechanism |
|---|---|---|
| `withShopAuth` | All admin API routes | Shopify JWT (HS256), validates `aud`, `iss`, `dest`, `exp` |
| `withRuntimeAuth` | `/api/runtime/*` | `X-Shop-Domain` header + domain allowlist |
| `withWebhookAuth` | `/api/webhooks/*` | Shopify HMAC-SHA256 over raw request body |
| `withPlanGuard` | Create/activate routes | Checks plan limits before allowing operation |
| `withRuntimeRateLimit` | `/api/runtime/*` | Per-visitorId (assignment) / per-shop (config, events) |

**Test auth bypass:** `X-Test-Auth-Token: {TEST_AUTH_TOKEN}` accepted only when `NODE_ENV !== 'production'`.

---

### Status Transition Guards

**Experiment:**
```
DRAFT        → QA, PREVIEW, SCHEDULED, RUNNING
QA           → DRAFT, RUNNING
PREVIEW      → DRAFT, RUNNING
SCHEDULED    → DRAFT, RUNNING, PAUSED
RUNNING      → PAUSED, COMPLETED
PAUSED       → RUNNING, COMPLETED, ARCHIVED
COMPLETED    → ARCHIVED
ARCHIVED     → (terminal)
```

Updates blocked on RUNNING / COMPLETED / ARCHIVED: `type`, `variants`, `targetingRules`, `trafficAllocation`, `assignmentStrategy`.

**Offer / CheckoutBlock:**
```
DRAFT    → ACTIVE, ARCHIVED
ACTIVE   → PAUSED, ARCHIVED  (only name + displaySettings editable)
PAUSED   → ACTIVE, ARCHIVED
ARCHIVED → (terminal)
```

---

### Data Integrity Guards

| Guard | Mechanism |
|---|---|
| Variant allocation total must equal 100% | Computed in service before any write; 400 error if violated |
| Exactly one control variant | `filter(isControl).length !== 1` → 400 error |
| Order double attribution | Unique constraint `(shopId, shopifyOrderId)` + `skipDuplicates` |
| DailyMetric uniqueness | Unique constraint `(shopId, experimentId, variantId, date)` |
| Mutual exclusivity | Experiments in the same group never both assigned to the same visitor |
| Stale-read on transitions | Re-fetch current record before status write to detect concurrent transitions |
| Price rollout CSRF | `confirmationToken` must equal `experimentId` before mass price mutation |

---

## Analytics Engine

### Real-Time Layer (Redis)

- Unique visitors: `SADD uv:{expId}:{varId}:{date} {visitorId}` — `SCARD` for exact count.
- Unique sessions: same pattern with `us:` prefix.
- DailyMetric increments are atomic upserts on each event; derived rates recomputed inline.

### Aggregated Layer (PostgreSQL)

- Daily cron at `/api/cron/daily-metrics` aggregates the prior day's raw events into `DailyMetric`.
- Dashboard queries hit `DailyMetric` first; raw events queried only for ranges not yet aggregated.

### Statistical Significance

```
Two-proportion Z-test (conversion rates):
  z = (p1 - p2) / sqrt(p̂(1-p̂)(1/n1 + 1/n2))

Welch's t-test (revenue, AOV):
  t = (x̄1 - x̄2) / sqrt(s1²/n1 + s2²/n2)

Thresholds:
  p < 0.05 → significant (95% confidence)
  p < 0.01 → highly significant (99% confidence)

Peeking warning: fired if winner declared before 7 days of runtime.
```

### Segment Analysis

Available breakdown dimensions: `deviceType` (mobile/desktop/tablet), `country` (ISO 3166-1), `utmSource`.

Each segment dimension runs independent statistical tests on the sub-populations.

---

## Integrations

| Provider | Direction | Data sent |
|---|---|---|
| **GA4** | Outbound | Experiment assignments, custom events, conversions |
| **Klaviyo** | Outbound | Visitor properties, experiment assignments, revenue events |
| **Slack** | Outbound | Alerts: experiment started / winner found / completed |
| **Segment** | Outbound | Track + identify calls mirroring MarginLab events |
| **Elevar** | Outbound | Enhanced e-commerce data layer events |
| **Clarity** | Tag injection | Session recordings tagged with variant assignment |
| **Heap** | Outbound | Event tracking with variant properties |
| **Webhook** | Outbound | Full event payload over HTTPS, HMAC-SHA256 signed |
| **Recharge** | Inbound | Subscription data enrichment |

**Webhook signing:**
```
Header: X-MarginLab-Signature: sha256=<HMAC-SHA256(secret, JSON.stringify(payload))>
Retry:  [5s, 25s, 125s, 625s, 3125s] — 5 attempts, exponential backoff
```

---

## Security & Auth

- **Access tokens**: AES-256 encrypted at rest in PostgreSQL.
- **Integration API keys**: Same AES encryption in `integration.config`.
- **Shopify session JWTs**: HS256, validated on every admin API request (`aud`, `iss`, `dest`, `exp`).
- **Shopify webhooks**: HMAC-SHA256 over raw request body.
- **Outbound webhooks**: HMAC-SHA256 signed with merchant's secret.
- **Rate limiting**: Redis-backed per-visitorId (assignment) and per-shopDomain (config, events).
- **PII policy**: Raw events store opaque UUIDs for visitor/session — no names, emails, or personal identifiers. `ExperimentAssignment.context` stores device + country only.

---

## Performance & Caching

| Cache Key | TTL | Contents |
|---|---|---|
| `runtime:config:{shopDomain}` | 60s (SWR) | Full runtime config |
| `analytics:{experimentId}:{dateRange}` | Varies | Aggregated analytics results |
| `slack:{shopId}:{expId}:{type}` | 3600s | Slack alert deduplication |
| `uv:{expId}:{varId}:{date}` | 48h | Unique visitor Redis SET |
| `us:{expId}:{varId}:{date}` | 48h | Unique session Redis SET |

**Batch sizes:**
- Event ingestion: 100 events per `createMany` call.
- Analytics pagination: max 200 records per page.
- Price rollout: bulk variant update via Shopify `productVariantsBulkUpdate`.

---

---

# Non-Technical Reference

## What Does MarginLab Do?

MarginLab is a tool that helps Shopify store owners run **experiments** and **personalizations** to grow sales, improve the shopping experience, and understand what actually works — backed by real data instead of guesswork.

Think of it as a lab for your store. You can test two versions of something at the same time (a lower price vs. a higher price, a different headline, a discount offer), show each version to a different group of shoppers, and then measure which one made you more money. Everything is tracked automatically, and the app tells you whether the result is real or just random luck.

Beyond testing, MarginLab can also automatically show different experiences to different types of visitors — like a free shipping banner only to first-time buyers, or hiding a shipping option for a specific group you're testing.

---

## Features Explained Simply

### A/B Testing

You split your visitors into groups. Group A sees your current store. Group B sees the version you want to test. After enough visitors go through both groups, MarginLab tells you which one performed better and whether the result is statistically trustworthy (not just a coincidence).

There are 11 types of tests:

---

**Price Tests**

Test whether a different price point leads to more total revenue. For example: does $39.99 convert better than $44.99, even if the margin is lower? MarginLab either just shows the test price visually in the browser, or actually charges it through Shopify's native checkout system.

- Protected: You can't accidentally change your live prices without explicitly confirming by typing your experiment's ID as a safety step.
- Protected: Before any mass price change is applied, your original prices are saved automatically so you can revert with one click.

---

**Discount Tests**

Test different discount incentives side by side. "15% off" vs. "Free shipping" vs. "No discount at all." Measure which one drives the most orders, and more importantly, which one generates the most actual profit (since a bigger discount might mean more sales but less money in your pocket).

---

**Shipping Tests**

Test which shipping options you show at checkout. You can hide a specific shipping method (e.g., hide "Express Delivery" for group B) or rename it (e.g., rename "Standard" to "Free Delivery"). Shopify applies these changes inside checkout invisibly.

---

**Content Tests**

Change the words, button labels, colors, images, or layout for one group vs. another. For example: "Add to Cart" vs. "Get It Now." No coding needed — you describe what to change and where, and the platform applies it automatically.

---

**Split URL Tests**

Send half your visitors to your current page and the other half to a completely different page. Useful for testing a full redesign, a new landing page, or a different product description structure.

---

**Offer Tests**

Test whether showing a specific promotion widget (like a countdown timer, a "free shipping after $75" progress bar, or a "buy 2 get 1 free" banner) increases conversions or average order value.

---

**Checkout Block Tests**

Test which trust signals work best inside checkout — like showing "30-Day Money-Back Guarantee" badges to one group and not the other — and measure whether they reduce cart abandonment.

---

### Personalizations (Always-On Rules)

Unlike A/B tests (which are about finding a winner), personalizations are permanent rules that automatically show the right experience to the right person, every time.

**Examples:**
- Show a "Free Shipping to Canada" banner only to Canadian visitors.
- After 30 minutes of inactivity, show a gentle reminder widget with a discount code.
- On the thank-you page, show a post-purchase offer only to customers who spent over $100.
- Show a "Secure Checkout" badge only on mobile, where trust anxiety is higher.

You can target by country, device type, cart value, whether it's a first-time or returning visitor, which UTM campaign they came from, and more.

**Priority system:** If multiple rules match the same visitor, the highest-priority one wins. You control the order.

---

### Offer Library

A catalog of reusable promotions. Create an offer once and use it across multiple experiments and personalizations. Types include percentage discounts, fixed dollar amounts, free shipping thresholds, free gifts, volume discounts (buy 3 save 10%, buy 5 save 20%), buy X get Y, and tiered progress bars.

**Protected:** Once an offer is live, you can only change its name and appearance — not the discount itself. This prevents accidentally changing the terms of a promotion that's already running.

---

### Checkout Blocks

Widgets that appear inside Shopify's checkout flow. You can position them between checkout steps to increase trust and reduce drop-off. Types include trust badges, money-back guarantees, payment icons, social proof (e.g., "500 people bought this today"), urgency messages, and product upsell tiles.

---

### Profit Analytics

MarginLab goes beyond revenue. It calculates real profit by factoring in:
- **Cost of goods** — what you paid for the product (enter manually, import from Shopify, or upload a spreadsheet).
- **Actual shipping cost** — what it costs you to ship, not what the customer paid.
- **Payment processing fees** — e.g., Stripe or Shopify Payments fees.

This means you can compare test variants not just by "who made more sales" but by "who generated more actual profit per visitor."

---

### Custom Events

You can define your own events beyond standard shopping actions. For example: "clicked loyalty program link," "opened size guide," "used a coupon code." These become available as goals for your experiments, so you can measure exactly what matters to your business.

---

### Integrations

MarginLab connects to the tools you already use so your data flows automatically:
- **Google Analytics 4**: see which experiment variant each visitor was in, directly in GA4.
- **Klaviyo**: tag your email subscribers with their assigned variant for targeted follow-ups.
- **Slack**: get alerts when a test starts, when a winner is detected, or when a test ends.
- **Segment**: push all experiment and event data to your data warehouse or any connected tool.
- **Elevar, Microsoft Clarity, Heap**: session recordings and analytics automatically tagged with variant assignments.
- **Custom Webhooks**: send real-time data to any URL you control — Zapier, Make, your own server. Payloads are cryptographically signed so you can verify they came from MarginLab.

---

## How A/B Testing Works

Here's the full step-by-step of what happens when you run a test:

**1. You create the experiment.**
In the dashboard, you define what you're testing, set up your variants (control = current version, variant B = the change), and choose how much of your traffic participates (e.g., 80% enters the test, 20% are skipped entirely).

**2. You launch.**
MarginLab activates the test. If it's a discount or shipping test, it also tells Shopify's checkout system to apply the right rules automatically.

**3. A visitor arrives at your store.**
MarginLab's script runs invisibly. It checks whether the visitor qualifies for the test (based on your targeting rules — country, device, cart value, etc.), then uses their unique visitor ID to assign them to a variant. This assignment is permanent and consistent: they'll always see the same variant on every visit.

**4. The variant is applied.**
The visitor sees the test version — a different price, different copy, different offer — without knowing they're in a test.

**5. Every action is tracked.**
Page views, add to cart, checkout started, purchase completed. All recorded and linked to their variant.

**6. You check the results.**
The dashboard shows side-by-side performance for each variant. The system tells you if the difference is statistically significant — real, not random chance.

**7. You act.**
If variant B wins, you can apply the winning change to 100% of your store. If it's a price test, one click changes the price everywhere (with a backup so you can undo it).

---

## What Gets Protected & Validated

MarginLab has safeguards at every step to protect your store and your data:

**Before a test goes live:**
- Variant traffic percentages must add up to exactly 100%. If they don't, the system blocks saving.
- Every test must have exactly one "control" (the baseline you're comparing against).
- You can't run two tests that could interfere with each other (mutual exclusivity groups).
- Plan limits are enforced — the free plan allows one running test at a time.

**While a test is running:**
- You can't change the fundamental rules of a live test (no switching type, no changing variant allocations mid-experiment).
- You can't modify the discount rules of a live offer — only its name and how it looks.
- Completed or archived tests become read-only permanently.

**Financial safeguards:**
- Rolling out a winning price requires you to type your experiment ID as explicit confirmation — no accidental mass price changes.
- Your original prices are saved as a backup before any rollout, so you can restore them instantly.
- Each order is attributed to an experiment exactly once — no double-counting in your revenue metrics.

**Privacy safeguards:**
- Visitors are tracked with random anonymous IDs (UUIDs), not their name or email.
- The runtime script only collects behavioral data — never personal identifiers.
- Event collection pauses until the visitor accepts analytics cookies (consent-first).

**Performance safeguards:**
- The experiment configuration is served from a fast cache — not fetched from scratch on every page load.
- Events are collected in batches so they don't impact checkout speed.
- If the MarginLab script fails to load, the page shows normally after a short timeout. Your store never goes blank because of the A/B tool.

---

## Analytics & Reporting

**Per experiment, you see:**
- Visitors, sessions, orders per variant
- Conversion rate (% of visitors who bought)
- Average order value
- Revenue per visitor
- Profit per visitor (after cost of goods, shipping, and fees)
- Statistical confidence level
- Whether you have enough data to trust the result
- Day-by-day trends over the life of the test

**Segment breakdowns:** See how each variant performed specifically on mobile vs. desktop, by country, or by the source visitors came from (Google, Facebook, email, etc.).

**Funnel view:** Where do visitors drop off between product view → add to cart → checkout → purchase?

**Audit trail:** Every action taken in the app — creating a test, changing settings, launching, pausing, rolling out — is permanently recorded with a timestamp, who did it, and what the settings looked like before and after.

**Peeking warning:** The system warns you if you're looking at results too early and risks declaring a false winner. Checking results before enough data is collected is one of the most common A/B testing mistakes, and MarginLab flags it automatically.
