export type PlanKey = "free" | "growth" | "pro" | "enterprise";

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  price: number; // USD/month, 0 = free
  currency: "USD";
  trialDays: number;
  // Limits — Infinity = unlimited
  maxRunningExperiments: number;
  maxActiveOffers: number;
  maxCheckoutBlocks: number;
  maxIntegrations: number;
  hasAdvancedAnalytics: boolean;
  hasSegmentBreakdowns: boolean;
  hasProfitTracking: boolean;
  hasWebhookIntegrations: boolean;
  hasPrioritySupport: boolean;
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    description: "Get started with basic A/B testing",
    price: 0,
    currency: "USD",
    trialDays: 0,
    maxRunningExperiments: 1,
    maxActiveOffers: 0,
    maxCheckoutBlocks: 1,
    maxIntegrations: 0,
    hasAdvancedAnalytics: false,
    hasSegmentBreakdowns: false,
    hasProfitTracking: false,
    hasWebhookIntegrations: false,
    hasPrioritySupport: false,
  },
  growth: {
    key: "growth",
    name: "Growth",
    description: "Scale your testing with full analytics",
    price: 49,
    currency: "USD",
    trialDays: 14,
    maxRunningExperiments: 10,
    maxActiveOffers: 5,
    maxCheckoutBlocks: 10,
    maxIntegrations: 3,
    hasAdvancedAnalytics: true,
    hasSegmentBreakdowns: true,
    hasProfitTracking: true,
    hasWebhookIntegrations: false,
    hasPrioritySupport: false,
  },
  pro: {
    key: "pro",
    name: "Pro",
    description: "Unlimited testing with all integrations",
    price: 149,
    currency: "USD",
    trialDays: 14,
    maxRunningExperiments: Infinity,
    maxActiveOffers: Infinity,
    maxCheckoutBlocks: Infinity,
    maxIntegrations: Infinity,
    hasAdvancedAnalytics: true,
    hasSegmentBreakdowns: true,
    hasProfitTracking: true,
    hasWebhookIntegrations: true,
    hasPrioritySupport: false,
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    description: "Custom limits with dedicated support",
    price: 499,
    currency: "USD",
    trialDays: 14,
    maxRunningExperiments: Infinity,
    maxActiveOffers: Infinity,
    maxCheckoutBlocks: Infinity,
    maxIntegrations: Infinity,
    hasAdvancedAnalytics: true,
    hasSegmentBreakdowns: true,
    hasProfitTracking: true,
    hasWebhookIntegrations: true,
    hasPrioritySupport: true,
  },
};

export const PLAN_ORDER: PlanKey[] = ["free", "growth", "pro", "enterprise"];

export function getPlan(key: string): PlanDefinition {
  return PLANS[key as PlanKey] ?? PLANS.free;
}

export function isPaidPlan(key: string): boolean {
  return key !== "free";
}

export type LimitType = "experiments" | "offers" | "checkoutBlocks" | "integrations";

export interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number;
  planKey: string;
  upgradeRequired: PlanKey | null; // next plan that would allow it
}

/**
 * Feature keys that can be checked against a plan.
 * Used for gating advanced features beyond the simple count limits.
 */
export type FeatureKey =
  | "advancedAnalytics"
  | "segmentBreakdowns"
  | "profitTracking"
  | "webhookIntegrations"
  | "prioritySupport";

/**
 * Maps a PlanDefinition boolean field to a FeatureKey.
 */
const FEATURE_FIELD_MAP: Record<FeatureKey, keyof PlanDefinition> = {
  advancedAnalytics: "hasAdvancedAnalytics",
  segmentBreakdowns: "hasSegmentBreakdowns",
  profitTracking: "hasProfitTracking",
  webhookIntegrations: "hasWebhookIntegrations",
  prioritySupport: "hasPrioritySupport",
};

/**
 * Returns true if the given plan includes the specified feature.
 *
 * Usage:
 *   if (!planHasFeature(shopPlan.key, 'profitTracking')) {
 *     return NextResponse.json({ error: 'Upgrade to Growth to access profit analytics' }, { status: 402 });
 *   }
 */
export function planHasFeature(planKey: string, feature: FeatureKey): boolean {
  const plan = getPlan(planKey);
  const field = FEATURE_FIELD_MAP[feature];
  return plan[field] === true;
}

/**
 * Returns the minimum plan key required for a given feature.
 * Useful for generating upgrade CTAs.
 */
export function minimumPlanForFeature(feature: FeatureKey): PlanKey {
  for (const key of PLAN_ORDER) {
    if (planHasFeature(key, feature)) return key;
  }
  return "enterprise";
}
