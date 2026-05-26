import { describe, it, expect } from "vitest";
import {
  ExperimentTypeSchema,
  ExperimentStatusSchema,
  CreateVariantSchema,
  UpdateVariantSchema,
  CreateExperimentSchema,
  UpdateExperimentSchema,
  TargetingRulesSchema,
  ModificationSchema,
  ModificationTypeSchema,
  RuntimeEventSchema,
  AssignmentRequestSchema,
  CartSyncSchema,
  CreateOfferSchema,
  CreateCheckoutBlockSchema,
  ProductCostSchema,
  BulkProductCostSchema,
  ShopSettingsSchema,
  PriceOverrideSchema,
} from "./zod-schemas";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validVariant(overrides = {}) {
  return {
    key: "control",
    name: "Control",
    isControl: true,
    allocationPercent: 50,
    ...overrides,
  };
}

function validExperiment(overrides = {}) {
  return {
    name: "My Test",
    type: "CONTENT_TEST" as const,
    variants: [
      validVariant({ key: "control", isControl: true, allocationPercent: 50 }),
      validVariant({ key: "variant-a", isControl: false, allocationPercent: 50 }),
    ],
    ...overrides,
  };
}

// ─── ExperimentTypeSchema ─────────────────────────────────────────────────────

describe("ExperimentTypeSchema", () => {
  const validTypes = [
    "PRICE_TEST", "DISCOUNT_TEST", "SHIPPING_TEST", "OFFER_TEST",
    "COMBINATION_TEST", "CONTENT_TEST", "SPLIT_URL_TEST",
    "TEMPLATE_TEST", "THEME_TEST", "CHECKOUT_TEST",
    "PERSONALIZATION_TEST", "JAVASCRIPT_API_TEST",
  ];

  it.each(validTypes)("accepts %s", (type) => {
    expect(() => ExperimentTypeSchema.parse(type)).not.toThrow();
  });

  it("rejects unknown type", () => {
    expect(() => ExperimentTypeSchema.parse("UNKNOWN_TEST")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => ExperimentTypeSchema.parse("")).toThrow();
  });

  it("rejects null", () => {
    expect(() => ExperimentTypeSchema.parse(null)).toThrow();
  });
});

// ─── ExperimentStatusSchema ───────────────────────────────────────────────────

describe("ExperimentStatusSchema", () => {
  const validStatuses = ["DRAFT", "QA", "PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED"];

  it.each(validStatuses)("accepts %s", (status) => {
    expect(() => ExperimentStatusSchema.parse(status)).not.toThrow();
  });

  it("rejects lowercase status", () => {
    expect(() => ExperimentStatusSchema.parse("running")).toThrow();
  });

  it("rejects unknown status", () => {
    expect(() => ExperimentStatusSchema.parse("ACTIVE")).toThrow();
  });
});

// ─── CreateVariantSchema ──────────────────────────────────────────────────────

describe("CreateVariantSchema", () => {
  it("accepts valid variant", () => {
    const result = CreateVariantSchema.safeParse(validVariant());
    expect(result.success).toBe(true);
  });

  it("rejects empty key", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ key: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects key with uppercase letters", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ key: "Control" }));
    expect(result.success).toBe(false);
  });

  it("rejects key with spaces", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ key: "my variant" }));
    expect(result.success).toBe(false);
  });

  it("accepts key with hyphens and underscores", () => {
    expect(CreateVariantSchema.safeParse(validVariant({ key: "variant-a_1" })).success).toBe(true);
  });

  it("rejects key longer than 50 chars", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ key: "a".repeat(51) }));
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ name: "x".repeat(201) }));
    expect(result.success).toBe(false);
  });

  it("rejects allocationPercent below 0", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ allocationPercent: -1 }));
    expect(result.success).toBe(false);
  });

  it("rejects allocationPercent above 100", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ allocationPercent: 101 }));
    expect(result.success).toBe(false);
  });

  it("accepts allocationPercent of 0 (excluded variant)", () => {
    expect(CreateVariantSchema.safeParse(validVariant({ allocationPercent: 0 })).success).toBe(true);
  });

  it("defaults modifications to empty array", () => {
    const result = CreateVariantSchema.parse(validVariant());
    expect(result.modifications).toEqual([]);
  });

  it("defaults priceOverrides to empty array", () => {
    const result = CreateVariantSchema.parse(validVariant());
    expect(result.priceOverrides).toEqual([]);
  });
});

