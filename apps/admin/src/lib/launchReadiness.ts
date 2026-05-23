export type ReadinessIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ReadinessResult = {
  blocking: ReadinessIssue[];
  warnings: ReadinessIssue[];
  recommendations: ReadinessIssue[];
  passed: string[];
  score: number;
};

export type ExperimentInput = {
  type: string;
  name: string;
  hypothesis?: string;
  variants: {
    name: string;
    isControl: boolean;
    allocation: number;
    modifications?: unknown[];
    settings?: Record<string, unknown>;
    priceOverrides?: unknown[];
    discountConfig?: unknown;
  }[];
  targetingRules?: unknown[];
  contentConfig?: Record<string, unknown>;
  splitUrlConfig?: Record<string, unknown>;
  priceConfig?: Record<string, unknown>;
  discountConfig?: Record<string, unknown>;
  shippingConfig?: Record<string, unknown>;
  schedule?: { startDate?: string; endDate?: string };
};

export function checkReadiness(experiment: ExperimentInput): ReadinessResult {
  const blocking: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const recommendations: ReadinessIssue[] = [];
  const passed: string[] = [];

  // ─── Global checks ───────────────────────────────────────────────────────

  // Variant count
  if (experiment.variants.length < 2) {
    blocking.push({ code: "VARIANTS_MIN", message: "At least 2 variants are required", field: "variants" });
  } else {
    passed.push(`✓ ${experiment.variants.length} variants defined`);
  }

  // Control variant
  const hasControl = experiment.variants.some((v) => v.isControl);
  if (!hasControl) {
    blocking.push({ code: "NO_CONTROL", message: "Exactly one control variant is required", field: "variants" });
  } else {
    passed.push("✓ Control variant set");
  }

  // Traffic allocation
  const totalAllocation = experiment.variants.reduce((s, v) => s + v.allocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.01) {
    blocking.push({ code: "ALLOCATION_SUM", message: "Traffic allocation must sum to 100%", field: "allocation" });
  } else {
    passed.push("✓ Traffic allocation is 100%");
  }

  // Test name
  if (!experiment.name.trim()) {
    blocking.push({ code: "NAME_REQUIRED", message: "Test name is required", field: "name" });
  } else {
    passed.push("✓ Test name set");
  }

  // Hypothesis
  if (!experiment.hypothesis?.trim()) {
    warnings.push({ code: "NO_HYPOTHESIS", message: "Adding a hypothesis helps you interpret results", field: "hypothesis" });
  }

  // ─── Type-specific checks ─────────────────────────────────────────────────

  const type = experiment.type;
  const nonControlVariants = experiment.variants.filter((v) => !v.isControl);

  if (type === "CONTENT_TEST") {
    // URL pattern required
    if (!experiment.contentConfig?.urlPattern) {
      blocking.push({ code: "CONTENT_URL_PATTERN", message: "URL pattern is required", field: "contentConfig.urlPattern" });
    }

    // All non-control variants need at least one modification
    for (const v of nonControlVariants) {
      if (!v.modifications || v.modifications.length === 0) {
        blocking.push({ code: "CONTENT_NO_MODIFICATIONS", message: "All non-control variants need at least one modification", field: "variants.modifications" });
        break;
      }
    }

    // No modification may have an empty selector
    for (const v of experiment.variants) {
      const mods = v.modifications ?? [];
      for (const mod of mods) {
        const m = mod as Record<string, unknown>;
        if (typeof m.selector === "string" && !m.selector.trim()) {
          blocking.push({ code: "CONTENT_EMPTY_SELECTOR", message: "Modification selectors cannot be empty", field: "variants.modifications.selector" });
          break;
        }
      }
    }

    // Warn about inject_js modifications
    const hasInjectJs = experiment.variants.some((v) =>
      (v.modifications ?? []).some((mod) => (mod as Record<string, unknown>).type === "inject_js")
    );
    if (hasInjectJs) {
      warnings.push({ code: "CONTENT_INJECT_JS", message: "JavaScript injections may impact page performance", field: "variants.modifications" });
    }
  }

  if (type === "SPLIT_URL_TEST") {
    // All variants must have a URL
    const missingUrl = experiment.variants.some((v) => !v.settings?.url);
    if (missingUrl) {
      blocking.push({ code: "SPLIT_URL_MISSING", message: "All variants must have a URL configured", field: "variants.settings.url" });
    }

    // URLs must be unique
    const urls = experiment.variants
      .map((v) => v.settings?.url as string | undefined)
      .filter(Boolean) as string[];
    const uniqueUrls = new Set(urls);
    if (urls.length > 0 && uniqueUrls.size !== urls.length) {
      blocking.push({ code: "SPLIT_URL_DUPLICATE", message: "Variant URLs must be unique", field: "variants.settings.url" });
    }

    // Loop protection recommendation
    if (!experiment.splitUrlConfig?.loopProtection) {
      warnings.push({ code: "SPLIT_URL_LOOP_PROTECTION", message: "Loop protection is recommended to prevent redirect loops", field: "splitUrlConfig.loopProtection" });
    }

    // External domain URLs may affect SEO
    const hostnames = urls
      .filter((u) => u.startsWith("http"))
      .map((u) => {
        try { return new URL(u).hostname; } catch { return null; }
      })
      .filter(Boolean) as string[];
    const uniqueHostnames = new Set(hostnames);
    if (uniqueHostnames.size > 1) {
      warnings.push({ code: "SPLIT_URL_EXTERNAL_DOMAIN", message: "External domain URLs may affect SEO", field: "variants.settings.url" });
    }
  }

  if (type === "OFFER_TEST") {
    for (const v of nonControlVariants) {
      if (!v.modifications || v.modifications.length === 0) {
        blocking.push({ code: "OFFER_NO_CONFIG", message: "Offer configuration is required for each variant", field: "variants.modifications" });
        break;
      }
    }
  }

  if (type === "CHECKOUT_TEST") {
    if (!experiment.contentConfig?.blockType) {
      blocking.push({ code: "CHECKOUT_NO_BLOCK_TYPE", message: "Block type must be selected", field: "contentConfig.blockType" });
    }
    if (!experiment.contentConfig?.placement) {
      blocking.push({ code: "CHECKOUT_NO_PLACEMENT", message: "Block placement must be selected", field: "contentConfig.placement" });
    }

    // All non-control variants need block content
    for (const v of nonControlVariants) {
      const settings = v.settings ?? {};
      const hasContent =
        settings.content != null ||
        settings.html != null ||
        settings.text != null;
      if (!hasContent) {
        blocking.push({ code: "CHECKOUT_NO_CONTENT", message: "All non-control variants need block content", field: "variants.settings" });
        break;
      }
    }

    warnings.push({ code: "CHECKOUT_EXTENSION_VERIFY", message: "Verify that the Checkout UI Extension is active in your Shopify theme" });
  }

  if (type === "DISCOUNT_TEST") {
    if (!experiment.discountConfig?.type) {
      blocking.push({ code: "DISCOUNT_NO_TYPE", message: "Discount type must be selected", field: "discountConfig.type" });
    }

    for (const v of nonControlVariants) {
      const dc = v.discountConfig as Record<string, unknown> | null | undefined;
      if (dc?.value === 0) {
        blocking.push({ code: "DISCOUNT_ZERO_VALUE", message: "Discount value must be greater than 0", field: "variants.discountConfig.value" });
        break;
      }
    }

    for (const v of nonControlVariants) {
      const dc = v.discountConfig as Record<string, unknown> | null | undefined;
      const discountType = (experiment.discountConfig as Record<string, unknown> | null | undefined)?.type;
      if (discountType === "PERCENTAGE" && typeof dc?.value === "number" && dc.value > 100) {
        blocking.push({ code: "DISCOUNT_PERCENTAGE_OVERFLOW", message: "Discount percentage cannot exceed 100%", field: "variants.discountConfig.value" });
        break;
      }
    }

    if (!(experiment.discountConfig as Record<string, unknown> | null | undefined)?.stackingRules) {
      warnings.push({ code: "DISCOUNT_NO_STACKING", message: "Configure stacking rules to avoid conflicts with other discounts", field: "discountConfig.stackingRules" });
    }
    warnings.push({ code: "DISCOUNT_FUNCTION_VERIFY", message: "Verify that the Shopify Discount Function is deployed and active" });
  }

  if (type === "SHIPPING_TEST") {
    const sc = experiment.shippingConfig as Record<string, unknown> | null | undefined;

    if (!sc?.strategy) {
      blocking.push({ code: "SHIPPING_NO_STRATEGY", message: "Shipping strategy must be selected", field: "shippingConfig.strategy" });
    }

    if (sc?.strategy === "FREE_THRESHOLD" && !sc?.threshold) {
      blocking.push({ code: "SHIPPING_NO_THRESHOLD", message: "Threshold must be set for free shipping strategy", field: "shippingConfig.threshold" });
    }

    if (sc?.threshold === 0) {
      warnings.push({ code: "SHIPPING_ZERO_THRESHOLD", message: "A threshold of $0 means free shipping for all orders", field: "shippingConfig.threshold" });
    }

    warnings.push({ code: "SHIPPING_FUNCTION_VERIFY", message: "Verify that the Delivery Customization Function is active" });
  }

  if (type === "PRICE_TEST") {
    for (const v of nonControlVariants) {
      if (!v.priceOverrides || v.priceOverrides.length === 0) {
        blocking.push({ code: "PRICE_NO_OVERRIDES", message: "Price configuration is required for all non-control variants", field: "variants.priceOverrides" });
        break;
      }
    }

    const hasZeroPrice = experiment.variants.some((v) =>
      (v.priceOverrides ?? []).some((po) => (po as Record<string, unknown>).price === 0)
    );
    if (hasZeroPrice) {
      blocking.push({ code: "PRICE_ZERO", message: "Prices cannot be $0", field: "variants.priceOverrides.price" });
    }

    if (!(experiment.priceConfig as Record<string, unknown> | null | undefined)?.enforcementStrategy) {
      warnings.push({ code: "PRICE_NO_ENFORCEMENT", message: "Select enforcement strategy (Display Only vs Shopify Function)", field: "priceConfig.enforcementStrategy" });
    }
  }

  if (type === "PERSONALIZATION") {
    if (!experiment.targetingRules?.length) {
      warnings.push({ code: "PERSONALIZATION_NO_TARGETING", message: "No targeting rules set — this personalization will show to all visitors", field: "targetingRules" });
    }

    if (!experiment.contentConfig?.offerIds || (experiment.contentConfig.offerIds as unknown[]).length === 0) {
      blocking.push({ code: "PERSONALIZATION_NO_OFFERS", message: "At least one offer must be selected", field: "contentConfig.offerIds" });
    }

    const { schedule } = experiment;
    if (schedule?.endDate && schedule?.startDate && new Date(schedule.endDate) <= new Date(schedule.startDate)) {
      blocking.push({ code: "PERSONALIZATION_DATE_ORDER", message: "End date must be after start date", field: "schedule.endDate" });
    }

    if (schedule?.endDate && new Date(schedule.endDate) < new Date()) {
      blocking.push({ code: "PERSONALIZATION_DATE_PAST", message: "End date cannot be in the past", field: "schedule.endDate" });
    }
  }

  // ─── Score calculation ────────────────────────────────────────────────────
  let score = 100;
  score -= blocking.length * 20;
  score -= warnings.length * 5;
  score = Math.max(0, score);

  return { blocking, warnings, recommendations, passed, score };
}
