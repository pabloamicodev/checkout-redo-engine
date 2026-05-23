import type { TestTypeConfig } from "./index";

export const offerTestConfig: TestTypeConfig = {
  type: "OFFER_TEST",
  label: "Offer Test",
  shortLabel: "Offers",
  description: "A/B test cart offers, free shipping thresholds, and incentives",
  accentHex: "#059669",
  icon: "◈",
  baseHref: "/offer-tests",
  apiPath: "/api/offer-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your offer test",
      description:
        "Name the test and write a hypothesis about which incentive or threshold drives more revenue.",
    },
    {
      label: "Offer Type",
      title: "Choose offer type",
      description:
        "Select the type of offer you want to test — free shipping, free gift, volume discount, and more.",
    },
    {
      label: "Trigger Rules",
      title: "Set trigger conditions",
      description:
        "Define when the offer activates — by subtotal, quantity, or product eligibility.",
    },
    {
      label: "Variant Offers",
      title: "Configure variant offers",
      description:
        "Set the offer parameters for each variant — thresholds, tiers, or gift products.",
    },
    {
      label: "Placement",
      title: "Choose display placement",
      description:
        "Select where the offer appears — cart drawer, product page, announcement bar, and more.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the offer configuration and fix any blocking issues before launching.",
    },
  ],

  defaultValues: {
    name: "",
    hypothesis: "",
    trafficAllocation: 100,
    variants: [
      { name: "Control", isControl: true, allocation: 50 },
      { name: "Variant A", isControl: false, allocation: 50 },
    ],
    settings: {
      offerType: null,
      placements: [],
      triggerMinSubtotal: 0,
      triggerMinQty: 0,
    },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "offerType",    label: "Offer Type" },
    { key: "variantCount", label: "Variants",  width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "claimRate",         label: "Claim Rate",       unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",              unit: "currency", higherIsBetter: true },
    { key: "aov",               label: "AOV",              unit: "currency", higherIsBetter: true },
    { key: "revenueInfluenced", label: "Rev. Influenced",  unit: "currency", higherIsBetter: true },
    { key: "conversionRate",    label: "CVR",              unit: "percent",  higherIsBetter: true },
  ],

  emptyState: {
    title: "No offer tests yet",
    body: "Test free shipping thresholds, free gifts, volume discounts, and cart incentives.",
    action: "Create offer test",
  },

  guards: [
    { code: "OFFER_NO_TYPE",            message: "An offer type must be selected.",                                     severity: "block" },
    { code: "OFFER_NO_PLACEMENT",       message: "At least one display placement must be selected.",                    severity: "block" },
    { code: "OFFER_NO_CONFIG",          message: "Offer configuration is required for each non-control variant.",       severity: "block" },
    { code: "OFFER_ZERO_THRESHOLD",     message: "A threshold of $0 means the offer applies to all orders.",           severity: "warn"  },
    { code: "OFFER_FREE_GIFT_MISSING",  message: "Free gift product must be selected.",                                 severity: "block" },
    { code: "OFFER_TIER_ASCENDING",     message: "Volume discount tiers must be in ascending order.",                   severity: "block" },
    { code: "OFFER_FUNCTION_VERIFY",    message: "Verify that the Shopify Function for this offer type is deployed.",   severity: "warn"  },
  ],

  exampleName: "Free Gift Threshold Test",
  exampleHypothesis:
    "Offering a free gift above $80 will increase AOV and revenue per visitor without reducing conversion rate.",
};
