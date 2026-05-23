import type { TestTypeConfig } from "./index";

export const shippingTestConfig: TestTypeConfig = {
  type: "SHIPPING_TEST",
  label: "Shipping Test",
  shortLabel: "Shipping",
  description: "A/B test free shipping thresholds, method visibility, and progress bars",
  accentHex: "#0891b2",
  icon: "⟁",
  baseHref: "/shipping-tests",
  apiPath: "/api/shipping-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your shipping test",
      description:
        "Name the test and write a hypothesis about what shipping change will improve AOV or CVR.",
    },
    {
      label: "Strategy",
      title: "Choose shipping strategy",
      description:
        "Select the type of shipping test — free threshold, method visibility, method rename, or progress bar.",
    },
    {
      label: "Variant Config",
      title: "Configure variants",
      description:
        "Set the threshold, method matcher, or messaging for each non-control variant.",
    },
    {
      label: "Display",
      title: "Display & messaging",
      description:
        "Configure the shipping progress bar message and checkout display behaviour.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the shipping configuration and verify delivery customization function status.",
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
    shippingConfig: {
      strategy: null,
      threshold: null,
      method: null,
      progressBarEnabled: false,
      progressBarMessage: "Add {remaining} more for free shipping!",
    },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "strategy",     label: "Strategy" },
    { key: "variantCount", label: "Variants", width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "aov",               label: "AOV",           unit: "currency", higherIsBetter: true },
    { key: "conversionRate",    label: "CVR",           unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",           unit: "currency", higherIsBetter: true },
    { key: "shippingRevenue",   label: "Shipping Rev.", unit: "currency", higherIsBetter: true },
    { key: "freeShippingRate",  label: "Free Ship. %",  unit: "percent",  higherIsBetter: false },
  ],

  emptyState: {
    title: "No shipping tests yet",
    body: "Test free shipping thresholds, method visibility rules, and progress bar messaging to increase AOV.",
    action: "Create shipping test",
  },

  guards: [
    { code: "SHIPPING_NO_STRATEGY",         message: "Shipping strategy must be selected.",                                            severity: "block" },
    { code: "SHIPPING_NO_THRESHOLD",        message: "Threshold must be set for free shipping strategy.",                              severity: "block" },
    { code: "SHIPPING_ZERO_THRESHOLD",      message: "A threshold of $0 means free shipping for all orders.",                          severity: "warn"  },
    { code: "SHIPPING_NO_METHOD_MATCHER",   message: "Method name matcher is required for method visibility and rename strategies.",    severity: "block" },
    { code: "SHIPPING_PROGRESS_BAR_MSG",    message: "Progress bar message is required when progress bar is enabled.",                  severity: "block" },
    { code: "SHIPPING_FUNCTION_VERIFY",     message: "Verify that the Delivery Customization Function is deployed and active.",         severity: "warn"  },
    { code: "SHIPPING_FUNCTION_MISSING",    message: "Delivery Customization Function not detected. Required for method-based tests.",  severity: "warn"  },
  ],

  exampleName: "Free Shipping Threshold Test",
  exampleHypothesis:
    "Lowering the free shipping threshold from $75 to $50 will increase checkout completion without reducing profit per visitor.",
};