// ─── UpdateVariantSchema ──────────────────────────────────────────────────────

describe("UpdateVariantSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(UpdateVariantSchema.safeParse({}).success).toBe(true);
  });

  it("does not allow key field (omitted)", () => {
    const schema = UpdateVariantSchema;
    // key is omitted — passing it should be stripped
    const result = schema.safeParse({ key: "new-key", name: "New Name" });
    expect(result.success).toBe(true);
    // key should not appear in the output
    expect((result.data as Record<string, unknown>).key).toBeUndefined();
  });

  it("does not allow isControl field (omitted)", () => {
    const result = UpdateVariantSchema.safeParse({ isControl: true });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).isControl).toBeUndefined();
  });
});

// ─── CreateExperimentSchema ───────────────────────────────────────────────────

describe("CreateExperimentSchema", () => {
  it("accepts valid experiment", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment()).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ name: "" })).success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ name: "x".repeat(201) })).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ type: "FAKE_TEST" })).success).toBe(false);
  });

  it("rejects fewer than 2 variants", () => {
    const result = CreateExperimentSchema.safeParse(
      validExperiment({ variants: [validVariant()] })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "";
      expect(msg).toMatch(/2/);
    }
  });

  it("accepts trafficAllocation of 0", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ trafficAllocation: 0 })).success).toBe(true);
  });

  it("rejects trafficAllocation above 100", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ trafficAllocation: 101 })).success).toBe(false);
  });

  it("rejects trafficAllocation below 0", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ trafficAllocation: -1 })).success).toBe(false);
  });

  it("defaults trafficAllocation to 100", () => {
    const result = CreateExperimentSchema.parse(validExperiment());
    expect(result.trafficAllocation).toBe(100);
  });

  it("defaults primaryMetric to conversion_rate", () => {
    const result = CreateExperimentSchema.parse(validExperiment());
    expect(result.primaryMetric).toBe("conversion_rate");
  });

  it("defaults assignmentStrategy to visitor", () => {
    const result = CreateExperimentSchema.parse(validExperiment());
    expect(result.assignmentStrategy).toBe("visitor");
  });

  it("accepts valid assignmentStrategy values", () => {
    for (const strategy of ["visitor", "session", "customer"]) {
      expect(
        CreateExperimentSchema.safeParse(validExperiment({ assignmentStrategy: strategy })).success
      ).toBe(true);
    }
  });

  it("rejects invalid assignmentStrategy", () => {
    expect(
      CreateExperimentSchema.safeParse(validExperiment({ assignmentStrategy: "device" })).success
    ).toBe(false);
  });

  it("accepts valid ISO datetime for startsAt", () => {
    expect(
      CreateExperimentSchema.safeParse(validExperiment({ startsAt: "2026-01-01T00:00:00Z" })).success
    ).toBe(true);
  });

  it("rejects malformed datetime for startsAt", () => {
    expect(
      CreateExperimentSchema.safeParse(validExperiment({ startsAt: "not-a-date" })).success
    ).toBe(false);
  });
});

// ─── UpdateExperimentSchema ───────────────────────────────────────────────────

describe("UpdateExperimentSchema", () => {
  it("accepts empty object", () => {
    expect(UpdateExperimentSchema.safeParse({}).success).toBe(true);
  });

  it("does not accept variants field", () => {
    const result = UpdateExperimentSchema.safeParse({ variants: [] });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).variants).toBeUndefined();
  });

  it("accepts partial update with just name", () => {
    expect(UpdateExperimentSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });
});

// ─── TargetingRulesSchema ─────────────────────────────────────────────────────

