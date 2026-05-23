# MarginLab — Architecture Overview

> Production-grade Shopify experimentation and profit optimization suite.
> Functional equivalent of Intelligems, built without copying any proprietary code, branding, or trade secrets.

---

## Project Structure

```
marginlab/
├── apps/
│   └── admin/                    # Next.js 15 App Router admin dashboard
│       ├── prisma/
│       │   └── schema.prisma     # Complete database schema (22+ models)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (dashboard)/  # Embedded Shopify Admin routes
│       │   │   │   ├── page.tsx                  # Dashboard
│       │   │   │   ├── experiments/              # Experiment CRUD
│       │   │   │   ├── price-tests/              # Price test UI
│       │   │   │   ├── discount-tests/           # Discount test UI
│       │   │   │   ├── shipping-tests/           # Shipping test UI
│       │   │   │   ├── offer-tests/              # Offer test UI
│       │   │   │   ├── content-tests/            # Content test UI
│       │   │   │   ├── checkout-tests/           # Checkout test UI
│       │   │   │   ├── personalizations/         # Personalization manager
│       │   │   │   ├── offers-library/           # Offers library
│       │   │   │   ├── checkout-blocks/          # Checkout block library
│       │   │   │   ├── analytics/                # Analytics dashboard
│       │   │   │   ├── cogs/                     # COGS & profit settings
│       │   │   │   ├── integrations/             # Integration management
│       │   │   │   ├── install-health/           # Install health checker
│       │   │   │   ├── debug/                    # Debug & QA tools
│       │   │   │   ├── settings/                 # App settings
│       │   │   │   └── audit-logs/               # Audit log viewer
│       │   │   └── api/
│       │   │       ├── experiments/              # Experiment CRUD API
│       │   │       ├── runtime/                  # Storefront runtime API
│       │   │       │   ├── config/               # GET /api/runtime/config
│       │   │       │   ├── events/               # POST /api/runtime/events
│       │   │       │   ├── assignment/           # POST /api/runtime/assignment
│       │   │       │   └── cart-sync/            # POST /api/runtime/cart-sync
│       │   │       ├── offers/                   # Offers CRUD
│       │   │       ├── checkout-blocks/          # Checkout blocks CRUD
│       │   │       ├── settings/                 # Settings API
│       │   │       └── webhooks/shopify/         # Shopify webhook handler
│       │   ├── components/
│       │   │   ├── ui/                           # Reusable UI components
│       │   │   │   ├── Badge.tsx
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── EmptyState.tsx
│       │   │   │   ├── Modal.tsx
│       │   │   │   ├── Skeleton.tsx
│       │   │   │   ├── Table.tsx
│       │   │   │   └── Toast.tsx
│       │   │   ├── experiments/                  # Experiment-specific components
│       │   │   ├── analytics/                    # Analytics charts
│       │   │   └── layout/                       # Sidebar, Header
│       │   ├── services/                         # Business logic layer
│       │   │   ├── experiment.service.ts         # Experiment CRUD & lifecycle
│       │   │   ├── analytics.service.ts          # Analytics queries
│       │   │   ├── audit-log.service.ts          # Audit logging
│       │   │   ├── event-ingestion.service.ts    # Event batch ingestion
│       │   │   ├── order-attribution.service.ts  # Order webhook processing
│       │   │   └── runtime-config.service.ts     # Runtime config builder
│       │   ├── lib/                              # Core utilities
│       │   │   ├── assignment.ts                 # Consistent hashing assignment
│       │   │   ├── targeting.ts                  # Targeting rule evaluator
│       │   │   ├── statistics.ts                 # Frequentist stats engine
│       │   │   ├── crypto.ts                     # AES-256-GCM encryption
│       │   │   ├── prisma.ts                     # Prisma client singleton
│       │   │   ├── redis.ts                      # Redis client + cache helpers
│       │   │   ├── shopify.ts                    # Shopify API client
│       │   │   ├── api-middleware.ts             # API auth middleware
│       │   │   ├── utils.ts                      # General utilities
│       │   │   └── zod-schemas.ts                # Request validation schemas
│       │   └── types/                            # TypeScript types
│       ├── .env.example                          # Environment variables template
│       ├── next.config.ts                        # Next.js configuration
│       ├── tailwind.config.ts                    # Tailwind configuration
│       └── tsconfig.json                         # TypeScript strict config
│
├── extensions/
│   ├── marginlab-theme/                          # Theme App Extension
│   │   ├── assets/
│   │   │   └── marginlab-runtime.js              # Storefront runtime script
│   │   ├── blocks/
│   │   │   └── app-embed.liquid                  # App embed block
│   │   └── shopify.extension.toml
│   │
│   ├── marginlab-pixel/                          # Web Pixel Extension
│   │   ├── src/index.ts                          # Pixel event subscribers
│   │   └── shopify.extension.toml
│   │
│   ├── marginlab-checkout/                       # Checkout UI Extension
│   │   ├── src/Checkout.tsx                      # Checkout block renderer
│   │   └── shopify.extension.toml
│   │
│   ├── marginlab-product-discount/               # Shopify Function: product discounts
│   │   ├── src/main.rs
│   │   └── shopify.extension.toml
│   │
│   ├── marginlab-order-discount/                 # Shopify Function: order discounts
│   │   └── shopify.extension.toml
│   │
│   ├── marginlab-shipping-discount/              # Shopify Function: shipping discounts
│   │   └── shopify.extension.toml
│   │
│   └── marginlab-delivery-customization/        # Shopify Function: delivery customization
│       ├── src/main.rs
│       └── shopify.extension.toml
│
├── package.json                                  # Monorepo root
└── ARCHITECTURE.md                               # This file
```

