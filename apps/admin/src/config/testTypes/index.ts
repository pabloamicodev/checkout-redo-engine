/**
 * Declarative Test Type Config System
 *
 * Each test type exports a `TestTypeConfig` that centralises all
 * metadata, copy, wizard steps, analytics cards, list columns,
 * validation, and guard messages for that type.
 *
 * Import the `TEST_TYPE_CONFIGS` map to get the config for any type:
 *   const config = TEST_TYPE_CONFIGS["CONTENT_TEST"];
 */

import type { TestTypeConfig as ThemeConfig } from "@/lib/design/testTypeTheme";

// ---------------------------------------------------------------------------
// Core shape
// ---------------------------------------------------------------------------

export interface WizardStepDef {
  label: string;
  title: string;
  description: string;
}

export interface ListColumn {
  key: string;
  label: string;
  width?: string;
  mono?: boolean;
}

export interface AnalyticsCardDef {
  key: string;
  label: string;
  unit?: "currency" | "percent" | "count" | "number";
  icon?: string;
  higherIsBetter?: boolean;
}

export interface EmptyStateDef {
  title: string;
  body: string;
  action: string;
}

export interface GuardMessage {
  code: string;
  message: string;
  severity: "block" | "warn" | "info";
}

export interface TestTypeConfig {
  /** The Prisma/API type key */
  type: string;
  /** Human label */
  label: string;
  shortLabel: string;
  /** One-liner for empty states and sub-navs */
  description: string;
  /** Accent colour hex */
  accentHex: string;
  /** Emoji icon for hero headers */
  icon: string;
  /** Route prefix, e.g. /content-tests */
  baseHref: string;
  /** API route prefix, e.g. /api/content-tests */
  apiPath: string;
  /** Whether this type is considered high-risk */
  highRisk?: boolean;
  /** Wizard steps in order */
  wizardSteps: WizardStepDef[];
  /** Default values for a brand-new experiment */
  defaultValues: Record<string, unknown>;
  /** List page column definitions */
  listColumns: ListColumn[];
  /** Analytics metric cards to show on the detail page */
  analyticsCards: AnalyticsCardDef[];
  /** Empty state copy */
  emptyState: EmptyStateDef;
  /** Guard messages, keyed by code */
  guards: GuardMessage[];
  /** Example name for hypothesis placeholder */
  exampleName: string;
  exampleHypothesis: string;
  /** Theme (loaded separately from testTypeTheme.ts) */
  theme?: ThemeConfig;
}

// ---------------------------------------------------------------------------
// Lazy imports (avoid circular deps with testTypeTheme.ts)
// ---------------------------------------------------------------------------


export { splitUrlTestConfig }  from "./splitUrlTestConfig";
export { discountTestConfig }  from "./discountTestConfig";
export { shippingTestConfig }  from "./shippingTestConfig";
export { personalizationConfig } from "./personalizationConfig";
import { contentTestConfig }    from "./contentTestConfig";
import { splitUrlTestConfig }   from "./splitUrlTestConfig";
import { offerTestConfig }      from "./offerTestConfig";
import { checkoutTestConfig }   from "./checkoutTestConfig";
import { discountTestConfig }   from "./discountTestConfig";
import { shippingTestConfig }   from "./shippingTestConfig";
import { priceTestConfig }      from "./priceTestConfig";
import { personalizationConfig } from "./personalizationConfig";

export const TEST_TYPE_CONFIGS: Record<string, TestTypeConfig> = {
  CONTENT_TEST:     contentTestConfig,
  SPLIT_URL_TEST:   splitUrlTestConfig,
  OFFER_TEST:       offerTestConfig,
  CHECKOUT_TEST:    checkoutTestConfig,
  DISCOUNT_TEST:    discountTestConfig,
  SHIPPING_TEST:    shippingTestConfig,
  PRICE_TEST:       priceTestConfig,
  PERSONALIZATION:  personalizationConfig,
};

/** Returns the config for a given type key, or undefined. */
export function getTestTypeConfig(type: string): TestTypeConfig | undefined {
  return TEST_TYPE_CONFIGS[type];
}
