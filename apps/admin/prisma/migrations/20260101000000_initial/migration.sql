-- MarginLab — Initial schema migration
-- This is the baseline migration that captures the full initial schema.
-- Generated from prisma/schema.prisma on 2026-01-01.

-- Enable pgcrypto for UUID functions (if used elsewhere)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "ExperimentType" AS ENUM (
  'PRICE_TEST',
  'DISCOUNT_TEST',
  'SHIPPING_TEST',
  'OFFER_TEST',
  'COMBINATION_TEST',
  'CONTENT_TEST',
  'SPLIT_URL_TEST',
  'TEMPLATE_TEST',
  'THEME_TEST',
  'CHECKOUT_TEST',
  'PERSONALIZATION_TEST',
  'JAVASCRIPT_API_TEST'
);

CREATE TYPE "ExperimentStatus" AS ENUM (
  'DRAFT',
  'QA',
  'PREVIEW',
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "PersonalizationType" AS ENUM (
  'OFFER',
  'CHECKOUT',
  'CONTENT',
  'PRICE_DISPLAY',
  'BANNER',
  'SHIPPING_MESSAGE',
  'ABANDONED_CART',
  'POST_PURCHASE'
);

CREATE TYPE "PersonalizationStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'SCHEDULED',
  'ARCHIVED'
);

CREATE TYPE "OfferType" AS ENUM (
  'PERCENTAGE_DISCOUNT',
  'FIXED_AMOUNT_DISCOUNT',
  'PRODUCT_DISCOUNT',
  'ORDER_DISCOUNT',
  'FREE_SHIPPING',
  'FREE_GIFT',
  'VOLUME_DISCOUNT',
  'QUANTITY_BREAK',
  'BUY_X_GET_Y',
  'TIERED_PROGRESS_BAR',
  'CAMPAIGN_LINK_OFFER'
);

CREATE TYPE "CheckoutBlockType" AS ENUM (
  'TRUST_BADGES',
  'SOCIAL_PROOF',
  'GUARANTEE',
  'SHIPPING_MESSAGE',
  'PAYMENT_ICONS',
  'PRODUCT_UPSELL',
  'CUSTOM_CONTENT',
  'IMAGE_WITH_TEXT',
  'URGENCY_MESSAGE',
  'SECURITY_MESSAGE'
);

CREATE TYPE "EventType" AS ENUM (
  'PAGE_VIEW',
  'PRODUCT_VIEW',
  'COLLECTION_VIEW',
  'SEARCH',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CART_VIEW',
  'CHECKOUT_STARTED',
  'CHECKOUT_STEP_VIEWED',
  'PAYMENT_INFO_SUBMITTED',
  'CHECKOUT_COMPLETED',
  'CUSTOM',
  'CHECKOUT_BLOCK_RENDERED',
  'OFFER_VIEWED',
  'OFFER_CLAIMED',
  'PRICE_VIEWED'
);

CREATE TYPE "IntegrationProvider" AS ENUM (
  'GA4',
  'KLAVIYO',
  'ELEVAR',
  'CLARITY',
  'HEAP',
  'SEGMENT',
  'RECHARGE',
  'WEBHOOK',
  'SLACK'
);

CREATE TYPE "IntegrationStatus" AS ENUM (
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
  'PENDING'
);

CREATE TYPE "ProductCostSource" AS ENUM (
  'SHOPIFY_API',
  'MANUAL',
  'CSV_IMPORT'
);

CREATE TYPE "PlanStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'DECLINED',
  'EXPIRED',
  'FROZEN',
  'CANCELLED',
  'PENDING'
);

CREATE TYPE "AssignmentSource" AS ENUM (
  'COOKIE',
  'URL_PARAM',
  'CART_ATTRIBUTE',
  'CUSTOMER_ID',
  'SERVER_SIDE'
);

-- ---------------------------------------------------------------------------
-- Shop
-- ---------------------------------------------------------------------------