---

## Core Architecture Decisions

### 1. Assignment Engine

Variant assignment uses **consistent hashing** (djb2/SHA-256) so the same
visitor always gets the same variant without requiring a database lookup on
every page view. The hash is computed from `experimentId:variant:{visitorId}`.

The storefront runtime computes assignments client-side using the same algorithm
as the server-side `/api/runtime/assignment` endpoint. Assignments are persisted
to `localStorage` and synced to the database on first request for attribution.

### 2. Targeting Rules

Targeting is expressed as a JSON array of rule groups:
```json
[
  {
    "operator": "AND",
    "conditions": [
      { "type": "device", "operator": "eq", "value": "mobile" },
      { "type": "country", "operator": "in", "value": ["US", "CA"] }
    ]
  }
]
```

The same evaluator runs in both the TypeScript server (`lib/targeting.ts`) and
the vanilla JS storefront runtime (`marginlab-runtime.js`), ensuring consistency.

### 3. Order Attribution Hierarchy

```
1. Cart token (most reliable — set before checkout)
2. Checkout token
3. Customer ID (for returning customers)
4. Order note attributes (_ml_visitor_id)
```

The storefront runtime writes cart attributes before checkout using the Shopify
AJAX cart API, and also calls `/api/runtime/cart-sync` to persist the association
server-side.

### 4. Runtime Config Caching

The experiment config is cached in Redis with a 30-second TTL and served with
`stale-while-revalidate=60` HTTP headers. The storefront also caches in
`localStorage` with a 30-second TTL, revalidating in the background.

This means config propagation lag is max ~90 seconds after an experiment is launched.

### 5. Statistics

- **Conversion rate**: Two-proportion z-test (frequentist)
- **Revenue per visitor**: Welch's t-test approximation
- **Confidence levels**: 90%, 95%, 99%
- **Minimum samples**: Automatic warning below 100 visitors / 10 conversions
- **Bayesian probability**: Optional Bayesian P(B > A) alongside frequentist results

---

## Data Flow

```
Storefront (browser)
  │
  ├─ Fetch config → GET /api/runtime/config
  ├─ Assign variants → consistent hash (client-side)
  ├─ Apply DOM modifications
  ├─ Write cart attributes (before checkout)
  ├─ Sync cart → POST /api/runtime/cart-sync
  └─ Send events → POST /api/runtime/events

Web Pixel (Shopify sandbox)
  └─ Track checkout events → POST /api/runtime/events

Shopify Webhooks
  └─ orders/create → POST /api/webhooks/shopify → OrderAttributionService

Admin Dashboard (Next.js SSR)
  └─ Read from PostgreSQL → Display analytics, manage experiments
```

---

## Experiment Lifecycle

```
DRAFT → QA → PREVIEW → SCHEDULED → RUNNING → PAUSED → COMPLETED → ARCHIVED
         ↑____________↓
         (can move back for more QA)
```

**Key invariants:**
- Only `RUNNING` experiments are served in the runtime config
- `PREVIEW` and `QA` experiments are served but only assignable via force/preview params
- Completed experiments keep their assignments for attribution
- Archived experiments are excluded from all queries

---

## Implementation Phases

| Phase | Status | Features |
|-------|--------|---------|
| 1 | ✅ Scaffolded | Experiment CRUD, runtime, content tests, assignment engine |
| 2 | Pending | Order attribution, analytics, COGS, custom events |
| 3 | Pending | Offer library, discount testing, Shopify Functions for discounts |
| 4 | Pending | Shipping tests, free shipping threshold, delivery customization |
| 5 | Pending | Checkout UI Extension, checkout tests, checkout personalizations |
| 6 | Pending | Full price testing, multi-product, collection, rollout |
| 7 | Pending | Integrations (GA4, Klaviyo, Elevar, Clarity, Heap, Segment) |
| 8 | Pending | Theme/template tests, advanced QA, ClickHouse analytics adapter |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp apps/admin/.env.example apps/admin/.env.local
# Fill in: DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, SHOPIFY_API_KEY/SECRET

# 3. Set up database
npm run db:migrate

# 4. Start Next.js admin
npm run dev:admin
# Opens on http://localhost:3457

# 5. Start Shopify CLI dev (for extensions)
npm run dev
# Use the Shopify Partners tunnel URL as HOST
```

---

## Security Notes

- Shopify access tokens are encrypted at rest using AES-256-GCM
- Runtime API endpoints validate shop domain but are intentionally public (serve storefront)
- Admin API endpoints require Shopify session validation via App Bridge JWT
- Webhook HMAC is validated before processing
- All inputs validated with Zod before reaching service layer
- HTML content modifications strip `<script>` tags (DOMPurify recommended for production)
- No Admin API tokens in frontend code
- GDPR webhook handlers implemented for App Store compliance
