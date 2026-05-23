# Privacy Policy — MarginLab

_Last updated: 2025-01-01_

MarginLab ("we", "our", "the app") is built by and for Shopify merchants. This document describes exactly what data we collect, how we use it, and how we delete it — both in the ordinary course of business and in response to GDPR / privacy requests.

---

## 1. What data we collect

### 1.1 Storefront event data (Web Pixel + Theme Extension)

When a visitor browses a store with MarginLab installed, we record pseudonymous behavioral events:

| Field | Example | Notes |
|---|---|---|
| `visitorId` | `mlv_a3f8c…` | Random UUID generated in the browser, stored in `localStorage`. Not linked to email or identity. |
| `sessionId` | `mls_9b21d…` | Per-session random UUID. Rotated on tab close / 30-min inactivity. |
| `eventType` | `page_view`, `add_to_cart`, `checkout_started` | Enum value only. |
| `variantKey` | `price_high` | Which experiment branch was assigned. |
| `productId` | `8823…` (Shopify GID) | Shopify product GID, no product title stored. |
| `timestamp` | ISO 8601 UTC | When the event occurred. |
| `shopDomain` | `example.myshopify.com` | Identifies the merchant store. |

**We do NOT store:** raw email addresses, phone numbers, postal addresses, IP addresses, browser fingerprints, or any PII field from Shopify's Customer object.

### 1.2 Order attribution data

When an order is placed, we record:

| Field | Notes |
|---|---|
| `shopifyOrderId` | Shopify numeric order ID. |
| `shopifyCustomerId` | Shopify customer ID (opaque integer). No name, email, or address stored. |
| `visitorId` | Same pseudonymous ID from the storefront event. |
| `variantKey` | Which experiment variant the order is attributed to. |
| `revenueAmount` | Order subtotal in shop currency. |
| `timestamp` | When attribution was recorded. |

### 1.3 Merchant / shop data

| Field | Notes |
|---|---|
| `shopDomain` | e.g. `example.myshopify.com` |
| `installedAt` | When the merchant installed the app. |
| `accessToken` | Shopify offline access token (encrypted at rest). Used only for API calls on behalf of the merchant. |
| Billing records | Plan name, subscription status, Shopify charge ID. |
| Experiment configuration | Names, variants, targeting rules — created by the merchant. |

---

## 2. How we use the data

- **A/B testing analytics** — attributing conversion events to experiment variants so merchants can see lift/decline.
- **Billing enforcement** — checking usage counts against plan limits.
- **Fraud / abuse prevention** — rate-limiting and detecting anomalous traffic patterns.
- **App improvement** — aggregate, anonymised metrics (e.g. median events per store per day). No individual visitor data is used for this purpose.

We do **not** sell data to third parties, run cross-merchant profiling, or use visitor data for advertising.

---

## 3. Data retention

| Data type | Retention period |
|---|---|
| Storefront events (`Event` table) | 90 days rolling, then auto-deleted. |
| Order attributions (`OrderAttribution` table) | 1 year from order date, then auto-deleted. |
| Webhook logs (`WebhookLog` table) | 30 days rolling. |
| Experiment results (aggregated) | Retained for the life of the merchant's account. |
| Access tokens | Deleted immediately upon app uninstall (GDPR `shop/redact` webhook). |

---

## 4. GDPR webhooks

MarginLab implements all three mandatory Shopify GDPR webhooks:

### 4.1 `customers/data_request`

**Trigger:** A customer requests a copy of their data from the merchant.

**Our response:** We look up all `Event` rows and `OrderAttribution` rows that contain a `customerId` or `visitorId` matching the request. We **do not automatically export** this data — merchants can contact support@marginlab.io and we will provide an export within 30 days.

### 4.2 `customers/redact`

**Trigger:** A customer requests erasure ("right to be forgotten").

**Our response:** Within 24 hours of receiving this webhook, we:
1. Nullify the `customerId` field on all matching `OrderAttribution` rows (revenue aggregates are retained in anonymised form).
2. Delete all `Event` rows where the `visitorId` is deterministically linked to the customer (i.e. the customer was logged in during that session).

Because `visitorId` is a random UUID with no reverse mapping to PII, most visitor events cannot be linked back to a specific customer and therefore do not need to be deleted.

### 4.3 `shop/redact`

**Trigger:** 48 hours after a merchant uninstalls the app (Shopify compliance requirement).

**Our response:** We cascade-delete **all** data associated with the shop:
- All `Event` rows
- All `OrderAttribution` rows
- All `Experiment` rows (including variants and results)
- All `Offer`, `CheckoutBlock`, and `Integration` rows
- All `WebhookLog` rows
- The `Shop` record itself (Prisma `onDelete: Cascade` propagates to all child tables)
- The encrypted access token

After this deletion the shop has no recoverable data in our system.

---

## 5. Security

- All data is transmitted over TLS 1.2+.
- Database credentials and access tokens are stored as environment secrets, never in source code.
- Shopify webhook payloads are verified using HMAC-SHA256 before processing.
- Access to the admin API is scoped to the minimum required permissions (see `SCOPES.md`).

---

## 6. Sub-processors

| Processor | Purpose | Region |
|---|---|---|
| Shopify Inc. | Platform API, billing, webhooks | Global |
| Vercel / Railway / Fly.io | Application hosting | US / EU |
| PostgreSQL (Neon / Supabase) | Primary database | Configurable |

---

## 7. Contact

For privacy questions, data requests, or erasure requests:

- **Email:** privacy@marginlab.io
- **Response time:** We aim to respond within 5 business days and fulfil all verified requests within 30 days.
