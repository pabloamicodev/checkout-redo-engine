"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { UpgradePlanModal } from "@/components/ui/UpgradePlanModal";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AMBER = "#d97706";
const ACCENT = AMBER;
const ACCENT_GRADIENT = "linear-gradient(135deg, #d97706 0%, #b45309 100%)";

type DiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "PRODUCT_DISCOUNT"
  | "ORDER_DISCOUNT"
  | "SHIPPING_DISCOUNT"
  | "VOLUME_DISCOUNT"
  | "BUY_X_GET_Y";

type StackingMode = "exclusive" | "additive" | "first_only";
type TargetingScope = "all" | "specific_products" | "specific_collections";

interface Tier {
  minQty: number;
  discountPct: number;
}

interface DiscountConfig {
  discountType: DiscountType;
  // PERCENTAGE
  percentage?: number;
  // FIXED_AMOUNT
  amount?: number;
  // VOLUME_DISCOUNT
  tiers?: Tier[];
  // BUY_X_GET_Y
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPct?: number;
  // SHIPPING_DISCOUNT
  freeShipping?: boolean;
  shippingDiscountPct?: number;
}

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  discountConfig: DiscountConfig | null;
}

interface WizardState {
  // Step 1
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  // Step 2
  discountType: DiscountType;
  // Step 3
  minOrderSubtotal: number;
  minQuantity: number;
  targetingScope: TargetingScope;
  targetProductIds: string;
  targetCollectionIds: string;
  usageLimitPerCustomer: number | "";
  // Step 4
  variants: VariantConfig[];
  // Step 5
  stackingMode: StackingMode | "";
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

const STEP_LABELS = [
  "Setup",
  "Discount Type",
  "Eligibility",
  "Variant Discounts",
  "Stacking",
  "Review",
] as const;

const CONTINUE_LABELS: Record<number, string> = {
  0: "Choose discount type",
  1: "Set eligibility",
  2: "Configure variants",
  3: "Set stacking rules",
  4: "Review & launch",
};

const STEP_TITLES = [
  "Define your discount experiment",
  "Choose a discount type",
  "Set eligibility rules",
  "Configure discount values",
  "Configure stacking behavior",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a hypothesis about whether this discount mechanic will outperform the control.",
  "Select the discount mechanism to test — percentage, fixed amount, BXGY, volume, or shipping.",
  "Define who qualifies for the discount — by cart value, quantity, product, or collection.",
  "Set the discount value for each variant. The control has no discount applied.",
  "Choose how this discount interacts with other active discounts in the store.",
  "Review the complete discount test configuration and fix any issues before creating the test.",
];

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

const DISCOUNT_TYPE_OPTIONS: {
  value: DiscountType;
  icon: string;
  title: string;
  desc: string;
  hint: string;
}[] = [
  {
    value: "PERCENTAGE",
    icon: "%",
    title: "Percentage Off",
    desc: "Percentage off the entire order",
    hint: "e.g., 10% off all orders",
  },
  {
    value: "FIXED_AMOUNT",
    icon: "$",
    title: "Fixed Amount Off",
    desc: "Fixed dollar amount off the order",
    hint: "e.g., $15 off orders over $100",
  },
  {
    value: "PRODUCT_DISCOUNT",
    icon: "🏷",
    title: "Product Discount",
    desc: "Discount applied to specific products",
    hint: "e.g., 20% off specific products",
  },
  {
    value: "ORDER_DISCOUNT",
    icon: "🧾",
    title: "Order Discount",
    desc: "Discount applied at the order level",
    hint: "e.g., $10 off any order",
  },
  {
    value: "SHIPPING_DISCOUNT",
    icon: "🚚",
    title: "Shipping Discount",
    desc: "Free or discounted shipping",
    hint: "e.g., Free shipping on all orders",
  },
  {
    value: "VOLUME_DISCOUNT",
    icon: "📦",
    title: "Volume Discount",
    desc: "Tiered pricing based on quantity",
    hint: "e.g., Buy 3+ get 15% off",
  },
  {
    value: "BUY_X_GET_Y",
    icon: "🤝",
    title: "Buy X Get Y",
    desc: "Buy X items, get Y free or discounted",
    hint: "e.g., Buy 2, get 1 free",
  },
];

const DEFAULT_CONFIG: Record<DiscountType, DiscountConfig> = {
  PERCENTAGE:       { discountType: "PERCENTAGE",       percentage: 10 },
  FIXED_AMOUNT:     { discountType: "FIXED_AMOUNT",     amount: 15 },
  PRODUCT_DISCOUNT: { discountType: "PRODUCT_DISCOUNT", percentage: 10 },
  ORDER_DISCOUNT:   { discountType: "ORDER_DISCOUNT",   percentage: 10 },
  SHIPPING_DISCOUNT:{ discountType: "SHIPPING_DISCOUNT", freeShipping: true, shippingDiscountPct: 0 },
  VOLUME_DISCOUNT:  { discountType: "VOLUME_DISCOUNT",  tiers: [{ minQty: 2, discountPct: 10 }, { minQty: 5, discountPct: 20 }] },
  BUY_X_GET_Y:      { discountType: "BUY_X_GET_Y",      buyQuantity: 2, getQuantity: 1, getDiscountPct: 100 },
};

function emptyVariant(isControl: boolean, nonControlIdx: number): VariantConfig {
  return {
    key: isControl ? "control" : `variant_${String.fromCharCode(97 + nonControlIdx)}`,
    name: isControl ? "Control (no discount)" : `Variant ${String.fromCharCode(65 + nonControlIdx)}`,
    isControl,
    allocationPercent: 50,
    discountConfig: isControl ? null : { ...DEFAULT_CONFIG.PERCENTAGE },
  };
}

function discountSummary(cfg: DiscountConfig): string {
  switch (cfg.discountType) {
    case "PERCENTAGE":
    case "PRODUCT_DISCOUNT":
    case "ORDER_DISCOUNT":
      return `${cfg.percentage ?? 0}% off`;
    case "FIXED_AMOUNT":
      return `$${cfg.amount ?? 0} off`;
    case "SHIPPING_DISCOUNT":
      return cfg.freeShipping ? "Free shipping" : `${cfg.shippingDiscountPct ?? 0}% off shipping`;
    case "VOLUME_DISCOUNT":
      return `Volume — ${cfg.tiers?.length ?? 0} tier(s)`;
    case "BUY_X_GET_Y":
      return `Buy ${cfg.buyQuantity ?? 0} Get ${cfg.getQuantity ?? 0} (${cfg.getDiscountPct ?? 100}% off)`;
    default:
      return "—";
  }
}

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  discountType: "PERCENTAGE",
  minOrderSubtotal: 0,
  minQuantity: 0,
  targetingScope: "all",
  targetProductIds: "",
  targetCollectionIds: "",
  usageLimitPerCustomer: "",
  variants: [emptyVariant(true, 0), emptyVariant(false, 0)],
  stackingMode: "",
};

