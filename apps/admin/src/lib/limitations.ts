/**
 * MarginLab — Known Platform & Feature Limitations
 *
 * This module is the single source of truth for merchant-facing limitation notices.
 * Each limitation card is shown in the relevant wizard or settings page so merchants
 * understand constraints BEFORE launching a test, not after it fails.
 *
 * Design principles:
 *  - Merchant-friendly language — no technical jargon.
 *  - Actionable where possible ("what you can do instead").
 *  - Severity levels: info | warning | critical.
 */

export type LimitationSeverity = "info" | "warning" | "critical";

export interface Limitation {
  id: string;
  severity: LimitationSeverity;
  /** Short headline shown on the card */
  title: string;
  /** Full description shown when card is expanded */
  description: string;
  /** Optional "what to do instead" / mitigation guidance */
  mitigation?: string;
  /** Shopify docs URL, if relevant */
  docsUrl?: string;
}

export type FeatureKey =
  | "content"
  | "split_url"
  | "offer"
  | "checkout"
  | "discount"
  | "shipping"
  | "price"
  | "template"
  | "theme"
  | "personalization"
  | "post_purchase"
  | "analytics"
  | "profit_analytics"
  | "integrations";

// ---------------------------------------------------------------------------
// Platform-wide limitations (shown in Install Health and Settings → Docs)
// ---------------------------------------------------------------------------

export const PLATFORM_LIMITATIONS: Limitation[] = [
  {
    id: "checkout_no_arbitrary_modification",
    severity: "warning",
    title: "Checkout layout cannot be freely customized",
    description:
      "Shopify controls the checkout layout. MarginLab can add content blocks and UI extensions only in approved checkout extension points. Full HTML/CSS injection in checkout is not supported.",
    mitigation:
      "Use Checkout Tests or Offer Tests to add content in permitted extension slots.",
    docsUrl: "https://shopify.dev/docs/apps/checkout",
  },
  {
    id: "functions_no_external_api",
    severity: "warning",
    title: "Discount and shipping rules cannot call external APIs at runtime",
    description:
      "Shopify Functions run in a sandboxed environment. They receive the cart context but cannot make network requests to third-party services during rule evaluation.",
    mitigation:
      "Configure rules ahead of time using the MarginLab dashboard. Rules are compiled into the function config and evaluated without external calls.",
  },
  {
    id: "delivery_customization_partial",
    severity: "info",
    title: "Shipping rate control is display-only for some carriers",
    description:
      "Shopify Delivery Customization can hide or rename shipping methods but cannot always modify the actual price charged by the carrier. Final shipping costs are determined by Shopify.",
    mitigation:
      "Use shipping tests to measure which method names and order drive more conversions, rather than to change the underlying carrier rate.",
  },
  {
    id: "price_display_mismatch",
    severity: "critical",
    title: "Price display changes may not match checkout price",
    description:
      "MarginLab can display a different price on the storefront (PDP, collection pages). However, the actual price charged at checkout is controlled by Shopify. If the Shopify Function is not active, the storefront price and checkout price will differ.",
    mitigation:
      "Always verify that the Discount Function is active before launching a price test. Use the Install Health page to confirm.",
  },
  {
    id: "multicurrency_extra_qa",
    severity: "warning",
    title: "Multi-currency stores need additional QA",
    description:
      "Price tests and discount rules are defined in your store's primary currency. In multi-currency stores, Shopify converts prices and rounding may affect the displayed amount.",
    mitigation:
      "Test your experiment in each active currency before launching to production traffic.",
  },
  {
    id: "subscriptions_compatibility",
    severity: "warning",
    title: "Subscription products may require compatibility review",
    description:
      "If your store uses subscription apps (e.g. Recharge, Skio), discount functions and price tests may interact unexpectedly with subscription pricing rules.",
    mitigation:
      "Test subscription products in a development environment before running live experiments.",
  },
  {
    id: "theme_tests_high_risk",
    severity: "critical",
    title: "Theme Tests can break your storefront if misconfigured",
    description:
      "Theme Tests inject custom Liquid or JavaScript into your live theme. Invalid code can cause rendering errors or a broken storefront for some or all visitors.",
    mitigation:
      "Always preview a theme test in a development/duplicate theme before launching. Use the test traffic slider to start with a small percentage of visitors.",
  },
  {
    id: "third_party_app_conflicts",
    severity: "warning",
    title: "Third-party apps may interfere with test results",
    description:
      "Page builders, upsell apps, loyalty apps, or other Shopify apps can modify cart and checkout behavior in ways that conflict with MarginLab tests.",
    mitigation:
      "If you observe unexpected behavior, temporarily disable other apps and retest to isolate the cause.",
  },
  {
    id: "analytics_sample_size",
    severity: "info",
    title: "Analytics require sufficient traffic to be reliable",
    description:
      "Statistical results are only meaningful once each variant has received enough visitors. MarginLab shows a sample size warning when results are not yet reliable.",
    mitigation:
      "Do not pause or roll out a winner based on early data. Wait for the sample size indicator to clear.",
  },
  {
    id: "cogs_completeness",
    severity: "info",
    title: "Profit analytics depend on complete COGS data",
    description:
      "Profit per order and margin calculations are only accurate if all products have Cost of Goods Sold (COGS) values entered. Missing COGS shows $0 cost.",
    mitigation:
      "Enter COGS for all products in Settings → COGS before relying on profit analytics.",
  },
];

