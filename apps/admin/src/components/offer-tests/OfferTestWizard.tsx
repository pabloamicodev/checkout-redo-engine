"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { TrafficSlider } from "@/components/experiments/TrafficSlider";
import { WizardInput, WizardTextarea, WizardNumberInput, WizardRadioGroup, WizardCheckCardGroup } from "@/components/experiments/WizardControls";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMERALD = "#059669";
const EMERALD_GRADIENT = "linear-gradient(135deg, #059669 0%, #047857 100%)";

type OfferType =
  | "FREE_SHIPPING"
  | "FREE_GIFT"
  | "VOLUME_DISCOUNT"
  | "QUANTITY_BREAK"
  | "BUY_X_GET_Y"
  | "CART_MESSAGE"
  | "PRODUCT_PAGE_OFFER";

type PlacementKey =
  | "CART_DRAWER"
  | "CART_PAGE"
  | "PRODUCT_PAGE"
  | "ANNOUNCEMENT_BAR"
  | "CHECKOUT";

interface DiscountTier {
  minQty: number;
  value: number; // $ off or %
}

interface VariantOffer {
  // Free Shipping / Free Gift / Volume / Quantity / BuyXGetY
  thresholdAmount?: number;
  // Free Gift
  giftProductId?: string;
  // Volume / Quantity Break — tiers
  tiers?: DiscountTier[];
  // Cart Message / Product Page Offer
  messageText?: string;
}

interface VariantConfig extends AllocationVariant {
  offer: VariantOffer | null; // null for control
}

interface TriggerRules {
  minCartSubtotal: number;
  minItemQty: number;
  eligibleAllProducts: boolean;
  eligibleProductIds: string;
  claimBehavior: "automatic" | "click";
}

