import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ExperimentTypeSchema = z.enum([
  "PRICE_TEST",
  "DISCOUNT_TEST",
  "SHIPPING_TEST",
  "OFFER_TEST",
  "COMBINATION_TEST",
  "CONTENT_TEST",
  "SPLIT_URL_TEST",
  "TEMPLATE_TEST",
  "THEME_TEST",
  "CHECKOUT_TEST",
  "PERSONALIZATION_TEST",
  "JAVASCRIPT_API_TEST",
]);

export const ExperimentStatusSchema = z.enum([
  "DRAFT",
  "QA",
  "PREVIEW",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

const TargetingConditionSchema = z.object({
  type: z.string(),
  operator: z.enum(["eq", "neq", "contains", "not_contains", "in", "not_in", "gte", "lte", "gt", "lt"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
});

const TargetingGroupSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  conditions: z.array(TargetingConditionSchema),
});

export const TargetingRulesSchema = z.array(TargetingGroupSchema);

// ---------------------------------------------------------------------------
// Content Modifications
// ---------------------------------------------------------------------------

export const ModificationTypeSchema = z.enum([
  "text_replace",
  "image_replace",
  "link_replace",
  "hide_element",
  "show_element",
  "insert_before",
  "insert_after",
  "replace_html",
  "add_class",
  "remove_class",
  "css_inject",
  "js_inject",
  "redirect",
]);

export const ModificationSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  type: ModificationTypeSchema,
  selector: z.string().optional(),
  value: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  url: z.string().optional(),
  preserveQueryParams: z.boolean().optional(),
});

export const ModificationsSchema = z.array(ModificationSchema);

// ---------------------------------------------------------------------------
// Price Config
// ---------------------------------------------------------------------------

export const PriceOverrideSchema = z.object({
  shopifyVariantId: z.string(),
  shopifyProductId: z.string(),
  price: z.string(), // Shopify uses string prices
  compareAtPrice: z.string().optional().nullable(),
});

export const PriceOverridesSchema = z.array(PriceOverrideSchema);

// ---------------------------------------------------------------------------
// Experiment Variant
// ---------------------------------------------------------------------------

export const CreateVariantSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with hyphens/underscores"),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  isControl: z.boolean().default(false),
  allocationPercent: z.number().min(0).max(100),
  // Stored as JSON — each experiment type uses its own modification shape
  modifications: z.array(z.record(z.unknown())).default([]),
  priceOverrides: PriceOverridesSchema.default([]),
  discountConfig: z.record(z.unknown()).optional().nullable(),
  redirectUrl: z.string().url().optional().nullable(),
  checkoutBlockIds: z.array(z.string()).default([]),
  offerIds: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).default({}),
});

export const UpdateVariantSchema = CreateVariantSchema.partial().omit({
  key: true,
  isControl: true,
});

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

export const CreateExperimentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  type: ExperimentTypeSchema,
  primaryMetric: z.string().default("conversion_rate"),
  secondaryMetrics: z.array(z.string()).default([]),
  trafficAllocation: z.number().min(0).max(100).default(100),
  assignmentStrategy: z.enum(["visitor", "session", "customer"]).default("visitor"),
  mutuallyExclusiveGroupId: z.string().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  targetingRules: TargetingRulesSchema.default([]),
  goals: z.array(z.record(z.unknown())).default([]),
  settings: z.record(z.unknown()).default({}),
  priceConfig: z.record(z.unknown()).optional().nullable(),
  discountConfig: z.record(z.unknown()).optional().nullable(),
  shippingConfig: z.record(z.unknown()).optional().nullable(),
  contentConfig: z.record(z.unknown()).optional().nullable(),
  splitUrlConfig: z.record(z.unknown()).optional().nullable(),
  variants: z.array(CreateVariantSchema).min(2, "At least 2 variants required"),
});

export const UpdateExperimentSchema = CreateExperimentSchema.partial().omit({
  variants: true,
});