// ---------------------------------------------------------------------------
// Simulated cart for preview panel
// ---------------------------------------------------------------------------
const SIM_CART_TOTAL = 120.0;
const SIM_CART_QTY = 2;

function calcSimDiscount(cfg: DiscountConfig | null): number {
  if (!cfg) return 0;
  switch (cfg.discountType) {
    case "PERCENTAGE":
    case "PRODUCT_DISCOUNT":
    case "ORDER_DISCOUNT":
      return parseFloat(((SIM_CART_TOTAL * (cfg.percentage ?? 0)) / 100).toFixed(2));
    case "FIXED_AMOUNT":
      return Math.min(cfg.amount ?? 0, SIM_CART_TOTAL);
    case "SHIPPING_DISCOUNT":
      return cfg.freeShipping ? 7.99 : parseFloat(((7.99 * (cfg.shippingDiscountPct ?? 0)) / 100).toFixed(2));
    case "VOLUME_DISCOUNT": {
      const tiers = (cfg.tiers ?? []).slice().sort((a, b) => b.minQty - a.minQty);
      const applicableTier = tiers.find((t) => SIM_CART_QTY >= t.minQty);
      if (!applicableTier) return 0;
      return parseFloat(((SIM_CART_TOTAL * applicableTier.discountPct) / 100).toFixed(2));
    }
    case "BUY_X_GET_Y": {
      const buyQty = cfg.buyQuantity ?? 1;
      if (SIM_CART_QTY < buyQty) return 0;
      const unitPrice = SIM_CART_TOTAL / SIM_CART_QTY;
      const freeItems = cfg.getQuantity ?? 1;
      return parseFloat((unitPrice * freeItems * ((cfg.getDiscountPct ?? 100) / 100)).toFixed(2));
    }
    default:
      return 0;
  }
}

function isSimCartEligible(minSubtotal: number, minQty: number): boolean {
  return SIM_CART_TOTAL >= (minSubtotal || 0) && SIM_CART_QTY >= (minQty || 0);
}