CREATE TABLE "Shop" (
  "id"                   TEXT NOT NULL,
  "shopDomain"           TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "scopes"               TEXT[] NOT NULL DEFAULT '{}',
  "timezone"             TEXT NOT NULL DEFAULT 'UTC',
  "currencyCode"         TEXT NOT NULL DEFAULT 'USD',
  "planName"             TEXT,
  "installedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uninstalledAt"        TIMESTAMP(3),
  "settings"             JSONB NOT NULL DEFAULT '{}',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  "sessionId"            TEXT,

  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
CREATE INDEX "Shop_shopDomain_idx" ON "Shop"("shopDomain");

-- ---------------------------------------------------------------------------
-- MutuallyExclusiveGroup
-- ---------------------------------------------------------------------------

CREATE TABLE "MutuallyExclusiveGroup" (
  "id"          TEXT NOT NULL,
  "shopId"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MutuallyExclusiveGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MutuallyExclusiveGroup_shopId_idx" ON "MutuallyExclusiveGroup"("shopId");

-- ---------------------------------------------------------------------------
-- Experiment
-- ---------------------------------------------------------------------------

CREATE TABLE "Experiment" (
  "id"                       TEXT NOT NULL,
  "shopId"                   TEXT NOT NULL,
  "name"                     TEXT NOT NULL,
  "slug"                     TEXT NOT NULL,
  "description"              TEXT,
  "hypothesis"               TEXT,
  "type"                     "ExperimentType" NOT NULL,
  "status"                   "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "primaryMetric"            TEXT NOT NULL DEFAULT 'conversion_rate',
  "secondaryMetrics"         TEXT[] NOT NULL DEFAULT '{}',
  "trafficAllocation"        DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  "assignmentStrategy"       TEXT NOT NULL DEFAULT 'visitor',
  "mutuallyExclusiveGroupId" TEXT,
  "startsAt"                 TIMESTAMP(3),
  "endsAt"                   TIMESTAMP(3),
  "launchedAt"               TIMESTAMP(3),
  "pausedAt"                 TIMESTAMP(3),
  "completedAt"              TIMESTAMP(3),
  "targetingRules"           JSONB NOT NULL DEFAULT '[]',
  "goals"                    JSONB NOT NULL DEFAULT '[]',
  "settings"                 JSONB NOT NULL DEFAULT '{}',
  "priceConfig"              JSONB,
  "discountConfig"           JSONB,
  "shippingConfig"           JSONB,
  "contentConfig"            JSONB,
  "splitUrlConfig"           JSONB,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Experiment_shopId_slug_key" ON "Experiment"("shopId", "slug");
CREATE INDEX "Experiment_shopId_status_idx" ON "Experiment"("shopId", "status");
CREATE INDEX "Experiment_shopId_type_idx" ON "Experiment"("shopId", "type");

-- ---------------------------------------------------------------------------
-- ExperimentVariant
-- ---------------------------------------------------------------------------

CREATE TABLE "ExperimentVariant" (
  "id"                TEXT NOT NULL,
  "experimentId"      TEXT NOT NULL,
  "shopId"            TEXT NOT NULL,
  "key"               TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "isControl"         BOOLEAN NOT NULL DEFAULT false,
  "allocationPercent" DOUBLE PRECISION NOT NULL,
  "modifications"     JSONB NOT NULL DEFAULT '[]',
  "priceOverrides"    JSONB NOT NULL DEFAULT '[]',
  "discountConfig"    JSONB,
  "redirectUrl"       TEXT,
  "checkoutBlockIds"  TEXT[] NOT NULL DEFAULT '{}',
  "offerIds"          TEXT[] NOT NULL DEFAULT '{}',
  "settings"          JSONB NOT NULL DEFAULT '{}',
  "previewToken"      TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperimentVariant_previewToken_key" ON "ExperimentVariant"("previewToken");
CREATE UNIQUE INDEX "ExperimentVariant_experimentId_key_key" ON "ExperimentVariant"("experimentId", "key");
CREATE INDEX "ExperimentVariant_experimentId_idx" ON "ExperimentVariant"("experimentId");

-- ---------------------------------------------------------------------------
-- ExperimentAssignment
-- ---------------------------------------------------------------------------

CREATE TABLE "ExperimentAssignment" (
  "id"           TEXT NOT NULL,
  "shopId"       TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "variantId"    TEXT NOT NULL,
  "visitorId"    TEXT NOT NULL,
  "sessionId"    TEXT,
  "cartToken"    TEXT,
  "checkoutToken" TEXT,
  "customerId"   TEXT,
  "source"       "AssignmentSource" NOT NULL DEFAULT 'COOKIE',
  "landingPage"  TEXT,
  "referrer"     TEXT,
  "deviceType"   TEXT,
  "country"      TEXT,
  "utmSource"    TEXT,
  "utmMedium"    TEXT,
  "utmCampaign"  TEXT,
  "firstSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperimentAssignment_experimentId_visitorId_key" ON "ExperimentAssignment"("experimentId", "visitorId");
CREATE INDEX "ExperimentAssignment_shopId_visitorId_idx" ON "ExperimentAssignment"("shopId", "visitorId");
CREATE INDEX "ExperimentAssignment_experimentId_idx" ON "ExperimentAssignment"("experimentId");
CREATE INDEX "ExperimentAssignment_cartToken_idx" ON "ExperimentAssignment"("cartToken");
CREATE INDEX "ExperimentAssignment_checkoutToken_idx" ON "ExperimentAssignment"("checkoutToken");
CREATE INDEX "ExperimentAssignment_customerId_idx" ON "ExperimentAssignment"("customerId");

-- ---------------------------------------------------------------------------
-- Personalization
-- ---------------------------------------------------------------------------

CREATE TABLE "Personalization" (
  "id"              TEXT NOT NULL,
  "shopId"          TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "type"            "PersonalizationType" NOT NULL,
  "status"          "PersonalizationStatus" NOT NULL DEFAULT 'DRAFT',
  "priority"        INTEGER NOT NULL DEFAULT 0,
  "targetingRules"  JSONB NOT NULL DEFAULT '[]',
  "modifications"   JSONB NOT NULL DEFAULT '[]',
  "offerIds"        TEXT[] NOT NULL DEFAULT '{}',
  "checkoutBlockIds" TEXT[] NOT NULL DEFAULT '{}',
  "startsAt"        TIMESTAMP(3),
  "endsAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Personalization_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Personalization_shopId_status_idx" ON "Personalization"("shopId", "status");
CREATE INDEX "Personalization_shopId_type_idx" ON "Personalization"("shopId", "type");

-- ---------------------------------------------------------------------------
-- Offer
-- ---------------------------------------------------------------------------

CREATE TABLE "Offer" (
  "id"                TEXT NOT NULL,
  "shopId"            TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "type"              "OfferType" NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "triggerRules"      JSONB NOT NULL DEFAULT '[]',
  "discountRules"     JSONB NOT NULL DEFAULT '{}',
  "displaySettings"   JSONB NOT NULL DEFAULT '{}',
  "functionConfig"    JSONB,
  "shopifyFunctionId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Offer_shopId_status_idx" ON "Offer"("shopId", "status");
CREATE INDEX "Offer_shopId_type_idx" ON "Offer"("shopId", "type");

-- ---------------------------------------------------------------------------
-- CheckoutBlock
-- ---------------------------------------------------------------------------

CREATE TABLE "CheckoutBlock" (
  "id"             TEXT NOT NULL,
  "shopId"         TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "type"           "CheckoutBlockType" NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "content"        JSONB NOT NULL DEFAULT '{}',
  "styles"         JSONB NOT NULL DEFAULT '{}',
  "targetingRules" JSONB NOT NULL DEFAULT '[]',
  "experimentId"   TEXT,
  "variantId"      TEXT,
  "position"       TEXT NOT NULL DEFAULT 'AFTER_CONTACT',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CheckoutBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckoutBlock_shopId_status_idx" ON "CheckoutBlock"("shopId", "status");
CREATE INDEX "CheckoutBlock_shopId_type_idx" ON "CheckoutBlock"("shopId", "type");

-- ---------------------------------------------------------------------------
-- Event
-- ---------------------------------------------------------------------------

CREATE TABLE "Event" (
  "id"                TEXT NOT NULL,
  "shopId"            TEXT NOT NULL,
  "experimentId"      TEXT,
  "variantId"         TEXT,
  "personalizationId" TEXT,
  "visitorId"         TEXT NOT NULL,
  "sessionId"         TEXT,
  "eventName"         TEXT NOT NULL,
  "eventType"         "EventType" NOT NULL,
  "url"               TEXT,
  "path"              TEXT,
  "referrer"          TEXT,
  "deviceType"        TEXT,
  "country"           TEXT,
  "currency"          TEXT,
  "userAgentHash"     TEXT,
  "utmSource"         TEXT,
  "utmMedium"         TEXT,
  "utmCampaign"       TEXT,
  "utmContent"        TEXT,
  "utmTerm"           TEXT,
  "metadata"          JSONB NOT NULL DEFAULT '{}',
  "occurredAt"        TIMESTAMP(3) NOT NULL,
  "receivedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_shopId_eventType_idx" ON "Event"("shopId", "eventType");
CREATE INDEX "Event_shopId_experimentId_idx" ON "Event"("shopId", "experimentId");
CREATE INDEX "Event_shopId_visitorId_idx" ON "Event"("shopId", "visitorId");
CREATE INDEX "Event_occurredAt_idx" ON "Event"("occurredAt");

-- ---------------------------------------------------------------------------
-- CustomEvent
-- ---------------------------------------------------------------------------

CREATE TABLE "CustomEvent" (
  "id"          TEXT NOT NULL,
  "shopId"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "schema"      JSONB NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomEvent_shopId_name_key" ON "CustomEvent"("shopId", "name");
CREATE INDEX "CustomEvent_shopId_idx" ON "CustomEvent"("shopId");

-- ---------------------------------------------------------------------------
-- OrderAttribution
-- ---------------------------------------------------------------------------

CREATE TABLE "OrderAttribution" (
  "id"                    TEXT NOT NULL,
  "shopId"                TEXT NOT NULL,
  "shopifyOrderId"        TEXT NOT NULL,
  "shopifyOrderName"      TEXT NOT NULL,
  "experimentId"          TEXT,
  "variantId"             TEXT,
  "personalizationId"     TEXT,
  "visitorId"             TEXT,
  "sessionId"             TEXT,
  "cartToken"             TEXT,
  "checkoutToken"         TEXT,
  "customerId"            TEXT,
  "subtotalPrice"         DOUBLE PRECISION NOT NULL,
  "totalPrice"            DOUBLE PRECISION NOT NULL,
  "totalDiscounts"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalShipping"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalTax"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netRevenue"            DOUBLE PRECISION NOT NULL,
  "currencyCode"          TEXT NOT NULL DEFAULT 'USD',
  "financialStatus"       TEXT,
  "fulfillmentStatus"     TEXT,
  "cogs"                  DOUBLE PRECISION,
  "estimatedShippingCost" DOUBLE PRECISION,
  "transactionFee"        DOUBLE PRECISION,
  "grossProfit"           DOUBLE PRECISION,
  "contributionMargin"    DOUBLE PRECISION,
  "lineItems"             JSONB NOT NULL DEFAULT '[]',
  "attributedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderAttribution_shopId_shopifyOrderId_key" ON "OrderAttribution"("shopId", "shopifyOrderId");
CREATE INDEX "OrderAttribution_shopId_experimentId_idx" ON "OrderAttribution"("shopId", "experimentId");
CREATE INDEX "OrderAttribution_shopId_visitorId_idx" ON "OrderAttribution"("shopId", "visitorId");
CREATE INDEX "OrderAttribution_cartToken_idx" ON "OrderAttribution"("cartToken");
CREATE INDEX "OrderAttribution_checkoutToken_idx" ON "OrderAttribution"("checkoutToken");

-- ---------------------------------------------------------------------------
-- ProductCost
-- ---------------------------------------------------------------------------

CREATE TABLE "ProductCost" (
  "id"               TEXT NOT NULL,
  "shopId"           TEXT NOT NULL,
  "shopifyProductId" TEXT NOT NULL,
  "shopifyVariantId" TEXT NOT NULL,
  "sku"              TEXT,
  "cost"             DOUBLE PRECISION NOT NULL,
  "currencyCode"     TEXT NOT NULL DEFAULT 'USD',
  "source"           "ProductCostSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCost_shopifyVariantId_key" ON "ProductCost"("shopifyVariantId");
CREATE INDEX "ProductCost_shopId_idx" ON "ProductCost"("shopId");
CREATE INDEX "ProductCost_shopId_shopifyProductId_idx" ON "ProductCost"("shopId", "shopifyProductId");

-- ---------------------------------------------------------------------------
-- DailyMetric
-- ---------------------------------------------------------------------------

CREATE TABLE "DailyMetric" (
  "id"                TEXT NOT NULL,
  "shopId"            TEXT NOT NULL,
  "experimentId"      TEXT,
  "variantId"         TEXT,
  "date"              DATE NOT NULL,
  "visitors"          INTEGER NOT NULL DEFAULT 0,
  "sessions"          INTEGER NOT NULL DEFAULT 0,
  "pageViews"         INTEGER NOT NULL DEFAULT 0,
  "productViews"      INTEGER NOT NULL DEFAULT 0,
  "addToCarts"        INTEGER NOT NULL DEFAULT 0,
  "checkoutsStarted"  INTEGER NOT NULL DEFAULT 0,
  "orders"            INTEGER NOT NULL DEFAULT 0,
  "revenue"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netRevenue"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discounts"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shippingRevenue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cogs"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossProfit"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversionRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "addToCartRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "checkoutRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aov"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "revenuePerVisitor" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profitPerVisitor"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata"          JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyMetric_shopId_experimentId_variantId_date_key" ON "DailyMetric"("shopId", "experimentId", "variantId", "date");
CREATE INDEX "DailyMetric_shopId_date_idx" ON "DailyMetric"("shopId", "date");
CREATE INDEX "DailyMetric_experimentId_date_idx" ON "DailyMetric"("experimentId", "date");

-- ---------------------------------------------------------------------------
-- Integration
-- ---------------------------------------------------------------------------

CREATE TABLE "Integration" (
  "id"              TEXT NOT NULL,
  "shopId"          TEXT NOT NULL,
  "provider"        "IntegrationProvider" NOT NULL,
  "status"          "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "configEncrypted" TEXT,
  "publicConfig"    JSONB NOT NULL DEFAULT '{}',
  "lastSyncAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Integration_shopId_provider_key" ON "Integration"("shopId", "provider");
CREATE INDEX "Integration_shopId_idx" ON "Integration"("shopId");

-- ---------------------------------------------------------------------------
-- Session (Shopify session storage)
-- ---------------------------------------------------------------------------

CREATE TABLE "Session" (
  "id"            TEXT NOT NULL,
  "shop"          TEXT NOT NULL,
  "state"         TEXT NOT NULL,
  "isOnline"      BOOLEAN NOT NULL DEFAULT false,
  "scope"         TEXT,
  "expires"       TIMESTAMP(3),
  "accessToken"   TEXT NOT NULL,
  "userId"        BIGINT,
  "firstName"     TEXT,
  "lastName"      TEXT,
  "email"         TEXT,
  "accountOwner"  BOOLEAN NOT NULL DEFAULT false,
  "locale"        TEXT,
  "collaborator"  BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- AuditLog
-- ---------------------------------------------------------------------------

CREATE TABLE "AuditLog" (
  "id"         TEXT NOT NULL,
  "shopId"     TEXT NOT NULL,
  "actorId"    TEXT,
  "actorEmail" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "entityName" TEXT,
  "action"     TEXT NOT NULL,
  "before"     JSONB,
  "after"      JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt" DESC);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- ---------------------------------------------------------------------------
-- WebhookLog
-- ---------------------------------------------------------------------------

CREATE TABLE "WebhookLog" (
  "id"          TEXT NOT NULL,
  "shopId"      TEXT NOT NULL,
  "topic"       TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'received',
  "error"       TEXT,
  "processedAt" TIMESTAMP(3),
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookLog_shopId_topic_idx" ON "WebhookLog"("shopId", "topic");
CREATE INDEX "WebhookLog_status_idx" ON "WebhookLog"("status");

-- ---------------------------------------------------------------------------
-- ShopPlan
-- ---------------------------------------------------------------------------

CREATE TABLE "ShopPlan" (
  "id"                 TEXT NOT NULL,
  "shopId"             TEXT NOT NULL,
  "planKey"            TEXT NOT NULL DEFAULT 'free',
  "status"             "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "shopifyChargeId"    TEXT,
  "trialEndsAt"        TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd"   TIMESTAMP(3),
  "cancelledAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopPlan_shopId_key" ON "ShopPlan"("shopId");
CREATE UNIQUE INDEX "ShopPlan_shopifyChargeId_key" ON "ShopPlan"("shopifyChargeId");
CREATE INDEX "ShopPlan_shopId_idx" ON "ShopPlan"("shopId");

-- ---------------------------------------------------------------------------
-- Foreign Keys
-- ---------------------------------------------------------------------------

ALTER TABLE "MutuallyExclusiveGroup"
  ADD CONSTRAINT "MutuallyExclusiveGroup_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Experiment"
  ADD CONSTRAINT "Experiment_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Experiment_mutuallyExclusiveGroupId_fkey"
  FOREIGN KEY ("mutuallyExclusiveGroupId") REFERENCES "MutuallyExclusiveGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExperimentVariant"
  ADD CONSTRAINT "ExperimentVariant_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExperimentVariant_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentAssignment"
  ADD CONSTRAINT "ExperimentAssignment_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExperimentAssignment_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Personalization"
  ADD CONSTRAINT "Personalization_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckoutBlock"
  ADD CONSTRAINT "CheckoutBlock_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_personalizationId_fkey"
  FOREIGN KEY ("personalizationId") REFERENCES "Personalization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomEvent"
  ADD CONSTRAINT "CustomEvent_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderAttribution"
  ADD CONSTRAINT "OrderAttribution_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrderAttribution_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "OrderAttribution_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "OrderAttribution_personalizationId_fkey"
  FOREIGN KEY ("personalizationId") REFERENCES "Personalization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductCost"
  ADD CONSTRAINT "ProductCost_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyMetric"
  ADD CONSTRAINT "DailyMetric_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DailyMetric_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DailyMetric_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Integration"
  ADD CONSTRAINT "Integration_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookLog"
  ADD CONSTRAINT "WebhookLog_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopPlan"
  ADD CONSTRAINT "ShopPlan_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