interface WizardState {
  // Step 1
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  // Step 2
  offerType: OfferType | null;
  // Step 3
  triggerRules: TriggerRules;
  // Step 4
  variants: VariantConfig[];
  // Step 5
  placements: PlacementKey[];
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

const STEP_TITLES = [
  "Define your offer experiment",
  "Choose an offer type",
  "Set trigger rules",
  "Configure variant offers",
  "Choose display placements",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a hypothesis about how the offer will affect AOV or conversion.",
  "Select what kind of offer you want to test across your variants.",
  "Define when and for whom the offer activates — cart value, item count, or product eligibility.",
  "Configure the specific offer details for each test variant.",
  "Choose where on your store the offer will be shown to enrolled visitors.",
  "Review the complete offer test configuration and fix any issues before launching.",
];

const STEP_LABELS = [
  "Setup",
  "Offer Type",
  "Trigger Rules",
  "Variant Offers",
  "Placement",
  "Review",
];

// ---------------------------------------------------------------------------
// Offer type catalogue — enhanced with metric hints
// ---------------------------------------------------------------------------

const OFFER_TYPES: {
  type: OfferType;
  emoji: string;
  label: string;
  description: string;
  metricHint: string;
}[] = [
  {
    type: "FREE_SHIPPING",
    emoji: "🚚",
    label: "Free Shipping Threshold",
    description: "Free shipping above a cart value",
    metricHint: "Avg. +18% AOV when threshold is right-sized",
  },
  {
    type: "FREE_GIFT",
    emoji: "🎁",
    label: "Free Gift",
    description: "Free product gift above a threshold",
    metricHint: "Drives premium AOV and perceived value",
  },
  {
    type: "VOLUME_DISCOUNT",
    emoji: "📦",
    label: "Volume Discount",
    description: "Tiered discounts for quantity",
    metricHint: "Increases multi-unit purchases",
  },
  {
    type: "QUANTITY_BREAK",
    emoji: "🔢",
    label: "Quantity Break",
    description: "Price breaks per quantity",
    metricHint: "Rewards bulk buying behavior",
  },
  {
    type: "BUY_X_GET_Y",
    emoji: "🤝",
    label: "Buy X Get Y",
    description: "Buy X, get Y free",
    metricHint: "Classic BXGY for bundles and inventory",
  },
  {
    type: "CART_MESSAGE",
    emoji: "💬",
    label: "Cart Message",
    description: "Promotional message in the cart",
    metricHint: "Low-friction urgency and incentive nudge",
  },
  {
    type: "PRODUCT_PAGE_OFFER",
    emoji: "🏷",
    label: "Product Page Offer",
    description: "Offer shown on product pages",
    metricHint: "Product-level incentive with direct CTA",
  },
];

// ---------------------------------------------------------------------------
// Placement catalogue
// ---------------------------------------------------------------------------

const PLACEMENT_OPTIONS: { key: PlacementKey; label: string; description: string }[] = [
  { key: "CART_DRAWER",      label: "Cart drawer",      description: "Show in cart sidebar" },
  { key: "CART_PAGE",        label: "Cart page",        description: "Show on /cart" },
  { key: "PRODUCT_PAGE",     label: "Product page",     description: "Show on PDPs" },
  { key: "ANNOUNCEMENT_BAR", label: "Announcement bar", description: "Show in header bar" },
  { key: "CHECKOUT",         label: "Checkout",         description: "Show in checkout (requires checkout extension)" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyVariant(isControl: boolean, idx: number): VariantConfig {
  return {
    key:               isControl ? "control" : `variant_${String.fromCharCode(97 + idx - 1)}`,
    name:              isControl ? "Control" : `Variant ${String.fromCharCode(65 + idx - 1)}`,
    isControl,
    allocationPercent: 50,
    offer:             isControl ? null : { thresholdAmount: 0 },
  };
}

function defaultTier(): DiscountTier {
  return { minQty: 1, value: 0 };
}

// Returns true if the offer type uses a progress-bar widget
function hasProgressBar(offerType: OfferType | null): boolean {
  return offerType === "FREE_SHIPPING" || offerType === "VOLUME_DISCOUNT";
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_TRIGGER_RULES: TriggerRules = {
  minCartSubtotal:    0,
  minItemQty:         0,
  eligibleAllProducts: true,
  eligibleProductIds: "",
  claimBehavior:      "automatic",
};

const DEFAULT_STATE: WizardState = {
  name:              "",
  hypothesis:        "",
  trafficAllocation: 100,
  offerType:         null,
  triggerRules:      { ...DEFAULT_TRIGGER_RULES },
  variants:          [emptyVariant(true, 0), emptyVariant(false, 1)],
  placements:        ["CART_DRAWER", "CART_PAGE"],
};

// ---------------------------------------------------------------------------
// Shared tiny primitives
// ---------------------------------------------------------------------------

function InputBase(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 bg-white " +
        "focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 " +
        "placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400 " +
        (props.className ?? "")
      }
    />
  );
}

function TextareaBase(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 bg-white resize-none " +
        "focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 " +
        "placeholder:text-neutral-400 " +
        (props.className ?? "")
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Live Offer Preview Panel
// ---------------------------------------------------------------------------

function PlacementPills({ placements }: { placements: PlacementKey[] }) {
  if (placements.length === 0) {
    return (
      <p className="text-[10px] text-neutral-400 italic">No placements selected</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {placements.map((p) => {
        const label = PLACEMENT_OPTIONS.find((o) => o.key === p)?.label ?? p;
        return (
          <span
            key={p}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: "#05966915", color: EMERALD }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function CartDrawerPreviewFreeShipping({
  threshold,
  name,
}: {
  threshold: number;
  name: string;
}) {
  const cartTotal = 54.97;
  const remaining = Math.max(0, threshold - cartTotal);
  const pct = threshold > 0 ? Math.min(100, Math.round((cartTotal / threshold) * 100)) : 100;
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden text-xs select-none">
      <div className="bg-white border-b border-neutral-100 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Cart</span>
        <span className="text-[10px] text-neutral-400">2 items</span>
      </div>
      <div className="px-3 py-2 space-y-1.5 border-b border-neutral-100 bg-white">
        <div className="flex justify-between text-[11px] text-neutral-700">
          <span>Blue Linen Shirt <span className="text-neutral-400">× 1</span></span>
          <span>$34.99</span>
        </div>
        <div className="flex justify-between text-[11px] text-neutral-700">
          <span>Canvas Tote Bag <span className="text-neutral-400">× 2</span></span>
          <span>$19.98</span>
        </div>
      </div>
      <div className="px-3 py-2.5 border border-neutral-200 mx-2 my-2 rounded-lg bg-white space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🚚</span>
          <span className="text-[11px] font-medium text-neutral-800">
            {remaining > 0
              ? `You're $${remaining.toFixed(2)} away from FREE SHIPPING`
              : "You've unlocked FREE SHIPPING!"}
          </span>
        </div>
        <div className="space-y-0.5">
          <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: EMERALD_GRADIENT }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-neutral-400">
            <span>${cartTotal.toFixed(2)} / ${threshold > 0 ? threshold.toFixed(2) : "75.00"}</span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-white border-t border-neutral-100">
        <div className="flex justify-between text-[11px] text-neutral-700 mb-2">
          <span className="font-medium">Subtotal</span>
          <span className="font-semibold">${cartTotal.toFixed(2)}</span>
        </div>
        <div
          className="w-full py-1.5 rounded-lg text-center text-[10px] font-semibold text-white"
          style={{ background: EMERALD_GRADIENT }}
        >
          Proceed to Checkout
        </div>
      </div>
    </div>
  );
}

function CartDrawerPreviewFreeGift({
  threshold,
  giftProductId,
  claimBehavior,
}: {
  threshold: number;
  giftProductId?: string;
  claimBehavior: "automatic" | "click";
}) {
  const cartTotal = 72.5;
  const unlocked = threshold > 0 ? cartTotal >= threshold : false;
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden text-xs select-none">
      <div className="bg-white border-b border-neutral-100 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Cart</span>
        <span className="text-[10px] text-neutral-400">3 items</span>
      </div>
      <div
        className="mx-2 my-2 rounded-lg border px-3 py-2.5 space-y-1.5"
        style={{
          borderColor: unlocked ? EMERALD : "#d1fae5",
          background: unlocked ? "#ecfdf5" : "#f0fdf4",
        }}
      >
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5">🎁</span>
          <div className="flex-1">
            <p className="text-[11px] font-semibold" style={{ color: "#065f46" }}>
              {unlocked ? "Free gift unlocked!" : `Spend $${threshold > 0 ? threshold.toFixed(2) : "80.00"} to unlock a free gift`}
            </p>
            {giftProductId ? (
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono truncate">
                {giftProductId}
              </p>
            ) : (
              <p className="text-[10px] text-neutral-400 mt-0.5 italic">Gift product not configured</p>
            )}
            {claimBehavior === "click" && (
              <div
                className="mt-2 inline-flex px-3 py-1 rounded-md text-[10px] font-semibold text-white cursor-pointer"
                style={{ background: EMERALD }}
              >
                {unlocked ? "Claim your gift" : `Add $${Math.max(0, (threshold || 80) - cartTotal).toFixed(2)} more`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TierTablePreview({ tiers, offerType }: { tiers: DiscountTier[]; offerType: OfferType }) {
  const isVol = offerType === "VOLUME_DISCOUNT";
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden text-xs select-none">
      <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2 flex items-center gap-1.5">
        <span className="text-sm">{isVol ? "📦" : "🔢"}</span>
        <span className="text-[10px] font-semibold text-neutral-700 uppercase tracking-wider">
          {isVol ? "Volume Discount" : "Quantity Break"}
        </span>
      </div>
      <table className="w-full">
        <thead className="bg-neutral-50 border-b border-neutral-100">
          <tr>
            <th className="text-left px-3 py-1.5 text-[10px] font-medium text-neutral-500">Min qty</th>
            <th className="text-left px-3 py-1.5 text-[10px] font-medium text-neutral-500">
              {isVol ? "Discount" : "Price break"}
            </th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-neutral-500">Status</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-neutral-50">
          {(tiers.length > 0 ? tiers : [{ minQty: 2, value: 10 }, { minQty: 5, value: 20 }]).map(
            (tier, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-[11px] text-neutral-700 font-medium">{tier.minQty}+</td>
                <td className="px-3 py-1.5 text-[11px] text-neutral-700">${tier.value} off</td>
                <td className="px-3 py-1.5 text-right">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                    style={{ background: i === 0 ? "#fef9c3" : "#ecfdf5", color: i === 0 ? "#854d0e" : "#065f46" }}
                  >
                    {i === 0 ? "Active" : "Upcoming"}
                  </span>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function CartMessagePreview({ message, offerType }: { message?: string; offerType: OfferType }) {
  const isProduct = offerType === "PRODUCT_PAGE_OFFER";
  const displayMsg = message?.trim() || (isProduct ? "Buy 2, get the 3rd free — today only!" : "🎁 Add $20 more for a free gift!");
  if (isProduct) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden text-xs select-none">
        <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2">
          <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Product page</span>
        </div>
        <div className="px-3 py-3 space-y-2">
          <div className="h-24 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-300 text-xs">
            Product image
          </div>
          <p className="text-[11px] font-semibold text-neutral-800">Premium Linen Shirt</p>
          <p className="text-[11px] text-neutral-500">$89.00</p>
          <div
            className="w-full py-1.5 rounded-lg text-center text-[10px] font-semibold text-white"
            style={{ background: "#1a1a1a" }}
          >
            Add to cart
          </div>
          <div
            className="w-full px-3 py-2 rounded-lg border text-[10px] text-neutral-800 flex items-start gap-1.5"
            style={{ borderColor: "#d1fae5", background: "#f0fdf4" }}
          >
            <span className="text-sm leading-none mt-0.5">🏷</span>
            <span>{displayMsg}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden text-xs select-none">
      <div className="bg-white border-b border-neutral-100 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Cart</span>
        <span className="text-[10px] text-neutral-400">2 items</span>
      </div>
      <div className="px-3 py-2 bg-white space-y-1.5 border-b border-neutral-100">
        <div className="flex justify-between text-[11px] text-neutral-700">
          <span>Canvas Sneakers <span className="text-neutral-400">× 1</span></span>
          <span>$64.99</span>
        </div>
      </div>
      <div
        className="mx-2 my-2 px-3 py-2.5 rounded-lg border flex items-start gap-2"
        style={{ borderColor: "#d1fae5", background: "#f0fdf4" }}
      >
        <span className="text-base leading-none mt-0.5">💬</span>
        <p className="text-[11px] text-neutral-800">{displayMsg}</p>
      </div>
      <div className="px-3 py-2 bg-white border-t border-neutral-100">
        <div
          className="w-full py-1.5 rounded-lg text-center text-[10px] font-semibold text-white"
          style={{ background: EMERALD_GRADIENT }}
        >
          Proceed to Checkout
        </div>
      </div>
    </div>
  );
}

function BuyXGetYPreview({ threshold }: { threshold?: number }) {
  const cartTotal = 45.0;
  const needed = Math.max(0, (threshold || 50) - cartTotal);
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden text-xs select-none">
      <div className="bg-white border-b border-neutral-100 px-3 py-2 flex items-center gap-1.5">
        <span className="text-sm">🤝</span>
        <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Buy X Get Y</span>
      </div>
      <div className="px-3 py-2.5 bg-white space-y-2">
        <div className="flex justify-between text-[11px] text-neutral-700">
          <span>Ceramic Mug <span className="text-neutral-400">× 1</span></span>
          <span>$45.00</span>
        </div>
        <div
          className="p-2.5 rounded-lg border text-[10px] space-y-1"
          style={{ borderColor: "#d1fae5", background: "#f0fdf4" }}
        >
          <p className="font-semibold" style={{ color: "#065f46" }}>
            {needed > 0
              ? `Add $${needed.toFixed(2)} more to unlock your free item`
              : "Free item unlocked!"}
          </p>
          <p className="text-neutral-500">
            Spend ${(threshold || 50).toFixed(2)} — get a free item automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function TriggerRulesSummary({ triggerRules }: { triggerRules: TriggerRules }) {
  const rules: string[] = [];
  if (triggerRules.minCartSubtotal > 0)
    rules.push(`Min cart $${triggerRules.minCartSubtotal.toFixed(2)}`);
  if (triggerRules.minItemQty > 0)
    rules.push(`Min ${triggerRules.minItemQty} item${triggerRules.minItemQty !== 1 ? "s" : ""}`);
  if (!triggerRules.eligibleAllProducts)
    rules.push("Specific products");
  rules.push(triggerRules.claimBehavior === "automatic" ? "Auto-apply" : "Click to claim");
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
        Trigger rules
      </p>
      <div className="flex flex-wrap gap-1">
        {rules.map((r) => (
          <span
            key={r}
            className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-600"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

function OfferPreviewPanel({
  step,
  offerType,
  triggerRules,
  variantOffers,
  placements,
  state,
}: {
  step: number;
  offerType: OfferType | null;
  triggerRules: TriggerRules;
  variantOffers: VariantConfig[];
  placements: PlacementKey[];
  state: WizardState;
}) {
  // Get the first non-control variant offer for preview
  const firstVariant = variantOffers.find((v) => !v.isControl);
  const offer = firstVariant?.offer ?? null;

  function renderOfferWidget() {
    if (!offerType) {
      return (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
          <span className="text-3xl block mb-2 opacity-30">◈</span>
          <p className="text-[11px] text-neutral-400">
            Select an offer type to see a live preview
          </p>
        </div>
      );
    }

    if (offerType === "FREE_SHIPPING" || offerType === "VOLUME_DISCOUNT") {
      if (offerType === "FREE_SHIPPING") {
        return (
          <CartDrawerPreviewFreeShipping
            threshold={offer?.thresholdAmount ?? 75}
            name={state.name}
          />
        );
      }
      return (
        <TierTablePreview
          tiers={offer?.tiers ?? []}
          offerType={offerType}
        />
      );
    }

    if (offerType === "FREE_GIFT") {
      return (
        <CartDrawerPreviewFreeGift
          threshold={offer?.thresholdAmount ?? 80}
          giftProductId={offer?.giftProductId}
          claimBehavior={triggerRules.claimBehavior}
        />
      );
    }

    if (offerType === "QUANTITY_BREAK") {
      return (
        <TierTablePreview
          tiers={offer?.tiers ?? []}
          offerType={offerType}
        />
      );
    }

    if (offerType === "BUY_X_GET_Y") {
      return <BuyXGetYPreview threshold={offer?.thresholdAmount} />;
    }

    if (offerType === "CART_MESSAGE" || offerType === "PRODUCT_PAGE_OFFER") {
      return (
        <CartMessagePreview
          message={offer?.messageText}
          offerType={offerType}
        />
      );
    }

    return null;
  }

  const offerLabel = OFFER_TYPES.find((o) => o.type === offerType)?.label;
  const variantCount = variantOffers.filter((v) => !v.isControl).length;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      {/* Panel header */}
      <div
        className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2"
        style={{ background: "#0596690a" }}
      >
        <span className="text-xs" style={{ color: EMERALD }}>◈</span>
        <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
          Live Preview
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Offer widget preview */}
        {renderOfferWidget()}

        {/* Trigger rules summary */}
        <TriggerRulesSummary triggerRules={triggerRules} />

        {/* Placement pills */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
            Placements
          </p>
          <PlacementPills placements={placements} />
        </div>

        {/* Config summary */}
        <div className="pt-1 border-t border-neutral-100 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400">Offer type</span>
            <span className="text-[10px] font-medium text-neutral-700">
              {offerLabel ?? "Not selected"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400">Variants</span>
            <span className="text-[10px] font-medium text-neutral-700">
              {variantCount} treatment{variantCount !== 1 ? "s" : ""} + control
            </span>
          </div>
          {state.name.trim() && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-neutral-400">Test name</span>
              <span className="text-[10px] font-medium text-neutral-700 truncate max-w-[120px]">
                {state.name}
              </span>
            </div>
          )}
        </div>
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
        title="Experiment basics"
        description="Give this test a name and an optional hypothesis."
        accent={EMERALD}
      >
        <div className="space-y-4">
          <WizardInput
            label="Test name"
            required
            value={state.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="Free Gift vs Bundle Offer Test"
            maxLength={80}
            accentColor={EMERALD}
            hint="Use a name that describes the offer types you're comparing."
          />

          <WizardTextarea
            label="Hypothesis"
            value={state.hypothesis}
            onChange={(v) => onChange({ hypothesis: v })}
            placeholder="e.g. A free gift threshold offer will increase AOV more than a percentage discount"
            rows={3}
            maxLength={400}
            accentColor={EMERALD}
            hint="Describe what you expect to happen and why."
            templateText="If we show a [free shipping / free gift / volume discount] offer when cart reaches $[X], then average order value will increase because customers add more items to qualify."
          />
        </div>
      </FormSection>

      <TrafficSlider
        value={state.trafficAllocation}
        onChange={(v) => onChange({ trafficAllocation: v })}
        accentColor={EMERALD}
        holdoutLabel="See default offers"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Offer Type (enhanced gallery)
// ---------------------------------------------------------------------------

function StepOfferType({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <FormSection
        title="Choose offer type"
        description="Select the kind of offer you want to test. This determines the available configuration in the next steps."
        accent={EMERALD}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {OFFER_TYPES.map(({ type, emoji, label, description, metricHint }) => {
            const selected = state.offerType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ offerType: type })}
                className={
                  "relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all " +
                  (selected
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300/40 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm")
                }
              >
                {/* Selected checkmark */}
                {selected && (
                  <span
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
                    style={{ background: EMERALD }}
                  >
                    ✓
                  </span>
                )}

                {/* Icon */}
                <span className="text-3xl leading-none select-none" aria-hidden>
                  {emoji}
                </span>

                {/* Labels */}
                <div className="min-w-0 pr-4">
                  <p
                    className={
                      "text-sm font-bold leading-tight " +
                      (selected ? "text-emerald-800" : "text-neutral-800")
                    }
                  >
                    {label}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                    {description}
                  </p>
                </div>

                {/* Metric hint */}
                <div
                  className="mt-auto flex items-center gap-1.5 pt-2 border-t"
                  style={{ borderColor: selected ? "#a7f3d0" : "#f5f5f5" }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: EMERALD }}
                  />
                  <p
                    className="text-[10px] font-medium leading-tight"
                    style={{ color: selected ? "#065f46" : "#6b7280" }}
                  >
                    {metricHint}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Trigger Rules
// ---------------------------------------------------------------------------

function StepTriggerRules({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function patchRules(patch: Partial<TriggerRules>) {
    onChange({ triggerRules: { ...state.triggerRules, ...patch } });
  }

  const r = state.triggerRules;

  return (
    <div className="space-y-6">
      <FormSection
        title="Cart requirements"
        description="Define the minimum conditions for the offer to appear."
        accent={EMERALD}
      >
        <div className="grid grid-cols-2 gap-4">
          <WizardNumberInput
            label="Minimum cart subtotal"
            prefix="$"
            value={r.minCartSubtotal}
            onChange={(v) => patchRules({ minCartSubtotal: v })}
            min={0}
            step={0.01}
            hint="0 = no minimum"
            accentColor={EMERALD}
          />
          <WizardNumberInput
            label="Minimum item quantity"
            value={r.minItemQty}
            onChange={(v) => patchRules({ minItemQty: v })}
            min={0}
            step={1}
            hint="0 = no minimum"
            accentColor={EMERALD}
          />
        </div>
      </FormSection>

      <FormSection
        title="Eligible products"
        description="Which products qualify for this offer."
        accent={EMERALD}
      >
        <div className="space-y-3">
          <WizardRadioGroup
            options={[
              { value: "true",  label: "All products",      description: "The offer applies to any product in the cart." },
              { value: "false", label: "Specific products", description: "Only items matching the product IDs below qualify." },
            ]}
            value={String(r.eligibleAllProducts)}
            onChange={(v) => patchRules({ eligibleAllProducts: v === "true" })}
            accentColor={EMERALD}
            columns={2}
          />

          {!r.eligibleAllProducts && (
            <WizardTextarea
              label="Product IDs"
              value={r.eligibleProductIds}
              onChange={(v) => patchRules({ eligibleProductIds: v })}
              placeholder="gid://shopify/Product/123456, gid://shopify/Product/789012"
              hint="Paste Shopify product GIDs or numeric IDs, comma-separated."
              rows={2}
              mono
              accentColor={EMERALD}
            />
          )}
        </div>
      </FormSection>

      <FormSection
        title="Claim behavior"
        description="How customers receive the offer."
        accent={EMERALD}
      >
        <WizardRadioGroup
          options={[
            { value: "automatic", label: "Applies automatically",      description: "The offer is applied without any customer action." },
            { value: "click",     label: "Customer clicks to claim",   description: "A CTA button is shown; the offer applies on click." },
          ]}
          value={r.claimBehavior}
          onChange={(v) => patchRules({ claimBehavior: v as TriggerRules["claimBehavior"] })}
          accentColor={EMERALD}
        />
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Variant Offers (per-variant offer editor)
// ---------------------------------------------------------------------------

function TierTable({
  tiers,
  onChange,
}: {
  tiers: DiscountTier[];
  onChange: (t: DiscountTier[]) => void;
}) {
  const hasGap = tiers.some((t, i) => i > 0 && t.minQty <= (tiers[i - 1]?.minQty ?? 0));

  function updateTier(i: number, patch: Partial<DiscountTier>) {
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  return (
    <div className="space-y-2">
      {hasGap && (
        <>
          <p className="text-xs text-red-500 mt-1">Tier thresholds must be in ascending order</p>
          <InlineAlert variant="warning">
            Tier quantities must be strictly ascending. Check your values.
          </InlineAlert>
        </>
      )}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Min qty</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Price / discount</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={tier.minQty}
                    onChange={(e) =>
                      updateTier(i, { minQty: parseInt(e.target.value) || 1 })
                    }
                    className="w-20 text-xs px-2 py-1 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tier.value}
                    onChange={(e) =>
                      updateTier(i, { value: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 text-xs px-2 py-1 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onChange(tiers.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange([...tiers, defaultTier()])}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> Add tier
      </button>
    </div>
  );
}

function VariantOfferEditor({
  offerType,
  offer,
  onChange,
}: {
  offerType: OfferType;
  offer: VariantOffer;
  onChange: (o: VariantOffer) => void;
}) {
  function patch(p: Partial<VariantOffer>) {
    onChange({ ...offer, ...p });
  }

  if (offerType === "FREE_SHIPPING") {
    return (
      <FormField label="Free shipping threshold ($)" required>
        <InputBase
          type="number"
          min={0}
          step={0.01}
          value={offer.thresholdAmount ?? 0}
          onChange={(e) => patch({ thresholdAmount: parseFloat(e.target.value) || 0 })}
          placeholder="75"
          className="!w-36"
        />
      </FormField>
    );
  }

  if (offerType === "FREE_GIFT") {
    return (
      <div className="space-y-3">
        <FormField label="Cart subtotal threshold to unlock gift ($)" required>
          <InputBase
            type="number"
            min={0}
            step={0.01}
            value={offer.thresholdAmount ?? 0}
            onChange={(e) => patch({ thresholdAmount: parseFloat(e.target.value) || 0 })}
            placeholder="80"
            className="!w-36"
          />
        </FormField>
        <FormField label="Gift product ID" required>
          <InputBase
            type="text"
            value={offer.giftProductId ?? ""}
            onChange={(e) => patch({ giftProductId: e.target.value })}
            placeholder="gid://shopify/Product/123456"
          />
          {!offer.giftProductId?.trim() && (
            <p className="text-xs text-red-500 mt-1">Product ID is required for Free Gift offers</p>
          )}
        </FormField>
        {!offer.giftProductId?.trim() && (
          <InlineAlert variant="danger">
            Free gift product is required — enter a Shopify product GID or numeric ID.
          </InlineAlert>
        )}
      </div>
    );
  }

  if (offerType === "VOLUME_DISCOUNT" || offerType === "QUANTITY_BREAK") {
    return (
      <FormField label="Discount tiers">
        <TierTable
          tiers={offer.tiers ?? [defaultTier()]}
          onChange={(tiers) => patch({ tiers })}
        />
      </FormField>
    );
  }

  if (offerType === "BUY_X_GET_Y") {
    return (
      <FormField label="Buy X threshold (cart subtotal $)" required>
        <InputBase
          type="number"
          min={0}
          step={0.01}
          value={offer.thresholdAmount ?? 0}
          onChange={(e) => patch({ thresholdAmount: parseFloat(e.target.value) || 0 })}
          placeholder="50"
          className="!w-36"
        />
      </FormField>
    );
  }

  if (offerType === "CART_MESSAGE" || offerType === "PRODUCT_PAGE_OFFER") {
    const maxLen = 200;
    const text = offer.messageText ?? "";
    return (
      <FormField
        label="Offer message"
        hint={`${text.length}/${maxLen} characters`}
        required
      >
        <TextareaBase
          rows={3}
          maxLength={maxLen}
          value={text}
          onChange={(e) => patch({ messageText: e.target.value })}
          placeholder={
            offerType === "CART_MESSAGE"
              ? "🎁 Add $20 more for a free gift!"
              : "Buy 2, get the 3rd free — today only!"
          }
        />
      </FormField>
    );
  }

  return null;
}

function StepVariantOffers({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const offerType = state.offerType!;

  function updateVariant(i: number, patch: Partial<VariantConfig>) {
    onChange({
      variants: state.variants.map((v, idx) =>
        idx === i ? { ...v, ...patch } : v
      ),
    });
  }

  function addVariant() {
    const variantCount = state.variants.filter((v) => !v.isControl).length;
    const even = parseFloat((100 / (state.variants.length + 1)).toFixed(1));
    const remainder = parseFloat(
      (100 - even * state.variants.length).toFixed(1)
    );
    const newVariants: VariantConfig[] = [
      ...state.variants.map((v, i) => ({
        ...v,
        allocationPercent: i === state.variants.length - 1 ? remainder : even,
      })),
      {
        ...emptyVariant(false, variantCount + 1),
        offer: { thresholdAmount: 0 },
      },
    ];
    onChange({ variants: newVariants });
  }

  const allocVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));

  return (
    <div className="space-y-6">
      <FormSection
        title="Traffic allocation"
        description="Split traffic between control and variants."
        accent={EMERALD}
      >
        <VariantAllocationEditor
          variants={allocVariants}
          onChange={(updated) =>
            onChange({
              variants: state.variants.map((v, i) => ({
                ...v,
                allocationPercent: updated[i]?.allocationPercent ?? v.allocationPercent,
              })),
            })
          }
          accentHex={EMERALD}
        />
      </FormSection>

      <FormSection
        title="Variant offers"
        description="Configure the offer shown in each non-control variant."
        accent={EMERALD}
      >
        <div className="space-y-4">
          {state.variants.map((v, vi) => (
            <div
              key={v.key}
              className="rounded-xl border border-neutral-200 overflow-hidden"
            >
              {/* Variant header */}
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  {v.isControl && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">
                      Control
                    </span>
                  )}
                  <input
                    value={v.name}
                    onChange={(e) => updateVariant(vi, { name: e.target.value })}
                    className="text-sm font-semibold bg-transparent border-0 border-b border-transparent hover:border-neutral-300 focus:border-emerald-500 focus:outline-none"
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

              {/* Variant body */}
              <div className="px-4 py-4">
                {v.isControl ? (
                  <p className="text-xs text-neutral-500 italic">
                    No offer — visitors see the default behavior.
                  </p>
                ) : v.offer ? (
                  <VariantOfferEditor
                    offerType={offerType}
                    offer={v.offer}
                    onChange={(updated) => updateVariant(vi, { offer: updated })}
                  />
                ) : null}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Placement
// ---------------------------------------------------------------------------

function ProgressBarPreview() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 font-mono text-xs space-y-1 select-none">
      <div className="text-neutral-500 text-[10px] mb-2 uppercase tracking-wider">
        Widget preview
      </div>
      <div className="border border-neutral-300 rounded-lg px-4 py-3 space-y-2 bg-neutral-50 text-neutral-800">
        <div className="flex items-center gap-2">
          <span>🚚</span>
          <span>Add $25 more for free shipping!</span>
        </div>
        <div className="space-y-0.5">
          <div className="h-2 rounded-full overflow-hidden bg-neutral-200">
            <div
              className="h-full rounded-full"
              style={{
                width: "66%",
                background: EMERALD_GRADIENT,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-400">
            <span>$50 / $75</span>
            <span>66%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPlacement({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function togglePlacement(key: PlacementKey) {
    const next = state.placements.includes(key)
      ? state.placements.filter((p) => p !== key)
      : [...state.placements, key];
    onChange({ placements: next });
  }

  const noPlacement = state.placements.length === 0;
  const cartOnly =
    state.placements.length > 0 &&
    state.placements.every((p) => p === "CART_DRAWER" || p === "CART_PAGE");

  return (
    <div className="space-y-6">
      <FormSection
        title="Where to show the offer"
        description="Select every surface where the offer widget should appear. At least one placement is required."
        accent={EMERALD}
      >
        <div className="space-y-2">
          {PLACEMENT_OPTIONS.map(({ key, label, description }) => {
            const checked = state.placements.includes(key);
            return (
              <label
                key={key}
                className={
                  "flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors " +
                  (checked
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePlacement(key)}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <p
                    className={
                      "text-sm font-medium " +
                      (checked ? "text-emerald-800" : "text-neutral-800")
                    }
                  >
                    {label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {noPlacement && (
          <>
            <p className="text-xs text-red-500 mt-1">Select at least one placement to continue</p>
            <InlineAlert variant="danger" className="mt-3">
              At least one placement must be selected.
            </InlineAlert>
          </>
        )}

        {!noPlacement && cartOnly && (
          <InlineAlert variant="warning" className="mt-3">
            Cart-only placement has lower visibility — consider adding an Announcement bar
            or Product page placement to increase offer exposure.
          </InlineAlert>
        )}
      </FormSection>

      {hasProgressBar(state.offerType) && (
        <FormSection
          title="Progress bar preview"
          description="This offer type supports a progress bar widget on eligible surfaces."
          accent={EMERALD}
        >
          <ProgressBarPreview />
        </FormSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Review
// ---------------------------------------------------------------------------

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-36 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function buildReadinessChecks(state: WizardState): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  // BLOCK: name
  checks.push({
    id: "name",
    label: "Test has a name",
    status: state.name.trim() ? "pass" : "block",
    detail: state.name.trim() ? undefined : "Enter a name on the Setup step.",
  });

  // BLOCK: offer type selected
  checks.push({
    id: "offer-type",
    label: "Offer type selected",
    status: state.offerType ? "pass" : "block",
    detail: state.offerType ? undefined : "Choose an offer type on step 2.",
  });

  // BLOCK: allocation sums to 100
  const totalAlloc = state.variants.reduce(
    (s, v) => s + (v.allocationPercent || 0),
    0
  );
  const allocOk = Math.abs(totalAlloc - 100) < 0.1;
  checks.push({
    id: "allocation",
    label: "Variant allocation totals 100%",
    status: allocOk ? "pass" : "block",
    detail: allocOk
      ? undefined
      : `Currently at ${totalAlloc.toFixed(1)}%. Adjust on the Variant Offers step.`,
  });

  // BLOCK: placement
  checks.push({
    id: "placement",
    label: "At least one placement selected",
    status: state.placements.length > 0 ? "pass" : "block",
    detail:
      state.placements.length > 0
        ? undefined
        : "Select a placement on step 5.",
  });

  // BLOCK: free gift product ID
  if (state.offerType === "FREE_GIFT") {
    const missingGift = state.variants.some(
      (v) => !v.isControl && !v.offer?.giftProductId?.trim()
    );
    checks.push({
      id: "free-gift-product",
      label: "All free-gift variants have a product ID",
      status: missingGift ? "block" : "pass",
      detail: missingGift
        ? "Enter a gift product ID for every non-control variant."
        : undefined,
    });
  }

  // WARN: cart-only placement
  const cartOnly =
    state.placements.length > 0 &&
    state.placements.every((p) => p === "CART_DRAWER" || p === "CART_PAGE");
  if (cartOnly) {
    checks.push({
      id: "cart-only",
      label: "Placement has low visibility",
      status: "warn",
      detail:
        "Only cart surfaces are selected. Adding the Announcement bar or Product page will expose the offer earlier in the funnel.",
    });
  }

  // PASS: hypothesis set
  checks.push({
    id: "hypothesis",
    label: "Hypothesis recorded",
    status: state.hypothesis.trim() ? "pass" : "info",
    detail: state.hypothesis.trim()
      ? undefined
      : "Optional, but encouraged for experiment documentation.",
  });

  return checks;
}

function StepReview({
  state,
  onSubmit,
  saving,
  error,
}: {
  state: WizardState;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
}) {
  const checks = buildReadinessChecks(state);
  const canLaunch = checks.every((c) => c.status !== "block");
  const offerLabel =
    OFFER_TYPES.find((o) => o.type === state.offerType)?.label ?? "—";
  const placementLabels = state.placements
    .map((p) => PLACEMENT_OPTIONS.find((o) => o.key === p)?.label ?? p)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* Summary */}
      <FormSection
        title="Test summary"
        description="Review the configuration before creating."
        accent={EMERALD}
      >
        <div className="rounded-xl border border-neutral-100 divide-y divide-neutral-100">
          <div className="px-4 py-2 space-y-0">
            <ReviewRow label="Name" value={state.name || "(not set)"} />
            <ReviewRow
              label="Traffic"
              value={`${state.trafficAllocation}% of visitors`}
            />
            <ReviewRow label="Offer type" value={offerLabel} />
            <ReviewRow
              label="Placements"
              value={placementLabels || "(none)"}
            />
            <ReviewRow
              label="Variants"
              value={`${state.variants.length} (${state.variants.filter((v) => !v.isControl).length} treatment)`}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Variants
          </p>
          {state.variants.map((v) => (
            <div
              key={v.key}
              className="flex items-start justify-between px-3 py-2.5 rounded-lg border border-neutral-100 bg-white"
            >
              <div>
                <p className="text-xs font-medium text-neutral-800">{v.name}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {v.isControl
                    ? "No offer — default behavior"
                    : v.offer?.giftProductId
                    ? `Gift: ${v.offer.giftProductId}`
                    : v.offer?.messageText
                    ? `"${v.offer.messageText.slice(0, 48)}${v.offer.messageText.length > 48 ? "…" : ""}"`
                    : v.offer?.thresholdAmount != null
                    ? `Threshold: $${v.offer.thresholdAmount}`
                    : "—"}
                </p>
              </div>
              <span className="text-[11px] text-neutral-500 shrink-0 ml-3">
                {v.allocationPercent}%
              </span>
            </div>
          ))}
        </div>
      </FormSection>

      {/* Launch readiness */}
      <FormSection title="Launch readiness" accent={EMERALD}>
        <LaunchReadinessPanel checks={checks} accentHex={EMERALD} />
      </FormSection>

      {error && (
        <InlineAlert variant="danger" title="Failed to create test">
          {error}
        </InlineAlert>
      )}

      {/* Create button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canLaunch || saving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canLaunch ? EMERALD_GRADIENT : undefined }}
        >
          {saving ? "Creating…" : "Create offer test"}
        </button>
        <p className="text-center text-[11px] text-neutral-400 mt-2">
          Saved as DRAFT — activate when ready.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard validation per step
// ---------------------------------------------------------------------------

function canAdvanceStep(step: number, state: WizardState): boolean {
  switch (step) {
    case 0:
      return state.name.trim().length > 0;
    case 1:
      return state.offerType !== null;
    case 2:
      return true; // trigger rules are optional
    case 3: {
      const total = state.variants.reduce(
        (s, v) => s + (v.allocationPercent || 0),
        0
      );
      if (Math.abs(total - 100) > 0.1) return false;
      if (state.offerType === "FREE_GIFT") {
        return state.variants
          .filter((v) => !v.isControl)
          .every((v) => v.offer?.giftProductId?.trim());
      }
      if (
        state.offerType === "CART_MESSAGE" ||
        state.offerType === "PRODUCT_PAGE_OFFER"
      ) {
        return state.variants
          .filter((v) => !v.isControl)
          .every((v) => v.offer?.messageText?.trim());
      }
      return true;
    }
    case 4:
      return state.placements.length > 0;
    default:
      return true;
  }
}

function blockingMessage(step: number, state: WizardState): string | undefined {
  switch (step) {
    case 0:
      return state.name.trim() ? undefined : "Enter a test name to continue.";
    case 1:
      return state.offerType ? undefined : "Select an offer type to continue.";
    case 3: {
      const total = state.variants.reduce(
        (s, v) => s + (v.allocationPercent || 0),
        0
      );
      if (Math.abs(total - 100) > 0.1)
        return `Allocation sums to ${total.toFixed(1)}%, must be 100%.`;
      if (state.offerType === "FREE_GIFT") {
        const missing = state.variants.filter(
          (v) => !v.isControl && !v.offer?.giftProductId?.trim()
        ).length;
        if (missing) return "Gift product ID required on all variants.";
      }
      if (
        state.offerType === "CART_MESSAGE" ||
        state.offerType === "PRODUCT_PAGE_OFFER"
      ) {
        const missing = state.variants.filter(
          (v) => !v.isControl && !v.offer?.messageText?.trim()
        ).length;
        if (missing) return "Offer message required on all variants.";
      }
      return undefined;
    }
    case 4:
      return state.placements.length === 0
        ? "Select at least one placement."
        : undefined;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Wizard steps definition
// ---------------------------------------------------------------------------

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Offer Type" },
  { label: "Trigger Rules" },
  { label: "Variant Offers" },
  { label: "Placement" },
  { label: "Review" },
];

const TOTAL_STEPS = STEP_DEFS.length;

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function OfferTestWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({ ...DEFAULT_STATE });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/offer-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          trafficAllocation: state.trafficAllocation,
          offerType: state.offerType,
          triggerRules: {
            minCartSubtotal: state.triggerRules.minCartSubtotal,
            minItemQty: state.triggerRules.minItemQty,
            eligibleAllProducts: state.triggerRules.eligibleAllProducts,
            eligibleProductIds: state.triggerRules.eligibleAllProducts
              ? []
              : state.triggerRules.eligibleProductIds
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
            claimBehavior: state.triggerRules.claimBehavior,
          },
          placements: state.placements,
          variants: state.variants.map((v) => ({
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            offer: v.isControl ? null : v.offer,
          })),
        }),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(
          typeof d.error === "string" ? d.error : "Failed to create"
        );
      }

      toast.success(`Offer test "${state.name}" created — activate it from the test detail page.`);
      router.push("/offer-tests");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
      setError(msg);
      setSaving(false);
    }
  }, [state, router, toast]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    }
  }, [step, handleSubmit]);

  const isLastStep = step === TOTAL_STEPS - 1;
  const canContinue = canAdvanceStep(step, state);
  const blocking = blockingMessage(step, state);

  const CONTINUE_LABELS: Record<number, string> = {
    0: "Set up variants →",
    1: "Configure offer →",
    2: "Configure variants →",
    3: "Choose placements →",
    4: "Review →",
  };

  // Enrich step nav with statuses
  const navSteps: WizardStep[] = STEP_DEFS.map((s, i) => ({
    ...s,
    status:
      i < step
        ? "complete"
        : i === step
        ? "active"
        : "pending",
  }));

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: "#0596690a" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#05966915" }}
          >
            <span className="text-base" style={{ color: EMERALD }}>◈</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Offer Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test cart offers, free gifts, volume discounts, and product incentives.
          </p>
        </div>

        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={navSteps}
            currentStep={step}
            accentHex={EMERALD}
            onStepClick={(i) => {
              if (i < step) setStep(i as typeof step);
            }}
          />
        </div>

        <div className="p-3 border-t border-neutral-50">
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Offers appear on the storefront, cart drawer, or product pages.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: EMERALD }}
          >
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Scrollable two-column area */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Step form content */}
            <div className="flex-1 min-w-0 space-y-5">
              {step === 0 && <StepSetup state={state} onChange={patch} />}
              {step === 1 && <StepOfferType state={state} onChange={patch} />}
              {step === 2 && <StepTriggerRules state={state} onChange={patch} />}
              {step === 3 && state.offerType && (
                <StepVariantOffers state={state} onChange={patch} />
              )}
              {step === 4 && <StepPlacement state={state} onChange={patch} />}
              {step === 5 && (
                <StepReview
                  state={state}
                  onSubmit={handleSubmit}
                  saving={saving}
                  error={error}
                />
              )}
            </div>

            {/* Right sidebar — live preview */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <OfferPreviewPanel
                step={step}
                offerType={state.offerType}
                triggerRules={state.triggerRules}
                variantOffers={state.variants}
                placements={state.placements}
                state={state}
              />
            </aside>
          </div>
        </div>

        {/* Sticky footer — hide on review step (it has its own submit button) */}
        {!isLastStep && (
          <StickyFormActions
            step={step}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onNext={handleNext}
            canContinue={canContinue}
            isLastStep={false}
            isSubmitting={saving}
            accentHex={EMERALD}
            blockingIssue={canContinue ? undefined : blocking}
          />
        )}
        {isLastStep && (
          <StickyFormActions
            step={step}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onNext={handleSubmit}
            canContinue={canAdvanceStep(step, state)}
            isLastStep
            isSubmitting={saving}
            submitLabel="Create offer test"
            accentHex={EMERALD}
          />
        )}
      </div>
    </div>
  );
}
