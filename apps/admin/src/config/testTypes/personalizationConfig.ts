import type { TestTypeConfig } from "./index";

export const personalizationConfig: TestTypeConfig = {
  type: "PERSONALIZATION",
  label: "Personalization",
  shortLabel: "Personalization",
  description: "Show targeted offers and experiences to specific audience segments",
  accentHex: "#c026d3",
  icon: "◎",
  baseHref: "/personalizations",
  apiPath: "/api/personalizations",

  wizardSteps: [
    {
      label: "Setup",
      title: "Define the personalization",
      description:
        "Name the personalization, set its priority, and describe who it's for.",
    },
    {
      label: "Audience",
      title: "Define your audience",
      description:
        "Build targeting rules to narrow who sees this personalization — by customer tag, device, UTM, cart value, and more.",
    },
    {
      label: "Experience",
      title: "Select offers",
      description:
        "Choose which offers from your Offers Library will be shown to this audience.",
    },
    {
      label: "Schedule",
      title: "Set a schedule",
      description:
        "Optionally set a start and end date. Without a schedule, the personalization is always active once published.",
    },
    {
      label: "Review",
      title: "Review and publish",
      description:
        "Review the audience, offers, and schedule. Publish when ready — this activates immediately.",
    },
  ],

  defaultValues: {
    name: "",
    hypothesis: "",
    priority: 1,
    variants: [
      { name: "Personalization", isControl: false, allocation: 100, settings: { offerIds: [] } },
    ],
    targetingRules: [],
    schedule: { startDate: null, endDate: null },
  },

  listColumns: [
    { key: "name",         label: "Name" },
    { key: "status",       label: "Status" },
    { key: "priority",     label: "Priority",   width: "80px" },
    { key: "offerCount",   label: "Offers",     width: "80px" },
    { key: "schedule",     label: "Schedule" },
    { key: "updatedAt",    label: "Updated" },
  ],

  analyticsCards: [
    { key: "impressions",       label: "Impressions",  unit: "count",    higherIsBetter: true },
    { key: "claimRate",         label: "Claim Rate",   unit: "percent",  higherIsBetter: true },
    { key: "revenuePerVisitor", label: "RPV",          unit: "currency", higherIsBetter: true },
    { key: "aov",               label: "AOV",          unit: "currency", higherIsBetter: true },
    { key: "conversionRate",    label: "CVR",          unit: "percent",  higherIsBetter: true },
  ],

  emptyState: {
    title: "No personalizations yet",
    body: "Show specific offers to targeted audience segments — returning visitors, high-value customers, or specific traffic sources.",
    action: "Create personalization",
  },

  guards: [
    { code: "PERSONALIZATION_NO_OFFERS",    message: "At least one offer must be selected.",                                                  severity: "block" },
    { code: "PERSONALIZATION_NO_TARGETING", message: "No targeting rules set — this personalization will show to all visitors.",             severity: "warn"  },
    { code: "PERSONALIZATION_DATE_ORDER",   message: "End date must be after start date.",                                                    severity: "block" },
    { code: "PERSONALIZATION_DATE_PAST",    message: "End date cannot be in the past.",                                                       severity: "block" },
    { code: "PERSONALIZATION_PRIORITY",     message: "Verify priority is correct — lower numbers run before higher numbers.",                 severity: "info"  },
    { code: "PERSONALIZATION_CONFLICT",     message: "Audience rules may overlap with a currently active personalization of the same type.",  severity: "warn"  },
  ],

  exampleName: "Returning Visitor Offer",
  exampleHypothesis:
    "Showing returning visitors a cart-specific incentive will increase purchase completion rate.",
};