// ---------------------------------------------------------------------------
// Feature-specific limitation cards
// ---------------------------------------------------------------------------

export const FEATURE_LIMITATIONS: Record<FeatureKey, Limitation[]> = {
  content: [
    {
      id: "content_selector_drift",
      severity: "warning",
      title: "DOM selectors can break when the theme is updated",
      description:
        "Content tests target page elements by CSS selector. If your theme is updated and the selector no longer exists, the modification will silently not apply.",
      mitigation:
        "Review active content tests after any theme update. Use the Debug tool to confirm modifications are being applied.",
    },
    {
      id: "content_no_checkout",
      severity: "info",
      title: "Content tests do not apply inside checkout",
      description:
        "The MarginLab storefront runtime runs on your theme pages (home, PDP, collection, cart). It does not run inside the Shopify checkout.",
      mitigation: "Use Checkout Tests for modifications inside the checkout flow.",
    },
  ],

  split_url: [
    {
      id: "split_url_seo_risk",
      severity: "warning",
      title: "Split URL tests can affect SEO if not configured correctly",
      description:
        "Redirecting visitors to a different URL for a test variant can split link equity. Search engines may index both URLs.",
      mitigation:
        "Add a canonical tag to the variant URL pointing to the control URL, or use noindex on variant URLs during the test.",
    },
    {
      id: "split_url_back_button",
      severity: "info",
      title: "Back button behavior differs per variant",
      description:
        "Visitors who are redirected to a variant URL and press back will navigate to their previous page, not the original URL. This is expected behavior.",
    },
  ],

  offer: [
    {
      id: "offer_checkout_extension_required",
      severity: "critical",
      title: "Offer Tests require the Checkout Extension to be active",
      description:
        "Offer widgets displayed at checkout require the MarginLab Checkout Extension to be connected in your Shopify checkout editor.",
      mitigation:
        "Open the Shopify Admin → Online Store → Checkout → Customize and add the MarginLab app block.",
      docsUrl: "https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/apps",
    },
  ],

  checkout: [
    {
      id: "checkout_extension_placement_limited",
      severity: "warning",
      title: "Checkout content can only be placed in approved extension slots",
      description:
        "Shopify controls which areas of the checkout can be extended. MarginLab can add content in the available extension points but cannot modify Shopify's native fields (email, address, payment).",
    },
    {
      id: "checkout_no_js",
      severity: "info",
      title: "Custom JavaScript is not supported in Checkout Tests",
      description:
        "Shopify checkout extensions run in a sandboxed React environment. Arbitrary JavaScript injection is not available by design.",
    },
  ],

  discount: [
    {
      id: "discount_function_required",
      severity: "critical",
      title: "Discount Tests require the Discount Function to be deployed",
      description:
        "Automatic discounts applied during checkout are handled by a Shopify Function. If the function is not active or outdated, discounts will not apply.",
      mitigation:
        "Use the Install Health page to confirm the Discount Function is active and up to date.",
    },
    {
      id: "discount_stackability",
      severity: "warning",
      title: "Discount stacking depends on your Shopify plan",
      description:
        "Some Shopify plans limit how multiple discounts can be combined. MarginLab discount tests interact with your existing discount stack.",
      mitigation:
        "Test discount combinations in a development environment to confirm stacking behavior before going live.",
    },
  ],

  shipping: [
    {
      id: "shipping_function_required",
      severity: "critical",
      title: "Shipping Tests require the Delivery Customization Function to be active",
      description:
        "Hiding or renaming shipping methods is handled by a Shopify Function. If the function is not active, all shipping methods will appear to all visitors.",
      mitigation:
        "Use the Install Health page to confirm the Delivery Customization Function is active.",
    },
    {
      id: "shipping_carrier_rates_unchanged",
      severity: "info",
      title: "Shipping tests change method visibility, not carrier rates",
      description:
        "Shipping tests can show or hide specific shipping methods and change their display names. They do not change the actual price charged by the carrier.",
    },
  ],

  price: [
    {
      id: "price_function_required",
      severity: "critical",
      title: "Price Tests require the Discount Function to apply real price changes",
      description:
        "Storefront price display is updated immediately by MarginLab. However, the actual checkout price is only changed if the Discount Function is active.",
      mitigation:
        "Always confirm the Discount Function is active via Install Health before launching a price test.",
    },
    {
      id: "price_backup_rollback",
      severity: "warning",
      title: "Price rollouts are irreversible without a backup",
      description:
        "When you roll out a winning price, MarginLab writes the new price to Shopify. A backup of the original prices is created automatically, but rollback must be triggered manually.",
      mitigation:
        "Keep the price test backup for at least 30 days before deleting it. Use Settings → Price Backups to manage rollback.",
    },
  ],

  template: [
    {
      id: "template_theme_dependency",
      severity: "warning",
      title: "Template tests depend on your theme's section schema",
      description:
        "Template modifications are applied to your theme's JSON templates. If the theme is updated or a section is removed, the modification may no longer apply.",
      mitigation:
        "Review active template tests after theme updates. Use the Debug tool to confirm templates are applying correctly.",
    },
  ],

  theme: [
    {
      id: "theme_snippet_support_setup",
      severity: "warning",
      title: "Theme Tests may require manual setup in your theme",
      description:
        "Injecting custom Liquid or JavaScript into your theme requires adding a MarginLab snippet to your theme files. This is a one-time setup step.",
      mitigation:
        "Follow the guided setup in the Theme Test wizard. If you need help, contact support.",
    },
    {
      id: "theme_test_high_risk_repeat",
      severity: "critical",
      title: "Invalid theme code can break your storefront",
      description:
        "Theme Tests inject code into your live theme. Incorrect Liquid or JavaScript can cause errors visible to all visitors.",
      mitigation:
        "Always test in a duplicate theme first. Start with a small traffic percentage. Keep a backup of your current theme.",
    },
  ],

  personalization: [
    {
      id: "personalization_selector_same_risk",
      severity: "warning",
      title: "Personalizations share the same selector risk as content tests",
      description:
        "Personalizations modify DOM elements by CSS selector. Theme updates can break selectors silently.",
      mitigation:
        "Review personalizations after theme updates.",
    },
  ],

  post_purchase: [
    {
      id: "post_purchase_shopify_support",
      severity: "warning",
      title: "Post-purchase pages depend on Shopify plan and checkout settings",
      description:
        "Post-purchase extension availability depends on your Shopify plan and whether your checkout is configured to support it. Not all merchants have access.",
      mitigation:
        "Verify your plan supports post-purchase extensions in your Shopify Admin before configuring post-purchase personalizations.",
      docsUrl: "https://shopify.dev/docs/apps/checkout/post-purchase",
    },
  ],

  analytics: [
    {
      id: "analytics_peeking_warning",
      severity: "warning",
      title: "Checking results too early can lead to incorrect conclusions",
      description:
        "Statistical significance is unreliable when checked before sufficient data is collected. MarginLab shows a peeking warning when a winner is detected in fewer than 7 days.",
      mitigation: "Wait for the sample size indicator to clear before acting on results.",
    },
    {
      id: "analytics_attribution_window",
      severity: "info",
      title: "Orders are attributed within a 30-day window",
      description:
        "MarginLab attributes an order to an experiment if the visitor was assigned to a variant within 30 days of the order. Orders outside this window are not attributed.",
    },
  ],

  profit_analytics: [
    {
      id: "profit_cogs_required",
      severity: "warning",
      title: "Profit data is incomplete without COGS",
      description:
        "Profit per order, margin, and incremental profit calculations require Cost of Goods Sold (COGS) values for each product. Missing COGS defaults to $0 and overstates profit.",
      mitigation:
        "Enter COGS for all products in Settings → COGS before relying on profit analytics.",
    },
  ],

  integrations: [
    {
      id: "integrations_third_party_conflicts",
      severity: "info",
      title: "Third-party integrations may require compatibility testing",
      description:
        "Integrating MarginLab with other analytics or attribution tools (e.g. Google Analytics, Triple Whale) may require custom event mapping.",
      mitigation:
        "Contact support if you need help mapping MarginLab events to your analytics stack.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Returns all limitations for a given feature, merged with any platform-wide
 * limitations that are relevant to it.
 */
export function getLimitationsForFeature(feature: FeatureKey): Limitation[] {
  return FEATURE_LIMITATIONS[feature] ?? [];
}

/**
 * Returns all platform-wide limitations (for Install Health / Settings → Docs).
 */
export function getAllPlatformLimitations(): Limitation[] {
  return PLATFORM_LIMITATIONS;
}

/**
 * Returns limitations filtered by minimum severity.
 * Order: critical > warning > info
 */
export function filterBySeverity(
  limitations: Limitation[],
  minSeverity: LimitationSeverity
): Limitation[] {
  const order: LimitationSeverity[] = ["info", "warning", "critical"];
  const minIndex = order.indexOf(minSeverity);
  return limitations.filter((l) => order.indexOf(l.severity) >= minIndex);
}