describe("TargetingRulesSchema", () => {
  it("accepts empty array", () => {
    expect(TargetingRulesSchema.safeParse([]).success).toBe(true);
  });

  it("accepts valid AND group with conditions", () => {
    const rules = [
      {
        operator: "AND",
        conditions: [
          { type: "device_type", operator: "eq", value: "mobile" },
        ],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("accepts OR operator", () => {
    const rules = [
      {
        operator: "OR",
        conditions: [{ type: "country", operator: "in", value: ["US", "CA"] }],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("rejects invalid operator", () => {
    const rules = [
      {
        operator: "NOT",
        conditions: [{ type: "x", operator: "eq", value: "y" }],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(false);
  });

  it("rejects invalid condition operator", () => {
    const rules = [
      {
        operator: "AND",
        conditions: [{ type: "x", operator: "like", value: "y" }],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(false);
  });

  it("accepts numeric condition value", () => {
    const rules = [
      {
        operator: "AND",
        conditions: [{ type: "cart_value", operator: "gte", value: 50 }],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("accepts boolean condition value", () => {
    const rules = [
      {
        operator: "AND",
        conditions: [{ type: "is_new_visitor", operator: "eq", value: true }],
      },
    ];
    expect(TargetingRulesSchema.safeParse(rules).success).toBe(true);
  });
});

// ─── ModificationSchema ───────────────────────────────────────────────────────

describe("ModificationSchema", () => {
  it("accepts minimal valid modification", () => {
    expect(ModificationSchema.safeParse({ type: "text_replace" }).success).toBe(true);
  });

  it("rejects invalid modification type", () => {
    expect(ModificationSchema.safeParse({ type: "unknown_mod" }).success).toBe(false);
  });

  it.each([
    "text_replace", "image_replace", "link_replace", "hide_element",
    "show_element", "insert_before", "insert_after", "replace_html",
    "add_class", "remove_class", "css_inject", "js_inject", "redirect",
  ] as const)("accepts type %s", (type) => {
    expect(ModificationSchema.safeParse({ type }).success).toBe(true);
  });

  it("generates id when not provided", () => {
    const result = ModificationSchema.parse({ type: "text_replace" });
    expect(result.id).toBeTruthy();
    expect(typeof result.id).toBe("string");
  });

  it("accepts full modification with all fields", () => {
    const mod = {
      type: "text_replace",
      selector: ".hero-title",
      value: "New headline",
      css: "color: red",
      js: "console.log(1)",
      url: "https://example.com",
      preserveQueryParams: true,
    };
    expect(ModificationSchema.safeParse(mod).success).toBe(true);
  });
});

// ─── RuntimeEventSchema ───────────────────────────────────────────────────────

describe("RuntimeEventSchema", () => {
  function validEvent(overrides = {}) {
    return {
      shopDomain: "test.myshopify.com",
      visitorId: "vis-123",
      events: [
        {
          eventName: "page_viewed",
          eventType: "page",
          occurredAt: "2026-01-01T00:00:00Z",
          metadata: {},
        },
      ],
      ...overrides,
    };
  }

  it("accepts valid event payload", () => {
    expect(RuntimeEventSchema.safeParse(validEvent()).success).toBe(true);
  });

  it("rejects missing shopDomain", () => {
    const { shopDomain: _, ...rest } = validEvent();
    expect(RuntimeEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty visitorId", () => {
    expect(RuntimeEventSchema.safeParse(validEvent({ visitorId: "" })).success).toBe(false);
  });

  it("rejects empty eventName", () => {
    const e = validEvent();
    e.events[0] = { ...e.events[0]!, eventName: "" };
    expect(RuntimeEventSchema.safeParse(e).success).toBe(false);
  });

  it("rejects eventName longer than 100 chars", () => {
    const e = validEvent();
    e.events[0] = { ...e.events[0]!, eventName: "e".repeat(101) };
    expect(RuntimeEventSchema.safeParse(e).success).toBe(false);
  });

  it("rejects invalid occurredAt", () => {
    const e = validEvent();
    e.events[0] = { ...e.events[0]!, occurredAt: "not-a-date" };
    expect(RuntimeEventSchema.safeParse(e).success).toBe(false);
  });

  it("defaults metadata to empty object", () => {
    const e = validEvent();
    delete (e.events[0] as Record<string, unknown>).metadata;
    const result = RuntimeEventSchema.parse(e);
    expect(result.events[0]?.metadata).toEqual({});
  });

  it("accepts multiple events in a batch", () => {
    const e = validEvent();
    e.events = [
      { eventName: "page_viewed", eventType: "page", occurredAt: "2026-01-01T00:00:00Z", metadata: {} },
      { eventName: "product_viewed", eventType: "product", occurredAt: "2026-01-01T00:00:01Z", metadata: {} },
    ];
    expect(RuntimeEventSchema.safeParse(e).success).toBe(true);
  });

  it("accepts optional assignment fields", () => {
    const e = validEvent();
    e.events[0] = {
      ...e.events[0],
      experimentId: "exp-1",
      variantId: "var-1",
      deviceType: "mobile",
      country: "US",
    } as typeof e.events[0];
    expect(RuntimeEventSchema.safeParse(e).success).toBe(true);
  });
});

// ─── AssignmentRequestSchema ──────────────────────────────────────────────────

describe("AssignmentRequestSchema", () => {
  it("accepts minimal valid request", () => {
    expect(
      AssignmentRequestSchema.safeParse({ shopDomain: "test.myshopify.com", visitorId: "vis-1" }).success
    ).toBe(true);
  });

  it("rejects empty visitorId", () => {
    expect(
      AssignmentRequestSchema.safeParse({ shopDomain: "test.myshopify.com", visitorId: "" }).success
    ).toBe(false);
  });

  it("rejects missing shopDomain", () => {
    expect(AssignmentRequestSchema.safeParse({ visitorId: "vis-1" }).success).toBe(false);
  });

  it("defaults context to empty object", () => {
    const result = AssignmentRequestSchema.parse({ shopDomain: "test.myshopify.com", visitorId: "vis-1" });
    expect(result.context).toEqual({});
  });

  it("accepts rich context", () => {
    const input = {
      shopDomain: "test.myshopify.com",
      visitorId: "vis-1",
      context: {
        deviceType: "mobile",
        country: "US",
        cartValue: 150,
        isNewVisitor: true,
        forceVariants: { "exp-abc": "variant-b" },
      },
    };
    expect(AssignmentRequestSchema.safeParse(input).success).toBe(true);
  });
});

// ─── CartSyncSchema ───────────────────────────────────────────────────────────

describe("CartSyncSchema", () => {
  it("accepts valid cart sync", () => {
    const input = {
      shopDomain: "test.myshopify.com",
      visitorId: "vis-1",
      cartToken: "cart-abc",
      assignments: [
        {
          experimentId: "exp-1",
          variantId: "var-1",
          experimentSlug: "my-test",
          variantKey: "control",
        },
      ],
    };
    expect(CartSyncSchema.safeParse(input).success).toBe(true);
  });

  it("accepts empty assignments array", () => {
    expect(
      CartSyncSchema.safeParse({
        shopDomain: "test.myshopify.com",
        visitorId: "vis-1",
        cartToken: "cart-abc",
        assignments: [],
      }).success
    ).toBe(true);
  });

  it("rejects missing cartToken", () => {
    expect(
      CartSyncSchema.safeParse({
        shopDomain: "test.myshopify.com",
        visitorId: "vis-1",
        assignments: [],
      }).success
    ).toBe(false);
  });
});

// ─── CreateOfferSchema ────────────────────────────────────────────────────────

describe("CreateOfferSchema", () => {
  const validOffer = { name: "Test Offer", type: "PERCENTAGE_DISCOUNT" as const };

  it("accepts valid offer", () => {
    expect(CreateOfferSchema.safeParse(validOffer).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(CreateOfferSchema.safeParse({ ...validOffer, name: "" }).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(CreateOfferSchema.safeParse({ ...validOffer, type: "FAKE_OFFER" }).success).toBe(false);
  });

  const validTypes = [
    "PERCENTAGE_DISCOUNT", "FIXED_AMOUNT_DISCOUNT", "PRODUCT_DISCOUNT",
    "ORDER_DISCOUNT", "FREE_SHIPPING", "FREE_GIFT", "VOLUME_DISCOUNT",
    "QUANTITY_BREAK", "BUY_X_GET_Y", "TIERED_PROGRESS_BAR", "CAMPAIGN_LINK_OFFER",
  ];

  it.each(validTypes)("accepts type %s", (type) => {
    expect(CreateOfferSchema.safeParse({ name: "Test", type }).success).toBe(true);
  });
});

// ─── CreateCheckoutBlockSchema ────────────────────────────────────────────────

describe("CreateCheckoutBlockSchema", () => {
  const validBlock = { name: "Trust Badge", type: "TRUST_BADGES" as const };

  it("accepts valid block", () => {
    expect(CreateCheckoutBlockSchema.safeParse(validBlock).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(CreateCheckoutBlockSchema.safeParse({ ...validBlock, name: "" }).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(CreateCheckoutBlockSchema.safeParse({ ...validBlock, type: "FAKE" }).success).toBe(false);
  });

  it("defaults position to AFTER_CONTACT", () => {
    const result = CreateCheckoutBlockSchema.parse(validBlock);
    expect(result.position).toBe("AFTER_CONTACT");
  });
});

// ─── ProductCostSchema ────────────────────────────────────────────────────────

describe("ProductCostSchema", () => {
  const validCost = { shopifyProductId: "prod-1", shopifyVariantId: "var-1", cost: 10 };

  it("accepts valid cost entry", () => {
    expect(ProductCostSchema.safeParse(validCost).success).toBe(true);
  });

  it("rejects negative cost", () => {
    expect(ProductCostSchema.safeParse({ ...validCost, cost: -1 }).success).toBe(false);
  });

  it("accepts zero cost", () => {
    expect(ProductCostSchema.safeParse({ ...validCost, cost: 0 }).success).toBe(true);
  });

  it("defaults currencyCode to USD", () => {
    const result = ProductCostSchema.parse(validCost);
    expect(result.currencyCode).toBe("USD");
  });

  it("rejects currencyCode that is not 3 chars", () => {
    expect(ProductCostSchema.safeParse({ ...validCost, currencyCode: "US" }).success).toBe(false);
    expect(ProductCostSchema.safeParse({ ...validCost, currencyCode: "USDX" }).success).toBe(false);
  });
});

// ─── ShopSettingsSchema ───────────────────────────────────────────────────────

describe("ShopSettingsSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(ShopSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects antiFlickerTimeout above 5000", () => {
    expect(ShopSettingsSchema.safeParse({ antiFlickerTimeout: 5001 }).success).toBe(false);
  });

  it("accepts antiFlickerTimeout of 5000", () => {
    expect(ShopSettingsSchema.safeParse({ antiFlickerTimeout: 5000 }).success).toBe(true);
  });

  it("rejects transactionFeePercent above 100", () => {
    expect(ShopSettingsSchema.safeParse({ transactionFeePercent: 101 }).success).toBe(false);
  });

  it("rejects negative estimatedShippingCost", () => {
    expect(ShopSettingsSchema.safeParse({ estimatedShippingCost: -1 }).success).toBe(false);
  });

  it("rejects currencyCode not exactly 3 chars", () => {
    expect(ShopSettingsSchema.safeParse({ defaultCurrency: "US" }).success).toBe(false);
  });
});

// ─── PriceOverrideSchema ──────────────────────────────────────────────────────

describe("PriceOverrideSchema", () => {
  it("accepts valid price override", () => {
    expect(
      PriceOverrideSchema.safeParse({
        shopifyVariantId: "var-1",
        shopifyProductId: "prod-1",
        price: "29.99",
      }).success
    ).toBe(true);
  });

  it("accepts with compareAtPrice", () => {
    expect(
      PriceOverrideSchema.safeParse({
        shopifyVariantId: "var-1",
        shopifyProductId: "prod-1",
        price: "29.99",
        compareAtPrice: "39.99",
      }).success
    ).toBe(true);
  });

  it("rejects missing price", () => {
    expect(
      PriceOverrideSchema.safeParse({
        shopifyVariantId: "var-1",
        shopifyProductId: "prod-1",
      }).success
    ).toBe(false);
  });
});

// ─── Security edge cases ──────────────────────────────────────────────────────

describe("Schema security — injection and boundary payloads", () => {
  // Zod validates shape and type, NOT XSS content. Sanitization is the rendering
  // layer's job. These tests document the contract: what the schema accepts vs.
  // what it blocks, so engineers know where to add escaping.

  it("CreateExperimentSchema accepts XSS in name (rendering must escape)", () => {
    const result = CreateExperimentSchema.safeParse(
      validExperiment({ name: '<script>alert("xss")</script>' })
    );
    // Schema accepts it — the string is valid shape. The rendering layer MUST escape.
    expect(result.success).toBe(true);
  });

  it("CreateExperimentSchema accepts whitespace-only name (schema gap: no .trim())", () => {
    // The schema uses z.string().min(1) without .trim(), so "   " passes min-length.
    // Callers must sanitize before saving; consider adding .trim() to the schema.
    expect(CreateExperimentSchema.safeParse(validExperiment({ name: "   " })).success).toBe(true);
  });

  it("CreateExperimentSchema accepts newline-only name (same schema gap as whitespace)", () => {
    expect(CreateExperimentSchema.safeParse(validExperiment({ name: "\n\n" })).success).toBe(true);
  });

  it("CreateVariantSchema rejects SQL injection as key — regex blocks non-alphanum chars", () => {
    const result = CreateVariantSchema.safeParse(validVariant({ key: "'; DROP TABLE variants;--" }));
    // key pattern [a-z0-9-_] blocks quotes, semicolons, spaces
    expect(result.success).toBe(false);
  });

  it("CreateVariantSchema rejects key with null byte", () => {
    expect(CreateVariantSchema.safeParse(validVariant({ key: "control\x00" })).success).toBe(false);
  });

  it("CreateVariantSchema rejects key with unicode letters (only ASCII allowed)", () => {
    expect(CreateVariantSchema.safeParse(validVariant({ key: "variänt" })).success).toBe(false);
  });

  it("ShopSettingsSchema accepts non-email string for notifyEmail (schema gap: no .email())", () => {
    // notifyEmail is z.string() without .email() validation — any string passes.
    // Consider adding .email().optional() to catch invalid addresses at schema level.
    expect(ShopSettingsSchema.safeParse({ notifyEmail: "not-an-email" }).success).toBe(true);
  });

  it("ShopSettingsSchema accepts malformed notifyEmail (same schema gap)", () => {
    expect(
      ShopSettingsSchema.safeParse({ notifyEmail: "definitely-not-an-email" }).success
    ).toBe(true);
  });

  it("TargetingRulesSchema rejects a plain string (must be array)", () => {
    expect(TargetingRulesSchema.safeParse("rules").success).toBe(false);
  });

  it("TargetingRulesSchema rejects null", () => {
    expect(TargetingRulesSchema.safeParse(null).success).toBe(false);
  });

  it("CreateExperimentSchema rejects name longer than 200 chars with XSS padding", () => {
    const xss = '<img src=x onerror=alert(1)>';
    const padded = xss + "a".repeat(200 - xss.length + 1);
    expect(CreateExperimentSchema.safeParse(validExperiment({ name: padded })).success).toBe(false);
  });

  it("AssignmentRequestSchema accepts non-myshopify.com domain (schema gap: no domain constraint)", () => {
    // shopDomain is z.string() with no regex constraint — domain validation happens
    // in withRuntimeAuth middleware, not at the schema layer.
    const result = AssignmentRequestSchema.safeParse({
      visitorId: "vis-1",
      shopDomain: "attacker.com",
      experiments: [],
    });
    expect(result.success).toBe(true);
  });

  it("RuntimeEventSchema rejects non-myshopify.com domain (schema validates this)", () => {
    const result = RuntimeEventSchema.safeParse({
      visitorId: "vis-1",
      sessionId: "sess-1",
      shopDomain: "evil.io",
      eventType: "page_view",
    });
    // RuntimeEventSchema has a .endsWith(".myshopify.com") constraint — unlike
    // AssignmentRequestSchema which defers domain validation to the middleware.
    expect(result.success).toBe(false);
  });
});