// ---------------------------------------------------------------------------
// Runtime / Events
// ---------------------------------------------------------------------------

export const RuntimeEventSchema = z.object({
  shopDomain: z.string(),
  visitorId: z.string().min(1),
  sessionId: z.string().optional(),
  events: z.array(
    z.object({
      eventName: z.string().min(1).max(100),
      eventType: z.string(),
      experimentId: z.string().optional(),
      variantId: z.string().optional(),
      personalizationId: z.string().optional(),
      url: z.string().optional(),
      path: z.string().optional(),
      referrer: z.string().optional(),
      deviceType: z.string().optional(),
      country: z.string().optional(),
      currency: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
      utmTerm: z.string().optional(),
      metadata: z.record(z.unknown()).default({}),
      occurredAt: z.string().datetime(),
    })
  ),
});

export const AssignmentRequestSchema = z.object({
  shopDomain: z.string(),
  visitorId: z.string().min(1),
  sessionId: z.string().optional(),
  context: z.object({
    deviceType: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().optional(),
    url: z.string().optional(),
    path: z.string().optional(),
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    cartValue: z.number().optional(),
    cartProductIds: z.array(z.string()).optional(),
    isNewVisitor: z.boolean().optional(),
    isCustomerLoggedIn: z.boolean().optional(),
    forceVariants: z.record(z.string()).optional(), // { [experimentKey]: variantKey }
  }).default({}),
});

export const CartSyncSchema = z.object({
  shopDomain: z.string(),
  visitorId: z.string(),
  sessionId: z.string().optional(),
  cartToken: z.string(),
  assignments: z.array(
    z.object({
      experimentId: z.string(),
      variantId: z.string(),
      experimentSlug: z.string(),
      variantKey: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export const CreateOfferSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    "PERCENTAGE_DISCOUNT",
    "FIXED_AMOUNT_DISCOUNT",
    "PRODUCT_DISCOUNT",
    "ORDER_DISCOUNT",
    "FREE_SHIPPING",
    "FREE_GIFT",
    "VOLUME_DISCOUNT",
    "QUANTITY_BREAK",
    "BUY_X_GET_Y",
    "TIERED_PROGRESS_BAR",
    "CAMPAIGN_LINK_OFFER",
  ]),
  triggerRules: z.array(z.record(z.unknown())).default([]),
  discountRules: z.record(z.unknown()).default({}),
  displaySettings: z.record(z.unknown()).default({}),
  functionConfig: z.record(z.unknown()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Checkout Blocks
// ---------------------------------------------------------------------------

export const CreateCheckoutBlockSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    "TRUST_BADGES",
    "SOCIAL_PROOF",
    "GUARANTEE",
    "SHIPPING_MESSAGE",
    "PAYMENT_ICONS",
    "PRODUCT_UPSELL",
    "CUSTOM_CONTENT",
    "IMAGE_WITH_TEXT",
    "URGENCY_MESSAGE",
    "SECURITY_MESSAGE",
  ]),
  content: z.record(z.unknown()).default({}),
  styles: z.record(z.unknown()).default({}),
  targetingRules: TargetingRulesSchema.default([]),
  experimentId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  position: z.string().default("AFTER_CONTACT"),
});

// ---------------------------------------------------------------------------
// COGS
// ---------------------------------------------------------------------------

export const ProductCostSchema = z.object({
  shopifyProductId: z.string(),
  shopifyVariantId: z.string(),
  sku: z.string().optional(),
  cost: z.number().min(0),
  currencyCode: z.string().length(3).default("USD"),
});

export const BulkProductCostSchema = z.array(ProductCostSchema);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const ShopSettingsSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().optional(),
  estimatedShippingCost: z.number().min(0).optional(),
  transactionFeePercent: z.number().min(0).max(100).optional(),
  privacyConsentRequired: z.boolean().optional(),
  debugModeEnabled: z.boolean().optional(),
  antiFlickerEnabled: z.boolean().optional(),
  antiFlickerTimeout: z.number().min(0).max(5000).optional(),
});