// ---------------------------------------------------------------------------
// DiscountPreviewPanel
// ---------------------------------------------------------------------------
function DiscountPreviewPanel({
  step,
  discountType,
  eligibility,
  variantDiscounts,
  stackingMode,
  setup,
  variants,
}: {
  step: number;
  discountType: DiscountType;
  eligibility: { minOrderSubtotal: number; minQuantity: number; targetingScope: TargetingScope };
  variantDiscounts: VariantConfig[];
  stackingMode: StackingMode | "";
  setup: { name: string; trafficAllocation: number };
  variants: VariantConfig[];
}) {
  const cartEligible = isSimCartEligible(eligibility.minOrderSubtotal, eligibility.minQuantity);

  const discountTypeLabel = DISCOUNT_TYPE_OPTIONS.find((o) => o.value === discountType)?.title ?? discountType;
  const stackLabel =
    stackingMode === "exclusive"
      ? "Exclusive"
      : stackingMode === "additive"
      ? "Additive"
      : stackingMode === "first_only"
      ? "Highest wins"
      : "Not set";

  return (
    <div className="space-y-3">
      {/* Example cart */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ background: "#d977060a", borderBottom: "1px solid #d9770615" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: AMBER }}>
            Example Cart
          </span>
        </div>
        <div className="px-3 py-2.5 space-y-1">
          <div className="flex justify-between">
            <span className="text-xs text-neutral-600">Product A &times; 1</span>
            <span className="text-xs font-medium text-neutral-800">$79.99</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-neutral-600">Product B &times; 1</span>
            <span className="text-xs font-medium text-neutral-800">$40.01</span>
          </div>
          <div className="border-t border-neutral-100 pt-1.5 mt-1.5 flex justify-between">
            <span className="text-xs font-semibold text-neutral-700">Subtotal</span>
            <span className="text-xs font-bold text-neutral-900">$120.00</span>
          </div>
        </div>
        {/* Eligibility badge */}
        <div className="px-3 pb-2.5">
          {eligibility.minOrderSubtotal > 0 || eligibility.minQuantity > 0 ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
              style={{
                background: cartEligible ? "#d1fae5" : "#fee2e2",
                color: cartEligible ? "#065f46" : "#991b1b",
              }}
            >
              <span>{cartEligible ? "✓" : "✗"}</span>
              <span>
                {cartEligible
                  ? "Eligible for discount"
                  : `Not eligible — requires ${eligibility.minOrderSubtotal > 0 ? `$${eligibility.minOrderSubtotal} min` : ""}${eligibility.minOrderSubtotal > 0 && eligibility.minQuantity > 0 ? " & " : ""}${eligibility.minQuantity > 0 ? `${eligibility.minQuantity}+ items` : ""}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-green-50 text-green-700">
              <span>✓</span>
              <span>No minimum requirements</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-variant discount calculator */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ background: "#d977060a", borderBottom: "1px solid #d9770615" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: AMBER }}>
            Discount Calculator
          </span>
        </div>
        <div className="divide-y divide-neutral-50">
          {variants.map((v) => {
            const discountAmt = calcSimDiscount(v.discountConfig);
            const total = SIM_CART_TOTAL - discountAmt;
            const savingsPct = discountAmt > 0 ? ((discountAmt / SIM_CART_TOTAL) * 100).toFixed(1) : "0";

            // Special BUY_X_GET_Y display
            const isBxgy = v.discountConfig?.discountType === "BUY_X_GET_Y";
            const isVolume = v.discountConfig?.discountType === "VOLUME_DISCOUNT";

            return (
              <div key={v.key} className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {v.isControl ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                      Control
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: "#d977060d", color: AMBER }}
                    >
                      {v.name}
                    </span>
                  )}
                </div>

                {v.isControl ? (
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-neutral-500">Subtotal</span>
                      <span className="text-[11px] text-neutral-700">$120.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-neutral-500">Discount</span>
                      <span className="text-[11px] text-neutral-400">—</span>
                    </div>
                    <div className="flex justify-between border-t border-neutral-100 pt-1 mt-1">
                      <span className="text-[11px] font-semibold text-neutral-700">Total</span>
                      <span className="text-[11px] font-bold text-neutral-900">$120.00</span>
                    </div>
                  </div>
                ) : isVolume ? (
                  // Volume: show tier table
                  <div>
                    <div className="space-y-0.5 mb-1.5">
                      {(v.discountConfig?.tiers ?? []).map((tier, ti) => {
                        const tierAmt = parseFloat(((SIM_CART_TOTAL * tier.discountPct) / 100).toFixed(2));
                        const active = SIM_CART_QTY >= tier.minQty;
                        return (
                          <div
                            key={ti}
                            className="flex justify-between items-center px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              background: active ? "#d977060d" : "transparent",
                            }}
                          >
                            <span style={{ color: active ? AMBER : "#9ca3af" }}>
                              {active ? "✓" : "○"} {tier.minQty}+ items
                            </span>
                            <span style={{ color: active ? AMBER : "#9ca3af" }}>
                              -{tier.discountPct}% (${tierAmt})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {discountAmt > 0 && (
                      <div className="flex justify-between border-t border-neutral-100 pt-1 mt-1">
                        <span className="text-[11px] font-semibold text-neutral-700">You save</span>
                        <span className="text-[11px] font-bold" style={{ color: AMBER }}>
                          ${discountAmt} ({savingsPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                ) : isBxgy ? (
                  // BUY_X_GET_Y summary
                  <div>
                    <p
                      className="text-[11px] font-medium mb-1.5"
                      style={{ color: AMBER }}
                    >
                      Buy {v.discountConfig?.buyQuantity ?? 2}, get {v.discountConfig?.getQuantity ?? 1} at{" "}
                      {v.discountConfig?.getDiscountPct === 100
                        ? "free"
                        : `${v.discountConfig?.getDiscountPct ?? 100}% off`}
                    </p>
                    {SIM_CART_QTY >= (v.discountConfig?.buyQuantity ?? 2) ? (
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-[11px] text-neutral-500">Discount</span>
                          <span className="text-[11px] font-semibold" style={{ color: AMBER }}>
                            -${discountAmt}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-neutral-100 pt-1 mt-1">
                          <span className="text-[11px] font-semibold text-neutral-700">Total</span>
                          <span className="text-[11px] font-bold text-neutral-900">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-400">
                        Cart needs {(v.discountConfig?.buyQuantity ?? 2) - SIM_CART_QTY} more item(s)
                      </p>
                    )}
                  </div>
                ) : (
                  // Normal percentage / fixed / shipping
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-neutral-500">Subtotal</span>
                      <span className="text-[11px] text-neutral-700">$120.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-neutral-500">Discount</span>
                      {discountAmt > 0 ? (
                        <span className="text-[11px] font-semibold" style={{ color: AMBER }}>
                          -${discountAmt.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">—</span>
                      )}
                    </div>
                    <div className="flex justify-between border-t border-neutral-100 pt-1 mt-1">
                      <span className="text-[11px] font-semibold text-neutral-700">Total</span>
                      <span className="text-[11px] font-bold text-neutral-900">${total.toFixed(2)}</span>
                    </div>
                    {discountAmt > 0 && (
                      <div
                        className="flex justify-between pt-0.5"
                      >
                        <span className="text-[10px] text-neutral-400">Savings</span>
                        <span className="text-[10px] font-medium" style={{ color: AMBER }}>
                          ${discountAmt.toFixed(2)} ({savingsPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stacking diagram (step 4) */}
      {step >= 4 && stackingMode && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div
            className="px-3 py-2"
            style={{ background: "#d977060a", borderBottom: "1px solid #d9770615" }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: AMBER }}>
              Stacking Behavior
            </span>
          </div>
          <div className="px-3 py-2.5">
            {stackingMode === "exclusive" && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-800 mb-1.5">Exclusive</p>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: "#d977060d", color: AMBER }}
                  >
                    This discount
                  </span>
                  <span>blocks all others</span>
                </div>
                <div className="mt-1.5 px-2 py-1 rounded bg-red-50 text-[10px] text-red-600">
                  No other discount codes apply at checkout.
                </div>
              </div>
            )}
            {stackingMode === "additive" && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-800 mb-1.5">Additive</p>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 flex-wrap">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: "#d977060d", color: AMBER }}
                  >
                    This discount
                  </span>
                  <span>+</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                    Other discounts
                  </span>
                  <span>= combined savings</span>
                </div>
                <div className="mt-1.5 px-2 py-1 rounded bg-green-50 text-[10px] text-green-700">
                  Stacks with other active discount codes.
                </div>
              </div>
            )}
            {stackingMode === "first_only" && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-800 mb-1.5">Highest Wins</p>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 flex-wrap">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: "#d977060d", color: AMBER }}
                  >
                    This discount
                  </span>
                  <span>or</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                    Other discounts
                  </span>
                  <span>— highest applies</span>
                </div>
                <div className="mt-1.5 px-2 py-1 rounded bg-amber-50 text-[10px] text-amber-700">
                  Applied first; other discounts are blocked.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Config summary */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Summary</p>
        <div className="flex justify-between">
          <span className="text-[11px] text-neutral-500">Discount type</span>
          <span className="text-[11px] font-medium text-neutral-800">{discountTypeLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-neutral-500">Variants</span>
          <span className="text-[11px] font-medium text-neutral-800">{variants.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-neutral-500">Stacking</span>
          <span className="text-[11px] font-medium text-neutral-800">{stackLabel}</span>
        </div>
        {setup.trafficAllocation < 100 && (
          <div className="flex justify-between">
            <span className="text-[11px] text-neutral-500">Traffic</span>
            <span className="text-[11px] font-medium text-neutral-800">{setup.trafficAllocation}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Setup
// ---------------------------------------------------------------------------
function StepSetup({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection
        title="Test details"
        description="Give this test a clear name so you can find it later."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required>
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="input-base"
              placeholder="15% vs 20% Discount Test"
            />
          </FormField>

          <FormField
            label="Hypothesis"
            hint="Describe what you expect to happen and why."
          >
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className="input-base resize-none"
              placeholder="A fixed $15 discount will create higher perceived value than 10% off, increasing conversion without hurting revenue per visitor."
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Traffic"
        description="What percentage of visitors should be included in this test?"
        accent={ACCENT}
      >
        <FormField
          label="Traffic allocation (%)"
          hint="The remaining visitors see your default pricing."
        >
          <input
            type="number"
            min={1}
            max={100}
            value={state.trafficAllocation}
            onChange={(e) =>
              onChange({ trafficAllocation: parseFloat(e.target.value) || 100 })
            }
            className="input-base w-32"
          />
        </FormField>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Discount Type
// ---------------------------------------------------------------------------
function StepDiscountType({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function selectType(type: DiscountType) {
    const updatedVariants = state.variants.map((v) =>
      v.isControl
        ? v
        : { ...v, discountConfig: { ...DEFAULT_CONFIG[type] } }
    );
    onChange({ discountType: type, variants: updatedVariants });
  }

  return (
    <FormSection
      title="Choose a discount type"
      description="All test variants will use this type. You'll configure values per variant in Step 4."
      accent={ACCENT}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DISCOUNT_TYPE_OPTIONS.map((opt) => {
          const selected = state.discountType === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectType(opt.value)}
              className="flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm"
              style={{
                borderColor: selected ? AMBER : "#e5e7eb",
                background: selected ? "#fffbeb" : "#fff",
                boxShadow: selected ? `0 0 0 3px ${AMBER}22` : undefined,
              }}
            >
              <span className="text-xl leading-none shrink-0 mt-0.5">{opt.icon}</span>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: selected ? AMBER : "#111827" }}
                >
                  {opt.title}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  {opt.desc}
                </p>
                <p
                  className="text-[10px] mt-1.5 font-medium"
                  style={{ color: selected ? AMBER : "#9ca3af" }}
                >
                  {opt.hint}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </FormSection>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Eligibility
// ---------------------------------------------------------------------------
function StepEligibility({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const isProductType =
    state.discountType === "PRODUCT_DISCOUNT" ||
    state.discountType === "VOLUME_DISCOUNT" ||
    state.discountType === "BUY_X_GET_Y";

  return (
    <div className="space-y-6">
      <FormSection
        title="Minimum requirements"
        description="Visitors must meet these thresholds before the discount applies."
        accent={ACCENT}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Min order subtotal ($)"
            hint="0 = no minimum"
          >
            <input
              type="number"
              min={0}
              step={0.01}
              value={state.minOrderSubtotal}
              onChange={(e) =>
                onChange({ minOrderSubtotal: parseFloat(e.target.value) || 0 })
              }
              className="input-base"
            />
          </FormField>
          <FormField label="Min quantity" hint="0 = no minimum">
            <input
              type="number"
              min={0}
              step={1}
              value={state.minQuantity}
              onChange={(e) =>
                onChange({ minQuantity: parseInt(e.target.value) || 0 })
              }
              className="input-base"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Product / collection targeting"
        description="Restrict which products are eligible for the discount."
        accent={ACCENT}
      >
        <div className="space-y-3">
          {(
            [
              { value: "all",                  label: "All products" },
              { value: "specific_products",    label: "Specific products" },
              { value: "specific_collections", label: "Specific collections" },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <span
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                style={{
                  borderColor:
                    state.targetingScope === opt.value ? ACCENT : "#d1d5db",
                  background:
                    state.targetingScope === opt.value ? ACCENT : "white",
                }}
              >
                {state.targetingScope === opt.value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
              <input
                type="radio"
                className="sr-only"
                checked={state.targetingScope === opt.value}
                onChange={() => onChange({ targetingScope: opt.value })}
              />
              <span className="text-sm text-neutral-700">{opt.label}</span>
            </label>
          ))}

          {state.targetingScope === "specific_products" && (
            <FormField
              label="Product IDs"
              hint="Enter Shopify product IDs, e.g. 12345,67890"
              className="mt-3"
            >
              <input
                type="text"
                value={state.targetProductIds}
                onChange={(e) => onChange({ targetProductIds: e.target.value })}
                className="input-base"
                placeholder="12345,67890,11223"
              />
            </FormField>
          )}

          {state.targetingScope === "specific_collections" && (
            <FormField
              label="Collection IDs"
              hint="Enter Shopify collection IDs, e.g. 12345,67890"
              className="mt-3"
            >
              <input
                type="text"
                value={state.targetCollectionIds}
                onChange={(e) =>
                  onChange({ targetCollectionIds: e.target.value })
                }
                className="input-base"
                placeholder="12345,67890"
              />
            </FormField>
          )}

          {isProductType && state.targetingScope === "all" && (
            <InlineAlert variant="warning" className="mt-2">
              For product discounts, specifying eligible products or collections is strongly recommended.
            </InlineAlert>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Usage limits"
        description="Optionally cap how many times a customer can redeem this discount."
        accent={ACCENT}
      >
        <FormField label="Usage limit per customer" hint="Leave blank for unlimited.">
          <input
            type="number"
            min={1}
            step={1}
            value={state.usageLimitPerCustomer}
            onChange={(e) =>
              onChange({
                usageLimitPerCustomer:
                  e.target.value === "" ? "" : parseInt(e.target.value) || 1,
              })
            }
            className="input-base w-32"
            placeholder="—"
          />
        </FormField>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discount value editor for a single non-control variant
// ---------------------------------------------------------------------------
function VariantDiscountEditor({
  config,
  onChange,
}: {
  config: DiscountConfig;
  onChange: (patch: Partial<DiscountConfig>) => void;
}) {
  function updateTier(index: number, patch: Partial<Tier>) {
    const tiers = [...(config.tiers ?? [])];
    tiers[index] = { ...tiers[index]!, ...patch };
    onChange({ tiers });
  }

  function addTier() {
    const tiers = [...(config.tiers ?? [])];
    const lastMinQty = tiers[tiers.length - 1]?.minQty ?? 0;
    tiers.push({ minQty: lastMinQty + 1, discountPct: 5 });
    onChange({ tiers });
  }

  function removeTier(index: number) {
    onChange({ tiers: (config.tiers ?? []).filter((_, i) => i !== index) });
  }

  const tiersOutOfOrder =
    (config.tiers ?? []).some(
      (t, i, arr) => i > 0 && t.minQty <= arr[i - 1]!.minQty
    );

  if (
    config.discountType === "PERCENTAGE" ||
    config.discountType === "PRODUCT_DISCOUNT" ||
    config.discountType === "ORDER_DISCOUNT"
  ) {
    const pct = config.percentage ?? 0;
    const invalid = pct <= 0 || pct > 100;
    const isZero = pct === 0;
    const isOver100 = config.discountType === "PERCENTAGE" && pct > 100;
    return (
      <div className="space-y-2">
        <FormField label="Discount (%)" required>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={pct}
              onChange={(e) =>
                onChange({ percentage: parseFloat(e.target.value) || 0 })
              }
              className={`input-base w-28${isZero || isOver100 ? " border-red-400" : ""}`}
            />
            <span className="text-sm text-neutral-400">%</span>
          </div>
          {isOver100 && (
            <p className="text-xs text-red-500 mt-1">Percentage discount cannot exceed 100%</p>
          )}
          {isZero && (
            <p className="text-xs text-red-500 mt-1">Discount value must be greater than 0</p>
          )}
        </FormField>
        {invalid && (
          <InlineAlert variant="danger">
            Percentage must be between 1 and 100.
          </InlineAlert>
        )}
      </div>
    );
  }

  if (config.discountType === "FIXED_AMOUNT") {
    const amt = config.amount ?? 0;
    const invalid = amt <= 0;
    return (
      <div className="space-y-2">
        <FormField label="Discount amount ($)" required>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">$</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amt}
              onChange={(e) =>
                onChange({ amount: parseFloat(e.target.value) || 0 })
              }
              className={`input-base w-28${invalid ? " border-red-400" : ""}`}
            />
          </div>
          {invalid && (
            <p className="text-xs text-red-500 mt-1">Discount value must be greater than 0</p>
          )}
        </FormField>
        {invalid && (
          <InlineAlert variant="danger">Amount must be greater than $0.</InlineAlert>
        )}
      </div>
    );
  }

  if (config.discountType === "VOLUME_DISCOUNT") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600">
            Volume tiers
          </span>
          <button
            type="button"
            onClick={addTier}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: ACCENT }}
          >
            <Plus className="w-3 h-3" /> Add tier
          </button>
        </div>

        {(config.tiers ?? []).length === 0 && (
          <InlineAlert variant="danger">At least one tier is required.</InlineAlert>
        )}

        {tiersOutOfOrder && (
          <InlineAlert variant="warning">
            Tiers must be in ascending order of minimum quantity.
          </InlineAlert>
        )}

        <div className="space-y-2">
          {(config.tiers ?? []).map((tier, ti, arr) => {
            const tierOutOfOrder = ti > 0 && tier.minQty <= arr[ti - 1]!.minQty;
            return (
            <div key={ti} className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                {ti === 0 && (
                  <label className="block text-[11px] text-neutral-500 mb-1">
                    Min qty
                  </label>
                )}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={tier.minQty}
                  onChange={(e) =>
                    updateTier(ti, { minQty: parseInt(e.target.value) || 1 })
                  }
                  className={`input-base${tierOutOfOrder ? " border-red-400" : ""}`}
                />
                {tierOutOfOrder && (
                  <p className="text-xs text-red-500 mt-1">Tier thresholds must be in ascending order</p>
                )}
              </div>
              <div className="col-span-2">
                {ti === 0 && (
                  <label className="block text-[11px] text-neutral-500 mb-1">
                    Discount (%)
                  </label>
                )}
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={tier.discountPct}
                  onChange={(e) =>
                    updateTier(ti, {
                      discountPct: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input-base"
                />
              </div>
              <div className="col-span-1 flex items-end pb-0.5">
                {(config.tiers ?? []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(ti)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (config.discountType === "BUY_X_GET_Y") {
    return (
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Buy X" required>
          <input
            type="number"
            min={1}
            step={1}
            value={config.buyQuantity ?? 1}
            onChange={(e) =>
              onChange({ buyQuantity: parseInt(e.target.value) || 1 })
            }
            className="input-base"
          />
        </FormField>
        <FormField label="Get Y" required>
          <input
            type="number"
            min={1}
            step={1}
            value={config.getQuantity ?? 1}
            onChange={(e) =>
              onChange({ getQuantity: parseInt(e.target.value) || 1 })
            }
            className="input-base"
          />
        </FormField>
        <FormField label="Y discount (%)" required>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={config.getDiscountPct ?? 100}
            onChange={(e) =>
              onChange({ getDiscountPct: parseFloat(e.target.value) || 100 })
            }
            className="input-base"
          />
        </FormField>
      </div>
    );
  }

  if (config.discountType === "SHIPPING_DISCOUNT") {
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.freeShipping ?? false}
            onChange={(e) => onChange({ freeShipping: e.target.checked })}
            className="rounded"
            style={{ accentColor: ACCENT }}
          />
          <span className="text-sm text-neutral-700">Free shipping</span>
        </label>
        {!config.freeShipping && (
          <FormField label="Shipping discount (%)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={config.shippingDiscountPct ?? 0}
                onChange={(e) =>
                  onChange({
                    shippingDiscountPct: parseFloat(e.target.value) || 0,
                  })
                }
                className="input-base w-28"
              />
              <span className="text-sm text-neutral-400">%</span>
            </div>
          </FormField>
        )}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 4 — Variant Discounts
// ---------------------------------------------------------------------------
function StepVariantDiscounts({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function updateVariant(index: number, patch: Partial<VariantConfig>) {
    onChange({
      variants: state.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v
      ),
    });
  }

  function updateConfig(index: number, patch: Partial<DiscountConfig>) {
    const v = state.variants[index];
    if (!v?.discountConfig) return;
    updateVariant(index, { discountConfig: { ...v.discountConfig, ...patch } });
  }

  function addVariant() {
    const nonControlCount = state.variants.filter((v) => !v.isControl).length;
    const even = parseFloat((100 / (state.variants.length + 1)).toFixed(1));
    const remainder = parseFloat(
      (100 - even * state.variants.length).toFixed(1)
    );
    onChange({
      variants: [
        ...state.variants.map((v, i) => ({
          ...v,
          allocationPercent: i === state.variants.length - 1 ? remainder : even,
        })),
        {
          ...emptyVariant(false, nonControlCount),
          allocationPercent: even,
          discountConfig: { ...DEFAULT_CONFIG[state.discountType] },
        },
      ],
    });
  }

  const allocationVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));

  return (
    <div className="space-y-6">
      <FormSection
        title="Traffic allocation"
        description="Set the split between control and variants."
        accent={ACCENT}
      >
        <VariantAllocationEditor
          variants={allocationVariants}
          accentHex={ACCENT}
          onChange={(updated) => {
            onChange({
              variants: state.variants.map((v, i) => ({
                ...v,
                allocationPercent: updated[i]?.allocationPercent ?? v.allocationPercent,
              })),
            });
          }}
        />
      </FormSection>

      <FormSection
        title="Discount values per variant"
        description="Configure the specific discount value each variant will test."
        accent={ACCENT}
      >
        <div className="space-y-4">
          {state.variants.map((v, vi) => (
            <div
              key={vi}
              className="rounded-xl border border-neutral-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  {v.isControl && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
                      Control
                    </span>
                  )}
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) =>
                      updateVariant(vi, { name: e.target.value })
                    }
                    className="text-sm font-semibold bg-transparent border-0 border-b border-transparent hover:border-neutral-300 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                {!v.isControl && state.variants.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        variants: state.variants.filter((_, i) => i !== vi),
                      })
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="px-4 py-4">
                {v.isControl ? (
                  <p className="text-xs text-neutral-400 italic">
                    No discount applied — visitors see default pricing.
                  </p>
                ) : v.discountConfig ? (
                  <VariantDiscountEditor
                    config={v.discountConfig}
                    onChange={(patch) => updateConfig(vi, patch)}
                  />
                ) : null}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-amber-300 hover:text-amber-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Stacking
// ---------------------------------------------------------------------------
const STACKING_OPTIONS: {
  value: StackingMode;
  label: string;
  desc: string;
}[] = [
  {
    value: "exclusive",
    label: "Exclusive",
    desc: "This discount cannot be combined with any other discount",
  },
  {
    value: "additive",
    label: "Additive",
    desc: "This discount stacks with other active discounts",
  },
  {
    value: "first_only",
    label: "Highest wins",
    desc: "Only the highest discount applies",
  },
];

function StepStacking({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const highValueVariant = state.variants.find(
    (v) =>
      !v.isControl &&
      v.discountConfig &&
      ((v.discountConfig.discountType === "PERCENTAGE" &&
        (v.discountConfig.percentage ?? 0) > 30) ||
        (v.discountConfig.discountType === "FIXED_AMOUNT" &&
          (v.discountConfig.amount ?? 0) > 50))
  );

  return (
    <div className="space-y-6">
      <FormSection
        title="Discount stacking behaviour"
        description="How should this discount interact with other active discounts in your store?"
        accent={ACCENT}
      >
        <div className="space-y-3">
          {STACKING_OPTIONS.map((opt) => {
            const selected = state.stackingMode === opt.value;
            return (
              <label
                key={opt.value}
                className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
                style={{
                  borderColor: selected ? ACCENT : "#e5e7eb",
                  background: selected ? "#fffbeb" : "#fff",
                }}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={selected}
                  onChange={() => onChange({ stackingMode: opt.value })}
                />
                <span
                  className="w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: selected ? ACCENT : "#d1d5db",
                    background: selected ? ACCENT : "white",
                  }}
                >
                  {selected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: selected ? ACCENT : "#111827" }}
                  >
                    {opt.label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </FormSection>

      <InlineAlert variant="info" title="About stacking">
        Shopify evaluates discount eligibility at checkout. "Exclusive" mode
        uses Shopify's discount combination rules to prevent stacking.
        "Additive" allows multiple codes to apply in the same checkout session.
      </InlineAlert>

      {state.stackingMode === "additive" && highValueVariant && (
        <InlineAlert variant="warning" title="High-value additive discount">
          One or more variants carry a high discount value. Combined with other
          active discounts, this could significantly reduce margins. Review your
          store's discount rules before activating.
        </InlineAlert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Review
// ---------------------------------------------------------------------------
function buildReadinessChecks(state: WizardState): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const totalAlloc = state.variants.reduce(
    (s, v) => s + (v.allocationPercent || 0),
    0
  );

  checks.push({
    id: "name",
    label: "Test has a name",
    status: state.name.trim() ? "pass" : "block",
    detail: state.name.trim() ? undefined : "A name is required to create the test.",
  });

  checks.push({
    id: "allocation",
    label: "Traffic allocation totals 100%",
    status: Math.abs(totalAlloc - 100) < 0.1 ? "pass" : "block",
    detail:
      Math.abs(totalAlloc - 100) < 0.1
        ? undefined
        : `Currently ${totalAlloc.toFixed(1)}%.`,
  });

  const nonControl = state.variants.filter((v) => !v.isControl);
  const discountValuesOk = nonControl.every((v) => {
    const cfg = v.discountConfig;
    if (!cfg) return false;
    if (
      cfg.discountType === "PERCENTAGE" ||
      cfg.discountType === "PRODUCT_DISCOUNT" ||
      cfg.discountType === "ORDER_DISCOUNT"
    )
      return (cfg.percentage ?? 0) > 0 && (cfg.percentage ?? 0) <= 100;
    if (cfg.discountType === "FIXED_AMOUNT") return (cfg.amount ?? 0) > 0;
    if (cfg.discountType === "VOLUME_DISCOUNT")
      return (cfg.tiers?.length ?? 0) > 0;
    if (cfg.discountType === "BUY_X_GET_Y")
      return (
        (cfg.buyQuantity ?? 0) >= 1 &&
        (cfg.getQuantity ?? 0) >= 1 &&
        (cfg.getDiscountPct ?? 0) > 0
      );
    if (cfg.discountType === "SHIPPING_DISCOUNT") return true;
    return false;
  });

  checks.push({
    id: "discount_values",
    label: "All variant discount values are valid",
    status: discountValuesOk ? "pass" : "block",
    detail: discountValuesOk
      ? undefined
      : "One or more variants have an invalid or missing discount value.",
  });

  checks.push({
    id: "stacking",
    label: "Stacking behaviour selected",
    status: state.stackingMode ? "pass" : "block",
    detail: state.stackingMode
      ? undefined
      : "Choose how this discount interacts with other discounts.",
  });

  const highPctVariant = nonControl.find(
    (v) =>
      (v.discountConfig?.discountType === "PERCENTAGE" ||
        v.discountConfig?.discountType === "PRODUCT_DISCOUNT" ||
        v.discountConfig?.discountType === "ORDER_DISCOUNT") &&
      (v.discountConfig?.percentage ?? 0) > 50
  );
  if (highPctVariant) {
    checks.push({
      id: "high_pct",
      label: "Discount percentage above 50%",
      status: "warn",
      detail: `"${highPctVariant.name}" has a discount > 50% — verify this is intentional.`,
    });
  }

  const isProductType =
    state.discountType === "PRODUCT_DISCOUNT" ||
    state.discountType === "VOLUME_DISCOUNT" ||
    state.discountType === "BUY_X_GET_Y";
  if (isProductType && state.targetingScope === "all") {
    checks.push({
      id: "product_targeting",
      label: "Product discount has no product targeting",
      status: "warn",
      detail: "Consider specifying target products or collections for precision.",
    });
  }

  if (state.hypothesis.trim()) {
    checks.push({
      id: "hypothesis",
      label: "Hypothesis documented",
      status: "pass",
    });
  }

  if (state.trafficAllocation < 100) {
    checks.push({
      id: "partial_traffic",
      label: `Partial traffic rollout (${state.trafficAllocation}%)`,
      status: "info",
      detail: "Remaining visitors will see default pricing.",
    });
  }

  return checks;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1 border-b border-neutral-50 last:border-0">
      <span className="w-40 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-neutral-900 flex-1">{value}</span>
    </div>
  );
}

function StepReview({ state }: { state: WizardState }) {
  const checks = buildReadinessChecks(state);
  const typeLabel =
    DISCOUNT_TYPE_OPTIONS.find((o) => o.value === state.discountType)?.title ??
    state.discountType;
  const stackLabel =
    STACKING_OPTIONS.find((o) => o.value === state.stackingMode)?.label ?? "—";

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />

      <FormSection title="Test summary" accent={ACCENT}>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <SummaryRow label="Name" value={state.name || "(not set)"} />
          <SummaryRow
            label="Traffic"
            value={`${state.trafficAllocation}% of visitors`}
          />
          <SummaryRow label="Discount type" value={typeLabel} />
          <SummaryRow label="Stacking" value={stackLabel} />
          <SummaryRow
            label="Min subtotal"
            value={
              state.minOrderSubtotal > 0
                ? `$${state.minOrderSubtotal}`
                : "None"
            }
          />
          <SummaryRow
            label="Targeting"
            value={
              state.targetingScope === "all"
                ? "All products"
                : state.targetingScope === "specific_products"
                ? `Products: ${state.targetProductIds || "(none)"}`
                : `Collections: ${state.targetCollectionIds || "(none)"}`
            }
          />
        </div>
      </FormSection>

      <FormSection title="Variants" accent={ACCENT}>
        <div className="space-y-2">
          {state.variants.map((v) => (
            <div
              key={v.key}
              className="flex items-start justify-between rounded-lg border border-neutral-100 bg-white px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-neutral-800">{v.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {v.isControl
                    ? "No discount"
                    : v.discountConfig
                    ? discountSummary(v.discountConfig)
                    : "—"}
                </p>
              </div>
              <span className="text-xs text-neutral-500 shrink-0 ml-3 mt-0.5">
                {v.allocationPercent}%
              </span>
            </div>
          ))}
        </div>
      </FormSection>

      <p className="text-xs text-neutral-400">
        Saved as DRAFT — activate from the test detail page when ready.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------
export function DiscountTestWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return state.name.trim().length > 0;
      case 1:
        return true;
      case 2:
        return true;
      case 3: {
        const total = state.variants.reduce(
          (s, v) => s + (v.allocationPercent || 0),
          0
        );
        if (Math.abs(total - 100) > 0.1) return false;
        return state.variants
          .filter((v) => !v.isControl)
          .every((v) => {
            const cfg = v.discountConfig;
            if (!cfg) return false;
            if (
              cfg.discountType === "PERCENTAGE" ||
              cfg.discountType === "PRODUCT_DISCOUNT" ||
              cfg.discountType === "ORDER_DISCOUNT"
            ) {
              const pct = cfg.percentage ?? 0;
              if (pct <= 0) return false;
              if (cfg.discountType === "PERCENTAGE" && pct > 100) return false;
              return true;
            }
            if (cfg.discountType === "FIXED_AMOUNT") return (cfg.amount ?? 0) > 0;
            if (cfg.discountType === "VOLUME_DISCOUNT") {
              if ((cfg.tiers?.length ?? 0) === 0) return false;
              const tiersOutOfOrder = (cfg.tiers ?? []).some(
                (t, i, arr) => i > 0 && t.minQty <= arr[i - 1]!.minQty
              );
              return !tiersOutOfOrder;
            }
            if (cfg.discountType === "BUY_X_GET_Y")
              return (cfg.buyQuantity ?? 0) >= 1 && (cfg.getQuantity ?? 0) >= 1;
            return true;
          });
      }
      case 4:
        return state.stackingMode !== "";
      case 5: {
        const checks = buildReadinessChecks(state);
        return checks.every((c) => c.status !== "block");
      }
      default:
        return true;
    }
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 3) {
      const total = state.variants.reduce(
        (s, v) => s + (v.allocationPercent || 0),
        0
      );
      if (Math.abs(total - 100) > 0.1) return "Allocation must total 100%";
    }
    if (step === 4 && !state.stackingMode) return "Select a stacking mode";
    if (step === 5 && !canAdvance()) return "Fix blocking issues above";
    return undefined;
  }

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => (s - 1) as StepIndex);
    }
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/discount-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          trafficAllocation: state.trafficAllocation,
          discountType: state.discountType,
          eligibility: {
            minOrderSubtotal: state.minOrderSubtotal || undefined,
            minQuantity: state.minQuantity || undefined,
            targetingScope: state.targetingScope,
            targetProductIds:
              state.targetingScope === "specific_products"
                ? state.targetProductIds
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            targetCollectionIds:
              state.targetingScope === "specific_collections"
                ? state.targetCollectionIds
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            usageLimitPerCustomer:
              state.usageLimitPerCustomer !== ""
                ? state.usageLimitPerCustomer
                : undefined,
          },
          stackingMode: state.stackingMode,
          variants: state.variants.map((v) => ({
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            discountConfig: v.isControl ? undefined : v.discountConfig,
          })),
        }),
      });

      if (!res.ok) {
        if (res.status === 402) { setShowUpgradeModal(true); setSaving(false); return; }
        const d = (await res.json()) as { error?: unknown };
        throw new Error(
          typeof d.error === "string" ? d.error : "Failed to create"
        );
      }

      showSuccess(`Discount test "${state.name}" created — activate it from the test detail page.`);
      router.push("/discount-tests");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create test. Check your connection and try again.");
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const handleNext = useCallback(() => {
    if (step < 5) {
      setStep((s) => (s + 1) as StepIndex);
    } else {
      void handleSubmit();
    }
  }, [step, handleSubmit]);

  const stepContent = [
    <StepSetup key="setup" state={state} onChange={patch} />,
    <StepDiscountType key="type" state={state} onChange={patch} />,
    <StepEligibility key="eligibility" state={state} onChange={patch} />,
    <StepVariantDiscounts key="variants" state={state} onChange={patch} />,
    <StepStacking key="stacking" state={state} onChange={patch} />,
    <StepReview key="review" state={state} />,
  ];

  const wizardSteps = STEP_LABELS.map((label, i) => ({
    label,
    status:
      i < step
        ? ("complete" as const)
        : i === step
        ? ("active" as const)
        : ("pending" as const),
  }));

  return (
    <>
    <UpgradePlanModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} limitType="running experiments" />
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: "#d977060a" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#d9770615" }}
          >
            <span className="text-base" style={{ color: AMBER }}>
              ⊖
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Discount Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test discount mechanics, values, and eligibility rules to find
            what drives the most revenue.
          </p>
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={wizardSteps}
            currentStep={step}
            accentHex={AMBER}
            onStepClick={(i) => {
              if (i < step) setStep(i as StepIndex);
            }}
          />
        </div>
        <div className="p-3 border-t border-neutral-50">
          <div className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-[9px] text-amber-700 font-medium">
              Shopify Function required for checkout enforcement.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: AMBER }}
          >
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">
            {STEP_TITLES[step]}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Step form */}
            <div className="flex-1 min-w-0 space-y-5">
              {stepContent[step]}

              {error && (
                <div className="mt-4">
                  <InlineAlert variant="danger" title="Error">
                    {error}
                  </InlineAlert>
                </div>
              )}
            </div>

            {/* Live preview panel */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <DiscountPreviewPanel
                step={step}
                discountType={state.discountType}
                eligibility={{
                  minOrderSubtotal: state.minOrderSubtotal,
                  minQuantity: state.minQuantity,
                  targetingScope: state.targetingScope,
                }}
                variantDiscounts={state.variants}
                stackingMode={state.stackingMode}
                setup={{
                  name: state.name,
                  trafficAllocation: state.trafficAllocation,
                }}
                variants={state.variants}
              />
            </aside>
          </div>
        </div>

        {/* Sticky footer actions */}
        <StickyFormActions
          step={step}
          totalSteps={STEP_LABELS.length}
          onBack={handleBack}
          onNext={handleNext}
          canContinue={canAdvance()}
          isLastStep={step === 5}
          isSubmitting={saving}
          submitLabel="Create Discount Test"
          continueLabel={CONTINUE_LABELS[step]}
          accentHex={AMBER}
          blockingIssue={blockingIssue()}
        />
      </div>
    </div>
    </>
  );
}
