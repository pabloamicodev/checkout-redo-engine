import type { TestTypeConfig } from "./index";

export const discountTestConfig: TestTypeConfig = {
  type: "DISCOUNT_TEST",
  label: "Discount Test",
  shortLabel: "Discounts",
  description: "A/B test discount types, values, and stacking behaviour",
  accentHex: "#d97706",
  icon: "%",
  baseHref: "/discount-tests",
  apiPath: "/api/discount-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your discount test",
      description:
        "Name the test and write a hypothesis about which discount type or value drives the best revenue per visitor.",
    },
    {
      label: "Discount Type",
      title: "Choose discount type",
      description:
        "Select the type of discount — percentage, fixed amount, free shipping, volume, or BXGY.",
    },
    {
      label: "Eligibility",
      title: "Set eligibility rules",
      description:
        "Define which products, collections, or order conditions trigger the discount.",
    },
    {
      label: "Variant Discounts",
      title: "Configure variant discounts",
      description:
        "Set the discount value or tiers for each non-control variant.",
    },
    {
      label: "Stacking Rules",
      title: "Stacking behaviour",
      description:
        "Define whether this discount stacks with other active discounts or is exclusive.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the discount configuration and fix any blocking issues before launching.",
    },
  ],

  defaultValues: {
    name: "",
    hypothesis: "",
    trafficAllocation: 100,
    variants: [
      { name: "Control", isControl: true, allocation: 50 },
      { name: "Variant A", isControl: false, allocation: 50, discountConfig: { value: 0 } },
    ],
    discountConfig: {
      type: null,
      stacking: null,
      minSubtotal: 0,
      minQty: 0,
      perCustomerLimit: 0,
    },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "discountType", label: "Discount Type" },
    { key: "variantCount", label: "Variants", width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "revenuePerVisitor", label: "RPV",           unit: "currency", higherIsBetter: true  },
    { key: "conversionRate",    label: "CVR",           unit: "percent",  higherIsBetter: true  },
    { key: "profitPerVisitor",  label: "Profit/Visitor",unit: "currency", higherIsBetter: true  },
    { key: "discountCost",      label: "Discount Cost", unit: "currency", higherIsBetter: false },
    { key: "aov",               label: "AOV",           unit: "currency", higherIsBetter: true  },
  ],

  emptyState: {
    title: "No discount tests yet",
    body: "Test percentage off vs fixed amount, product vs order discounts, and different threshold values to find the highest RPV.",
    action: "Create discount test",
  },

  guards: [
    { code: "DISCOUNT_NO_TYPE",              message: "Discount type must be selected.",                                        severity: "block" },
    { code: "DISCOUNT_ZERO_VALUE",           message: "Discount value must be greater than 0.",                                 severity: "block" },
    { code: "DISCOUNT_PERCENTAGE_OVERFLOW",  message: "Discount percentage cannot exceed 100%.",                                severity: "block" },
    { code: "DISCOUNT_NO_STACKING",          message: "Configure stacking rules to avoid conflicts with other discounts.",      severity: "warn"  },
    { code: "DISCOUNT_FUNCTION_VERIFY",      message: "Verify that the Shopify Discount Function is deployed and active.",      severity: "warn"  },
    { code: "DISCOUNT_HIGH_VALUE_ADDITIVE",  message: "High-value additive discounts can significantly reduce profit margin.",  severity: "warn"  },
    { code: "DISCOUNT_TIER_ASCENDING",       message: "Volume discount tiers must be in ascending order.",                      severity: "block" },
  ],

  exampleName: "10% vs $15 Discount Test",
  exampleHypothesis:
    "A fixed $15 discount will create higher perceived value than 10% off, increasing conversion without hurting revenue per visitor.",
};
