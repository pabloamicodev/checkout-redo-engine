import type { TestTypeConfig } from "./index";

export const checkoutTestConfig: TestTypeConfig = {
  type: "CHECKOUT_TEST",
  label: "Checkout Test",
  shortLabel: "Checkout",
  description: "A/B test checkout blocks, trust badges, and messaging",
  accentHex: "#4f46e5",
  icon: "▣",
  baseHref: "/checkout-tests",
  apiPath: "/api/checkout-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your checkout test",
      description:
        "Name the test and write a hypothesis about what checkout content will increase completion rate.",
    },
    {
      label: "Block Type",
      title: "Choose block type",
      description:
        "Select the type of checkout block you want to test — trust badges, shipping messaging, social proof, and more.",
    },
    {
      label: "Placement",
      title: "Choose placement",
      description:
        "Select which checkout step the block appears on — information, shipping, payment, or review.",
    },
    {
      label: "Variant Content",
      title: "Build variant content",
      description:
        "Configure the block content for each non-control variant.",
    },
    {
      label: "QA Checklist",
      title: "Pre-launch QA checklist",
      description:
        "Verify extension health, preview the block, and confirm checkout behaviour before launching.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the configuration, check extension status, and fix blocking issues.",
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
    contentConfig: {
      blockType: null,
      placement: null,
    },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "blockType",    label: "Block Type" },
    { key: "variantCount", label: "Variants", width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "conversionRate",    label: "Checkout CVR",    unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",             unit: "currency", higherIsBetter: true },
    { key: "impressions",       label: "Impressions",     unit: "count",    higherIsBetter: false },
    { key: "aov",               label: "AOV",             unit: "currency", higherIsBetter: true },
    { key: "orders",            label: "Orders",          unit: "count",    higherIsBetter: true },
  ],

  emptyState: {
    title: "No checkout tests yet",
    body: "Add trust badges, shipping messaging, or social proof to checkout and measure the impact on conversion.",
    action: "Create checkout test",
  },

  guards: [
    { code: "CHECKOUT_NO_BLOCK_TYPE",    message: "Block type must be selected.",                                              severity: "block" },
    { code: "CHECKOUT_NO_PLACEMENT",     message: "Placement must be selected.",                                               severity: "block" },
    { code: "CHECKOUT_NO_CONTENT",       message: "All non-control variants need block content.",                              severity: "block" },
    { code: "CHECKOUT_HTML_INJECTION",   message: "Custom HTML injections are not supported in Shopify Checkout.",            severity: "warn"  },
    { code: "CHECKOUT_EXTENSION_VERIFY", message: "Verify that the Checkout UI Extension is active in your Shopify theme.",   severity: "warn"  },
    { code: "CHECKOUT_EXTENSION_MISSING", message: "The Checkout UI Extension is not installed. Install it before launching.", severity: "block" },
  ],

  exampleName: "Checkout Trust Badge Test",
  exampleHypothesis:
    "Adding payment security badges above the payment step will increase checkout completion rate by 5%.",
};
