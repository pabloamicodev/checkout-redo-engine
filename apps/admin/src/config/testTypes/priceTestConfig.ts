import type { TestTypeConfig } from "./index";

export const priceTestConfig: TestTypeConfig = {
  type: "PRICE_TEST",
  label: "Price Test",
  shortLabel: "Price",
  description: "A/B test product prices and measure impact on revenue and gross profit",
  accentHex: "#e11d48",
  icon: "$",
  baseHref: "/price-tests",
  apiPath: "/api/price-tests",
  highRisk: true,

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your price test",
      description:
        "Name the test and write a hypothesis about how a price change will impact gross profit per visitor.",
    },
    {
      label: "Products",
      title: "Select products",
      description:
        "Choose the products and variants you want to test prices on.",
    },
    {
      label: "Price Matrix",
      title: "Build the price matrix",
      description:
        "Set control and variant prices for each selected product. Review margin impact before continuing.",
    },
    {
      label: "Display",
      title: "Display surfaces",
      description:
        "Choose where the variant price appears — PDP, collection, cart, and checkout.",
    },
    {
      label: "Enforcement",
      title: "Checkout enforcement",
      description:
        "Choose between Display Only (no Shopify Function required) and Shopify Function (enforced at checkout).",
    },
    {
      label: "Risk Review",
      title: "Risk review — required",
      description:
        "Acknowledge the risks of a live price test before continuing. This step is required and cannot be skipped.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the complete price test configuration and launch when all checks pass.",
    },
  ],

  defaultValues: {
    name: "",
    hypothesis: "",
    trafficAllocation: 100,
    variants: [
      { name: "Control", isControl: true, allocation: 50, priceOverrides: [] },
      { name: "Variant A", isControl: false, allocation: 50, priceOverrides: [] },
    ],
    priceConfig: {
      productIds: [],
      displaySurfaces: ["pdp"],
      enforcementStrategy: null,
      riskConfirmed: false,
      rolloutState: "TESTING",
    },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "riskLevel",    label: "Risk" },
    { key: "variantCount", label: "Variants",  width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "revenuePerVisitor", label: "RPV",             unit: "currency", higherIsBetter: true },
    { key: "profitPerVisitor",  label: "Profit/Visitor",  unit: "currency", higherIsBetter: true },
    { key: "conversionRate",    label: "CVR",             unit: "percent",  higherIsBetter: true },
    { key: "aov",               label: "AOV",             unit: "currency", higherIsBetter: true },
    { key: "grossMargin",       label: "Gross Margin",    unit: "percent",  higherIsBetter: true },
  ],

  emptyState: {
    title: "No price tests yet",
    body: "Test price sensitivity carefully — a small price increase can improve gross profit without materially reducing conversion.",
    action: "Create price test",
  },

  guards: [
    { code: "PRICE_NO_PRODUCTS",         message: "At least one product must be selected.",                                               severity: "block" },
    { code: "PRICE_NO_OVERRIDES",        message: "Price configuration is required for all non-control variants.",                        severity: "block" },
    { code: "PRICE_ZERO",                message: "Prices cannot be $0.",                                                                  severity: "block" },
    { code: "PRICE_NO_ENFORCEMENT",      message: "Enforcement strategy must be selected (Display Only or Shopify Function).",             severity: "warn"  },
    { code: "PRICE_RISK_NOT_CONFIRMED",  message: "Risk Review must be completed before launching a price test.",                          severity: "block" },
    { code: "PRICE_LARGE_DELTA",         message: "Price delta is unusually large (>50%). Verify this is intentional.",                    severity: "warn"  },
    { code: "PRICE_MULTI_CURRENCY",      message: "Multi-currency stores may display inconsistent prices. Review carefully.",              severity: "warn"  },
    { code: "PRICE_SUBSCRIPTION",        message: "Subscription products have additional price constraints. Verify your setup.",           severity: "warn"  },
    { code: "PRICE_DISPLAY_ONLY_RISK",   message: "Display Only mode does not enforce the price at checkout. Buyers pay the real price.",  severity: "warn"  },
    { code: "PRICE_PRODUCT_DELETED",     message: "One or more selected products have been deleted.",                                      severity: "block" },
  ],

  exampleName: "Premium Price Sensitivity Test",
  exampleHypothesis:
    "Increasing the hero product price by 8% will improve gross profit per visitor without materially reducing conversion rate.",
};
