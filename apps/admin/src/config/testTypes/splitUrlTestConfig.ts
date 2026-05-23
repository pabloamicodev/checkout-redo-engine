import type { TestTypeConfig } from "./index";

export const splitUrlTestConfig: TestTypeConfig = {
  type: "SPLIT_URL_TEST",
  label: "Split URL Test",
  shortLabel: "Split URL",
  description: "Redirect visitors between different URLs and measure conversion impact",
  accentHex: "#0284c7",
  icon: "⇄",
  baseHref: "/split-url-tests",
  apiPath: "/api/split-url-tests",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define your test",
      description:
        "Name the test and write a hypothesis about what page or experience will convert better.",
    },
    {
      label: "URL Routes",
      title: "Configure URL routes",
      description:
        "Set the control URL (original) and one or more variant URLs to split traffic between.",
    },
    {
      label: "Traffic & Targeting",
      title: "Traffic allocation & targeting",
      description:
        "Split traffic between variants and optionally narrow to specific devices or traffic sources.",
    },
    {
      label: "Settings",
      title: "Redirect settings",
      description:
        "Configure query parameter and UTM preservation, loop protection, and SEO behaviour.",
    },
    {
      label: "Review",
      title: "Review and launch",
      description:
        "Review the redirect configuration and fix any issues before launching.",
    },
  ],

  defaultValues: {
    name: "",
    hypothesis: "",
    trafficAllocation: 100,
    variants: [
      { name: "Control", isControl: true, allocation: 50, settings: { url: "" } },
      { name: "Variant A", isControl: false, allocation: 50, settings: { url: "" } },
    ],
    splitUrlConfig: {
      preserveQueryParams: true,
      preserveUtmParams: true,
      loopProtection: true,
    },
  },

  listColumns: [
    { key: "name",        label: "Name" },
    { key: "status",      label: "Status" },
    { key: "controlUrl",  label: "Control URL", mono: true },
    { key: "variantCount", label: "Variants",   width: "80px" },
    { key: "updatedAt",   label: "Updated" },
  ],

  analyticsCards: [
    { key: "conversionRate",    label: "Landing CVR",    unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",            unit: "currency", higherIsBetter: true },
    { key: "sessions",          label: "Sessions",       unit: "count",    higherIsBetter: false },
    { key: "bounceRate",        label: "Bounce Rate",    unit: "percent",  higherIsBetter: false },
    { key: "aov",               label: "AOV",            unit: "currency", higherIsBetter: true },
  ],

  emptyState: {
    title: "No split URL tests yet",
    body: "Route a percentage of visitors to an alternate URL and measure the landing page conversion impact.",
    action: "Create split URL test",
  },

  guards: [
    { code: "SPLIT_URL_MISSING",         message: "All variants must have a URL configured.",                            severity: "block" },
    { code: "SPLIT_URL_DUPLICATE",       message: "Variant URLs must be unique — duplicates detected.",                  severity: "block" },
    { code: "SPLIT_URL_INVALID_FORMAT",  message: "URLs must be valid absolute paths or full URLs.",                     severity: "block" },
    { code: "SPLIT_URL_SAME_AS_CONTROL", message: "Variant URL cannot be the same as the control URL.",                 severity: "block" },
    { code: "SPLIT_URL_LOOP_PROTECTION", message: "Loop protection is recommended to prevent infinite redirect loops.",  severity: "warn"  },
    { code: "SPLIT_URL_SEO_CANONICAL",   message: "Ensure canonical tags are correct across variant pages.",             severity: "warn"  },
    { code: "SPLIT_URL_EXTERNAL_DOMAIN", message: "Redirecting to external domains may affect SEO and trust.",          severity: "warn"  },
  ],

  exampleName: "Landing Page Layout Test",
  exampleHypothesis:
    "Sending paid traffic to the long-form landing page will increase conversion rate compared to the standard PDP.",
};
