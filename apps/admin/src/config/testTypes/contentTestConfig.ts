import type { TestTypeConfig } from "./index";

export const contentTestConfig: TestTypeConfig = {
  type: "CONTENT_TEST",
  label: "Content Test",
  shortLabel: "Content",
  description: "A/B test storefront copy, images, and layout changes",
  accentHex: "#7c3aed",
  icon: "✦",
  baseHref: "/content-tests",
  apiPath: "/api/content-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your experiment",
      description:
        "Name the experiment and write a hypothesis about what content change will improve your metric.",
    },
    {
      label: "Page Targeting",
      title: "Choose target pages",
      description:
        "Specify which pages or URL patterns this experiment should run on.",
    },
    {
      label: "Variants",
      title: "Set up test groups",
      description:
        "Define your control and variant groups with traffic allocation.",
    },
    {
      label: "Content Changes",
      title: "Build content modifications",
      description:
        "Add DOM modifications for each non-control variant — text, images, CSS, or HTML changes.",
    },
    {
      label: "Anti-flicker",
      title: "Configure anti-flicker",
      description:
        "Anti-flicker prevents the original content from flashing before your variant loads.",
    },
    {
      label: "QA Checklist",
      title: "Pre-launch QA checklist",
      description:
        "Confirm all technical and UX checks before launching to real visitors.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the complete configuration and fix any blocking issues before creating the test.",
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
    contentConfig: { urlPattern: "", antiFlicker: false, antiFlickerTimeout: 300 },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "urlPattern",   label: "Target Pages" },
    { key: "variantCount", label: "Variants", width: "80px" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "conversionRate", label: "CVR",              unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",           unit: "currency", higherIsBetter: true },
    { key: "addToCartRate", label: "Add-to-Cart",       unit: "percent",  higherIsBetter: true },
    { key: "pageViews",     label: "Page Views",        unit: "count",    higherIsBetter: false },
    { key: "aov",           label: "AOV",               unit: "currency", higherIsBetter: true },
  ],

  emptyState: {
    title: "No content tests yet",
    body: "Test headlines, hero images, CTAs, and layout changes without touching your theme code.",
    action: "Create content test",
  },

  guards: [
    { code: "CONTENT_URL_PATTERN",      message: "URL pattern is required to target specific pages.",           severity: "block" },
    { code: "CONTENT_NO_MODIFICATIONS", message: "All non-control variants need at least one modification.",    severity: "block" },
    { code: "CONTENT_EMPTY_SELECTOR",   message: "Modification selectors cannot be empty.",                    severity: "block" },
    { code: "CONTENT_INJECT_JS",        message: "JavaScript injections may impact page performance.",          severity: "warn"  },
    { code: "CONTENT_NO_ANTI_FLICKER",  message: "Without anti-flicker, visitors may see a layout flash.",     severity: "warn"  },
  ],

  exampleName: "Hero Value Proposition Test",
  exampleHypothesis:
    "Changing the hero headline to emphasize fast shipping will increase add-to-cart rate by 10%.",
};
