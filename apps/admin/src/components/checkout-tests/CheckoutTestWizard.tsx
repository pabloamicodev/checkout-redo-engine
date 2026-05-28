"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { TrafficSlider } from "@/components/experiments/TrafficSlider";
import { WizardInput, WizardTextarea } from "@/components/experiments/WizardControls";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#4f46e5";
const INDIGO = "#4f46e5";
const GRADIENT = "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)";

const WIZARD_STEPS = [
  { label: "Setup",           sublabel: "Name & hypothesis"     },
  { label: "Block Type",      sublabel: "Choose content type"   },
  { label: "Placement",       sublabel: "Checkout position"     },
  { label: "Variant Content", sublabel: "Edit variant content"  },
  { label: "QA",              sublabel: "Pre-launch checklist"  },
  { label: "Review",          sublabel: "Launch readiness"      },
];

const STEP_LABELS = WIZARD_STEPS.map((s) => s.label);

const CONTINUE_LABELS: Record<number, string> = {
  0: "Select block type",
  1: "Choose placement",
  2: "Edit variant content",
  3: "Run QA checks",
  4: "Review & launch",
};

const STEP_TITLES = [
  "Define your checkout experiment",
  "Choose a block type",
  "Select checkout placement",
  "Create variant content",
  "Pre-launch QA checklist",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a hypothesis about how the checkout block will improve completion rate.",
  "Choose the type of content block to test inside Shopify checkout.",
  "Select where in the checkout flow the block will appear for enrolled visitors.",
  "Write the content for each test variant. Control shows nothing (or existing content).",
  "Verify all technical requirements and content quality before launching to real shoppers.",
  "Review the full checkout block configuration before creating the test.",
];

// ─── Block types ──────────────────────────────────────────────────────────────

type BlockTypeKey =
  | "trust_badges"
  | "trust_badges_with_reviews"
  | "guarantee"
  | "shipping_message"
  | "social_proof"
  | "payment_icons"
  | "urgency_message"
  | "custom_content"
  | "image_with_text"
  | "product_upsell"
  | "security_message"
  | "free_shipping_progress";

interface BlockTypeOption {
  key: BlockTypeKey;
  icon: string;
  title: string;
  description: string;
  preview: React.ReactNode;
}

const BLOCK_TYPES: BlockTypeOption[] = [
  {
    key: "trust_badges",
    icon: "🛡",
    title: "Trust Badges",
    description: "Security and payment trust icons",
    preview: (
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded font-medium">🔒 SSL</span>
        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-medium">✓ Returns</span>
        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded font-medium">💳 Payments</span>
      </div>
    ),
  },
  {
    key: "guarantee",
    icon: "✅",
    title: "Guarantee",
    description: "Money-back or satisfaction guarantee",
    preview: (
      <p className="text-[10px] text-neutral-500 mt-1.5 italic leading-relaxed">
        "30-day money-back guarantee, no questions asked."
      </p>
    ),
  },
  {
    key: "shipping_message",
    icon: "🚚",
    title: "Shipping Message",
    description: "Delivery time and shipping info",
    preview: (
      <p className="text-[10px] text-neutral-500 mt-1.5 italic leading-relaxed">
        "Free shipping · Arrives in 3–5 days"
      </p>
    ),
  },
  {
    key: "social_proof",
    icon: "👥",
    title: "Social Proof",
    description: "Customer count or review snippet",
    preview: (
      <p className="text-[10px] text-neutral-500 mt-1.5 font-medium">
        10,000+ happy customers
      </p>
    ),
  },
  {
    key: "payment_icons",
    icon: "💳",
    title: "Payment Icons",
    description: "Accepted payment method logos",
    preview: (
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-[9px] border border-neutral-200 bg-white px-1.5 py-0.5 rounded font-semibold text-neutral-600">VISA</span>
        <span className="text-[9px] border border-neutral-200 bg-white px-1.5 py-0.5 rounded font-semibold text-neutral-600">MC</span>
        <span className="text-[9px] border border-neutral-200 bg-white px-1.5 py-0.5 rounded font-semibold text-neutral-600">PayPal</span>
        <span className="text-[9px] border border-neutral-200 bg-white px-1.5 py-0.5 rounded font-semibold text-neutral-600">GPay</span>
      </div>
    ),
  },
  {
    key: "urgency_message",
    icon: "⏰",
    title: "Urgency Message",
    description: "Stock level or time-limited offer",
    preview: (
      <p className="text-[10px] text-red-500 mt-1.5 font-medium">
        ⏰ Only 3 left — order in 2h for same-day dispatch
      </p>
    ),
  },
  {
    key: "custom_content",
    icon: "📝",
    title: "Custom Content",
    description: "Custom text with optional image",
    preview: (
      <p className="text-[10px] text-neutral-400 mt-1.5 italic">Your custom message here...</p>
    ),
  },
  {
    key: "image_with_text",
    icon: "🖼",
    title: "Image with Text",
    description: "Image + headline + description",
    preview: (
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="w-8 h-6 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center">
          <span className="text-[9px] text-neutral-400">img</span>
        </div>
        <p className="text-[10px] text-neutral-500 font-medium">Trusted by 50,000+</p>
      </div>
    ),
  },
  {
    key: "trust_badges_with_reviews",
    icon: "🏅",
    title: "Trust Badges + Reviews",
    description: "Trust badges combined with a customer reviews carousel",
    preview: (
      <div className="space-y-1 mt-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded font-medium">🔒 SSL</span>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-medium">✓ Returns</span>
        </div>
        <p className="text-[10px] text-amber-500">★★★★★ <span className="text-neutral-500">"Great product!"</span></p>
      </div>
    ),
  },
  {
    key: "product_upsell",
    icon: "🛒",
    title: "Product Upsell",
    description: "Offer an add-on product buyers can add in one click",
    preview: (
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="w-7 h-7 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center">
          <span className="text-[9px] text-neutral-400">img</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-neutral-700 truncate">Add Creatine — $19</p>
          <p className="text-[9px] text-neutral-400">Save 15% with this order</p>
        </div>
      </div>
    ),
  },
  {
    key: "security_message",
    icon: "🛡",
    title: "Security Message",
    description: "SSL, encryption, and data privacy reassurance block",
    preview: (
      <p className="text-[10px] text-neutral-500 mt-1.5 italic leading-relaxed">
        🔒 Your information is encrypted and secure.
      </p>
    ),
  },
  {
    key: "free_shipping_progress",
    icon: "📶",
    title: "Free Shipping Progress",
    description: "Progress bar showing how close the buyer is to free shipping",
    preview: (
      <div className="mt-1.5 space-y-1">
        <p className="text-[10px] text-neutral-500">Add $15 more for free shipping</p>
        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-400" style={{ width: "60%" }} />
        </div>
      </div>
    ),
  },
];

// ─── Placement options ────────────────────────────────────────────────────────

type PlacementKey =
  | "before_information"
  | "after_contact"
  | "before_shipping"
  | "after_shipping"
  | "before_payment"
  | "after_payment"
  | "order_summary";

interface PlacementOption {
  key: PlacementKey;
  label: string;
  recommended?: boolean;
}

const PLACEMENTS: PlacementOption[] = [
  { key: "before_information", label: "Before information form"  },
  { key: "after_contact",      label: "After contact information" },
  { key: "before_shipping",    label: "Before shipping methods"   },
  { key: "after_shipping",     label: "After shipping methods"    },
  { key: "before_payment",     label: "Before payment",           recommended: true },
  { key: "after_payment",      label: "After payment"             },
  { key: "order_summary",      label: "Order summary"             },
];

// ─── Badge / icon options ─────────────────────────────────────────────────────

const BADGE_OPTIONS = [
  "SSL Secure",
  "Money-back Guarantee",
  "Free Returns",
  "Visa",
  "Mastercard",
  "PayPal",
  "Apple Pay",
  "Shop Pay",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VariantContent {
  // trust_badges / payment_icons
  selectedBadges: string[];
  // guarantee / shipping_message / urgency_message / custom_content
  textContent: string;
  // social_proof
  customerCount: number;
  socialLabel: string;
  // image_with_text
  imageUrl: string;
  headline: string;
  bodyText: string;
}

interface VariantConfig extends AllocationVariant {
  checkoutBlockIds: string[];
  inlineContent: VariantContent;
}

interface WizardState {
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  blockType: BlockTypeKey | null;
  placement: PlacementKey | null;
  variants: VariantConfig[];
}

interface QAState {
  extensionInstalled: boolean;
  blockAppearsInPreview: boolean;
  readableOnMobile: boolean;
  noLayoutIssues: boolean;
  testedWithOrder: boolean;
}

interface CheckoutBlock {
  id: string;
  name: string;
  type: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyContent(): VariantContent {
  return {
    selectedBadges: [],
    textContent: "",
    customerCount: 0,
    socialLabel: "happy customers",
    imageUrl: "",
    headline: "",
    bodyText: "",
  };
}

function emptyVariant(isControl: boolean, idx: number): VariantConfig {
  return {
    key: isControl ? "control" : `variant_${String.fromCharCode(97 + idx - 1)}`,
    name: isControl ? "Control (no block)" : `Variant ${String.fromCharCode(65 + idx - 1)}`,
    isControl,
    allocationPercent: 50,
    checkoutBlockIds: [],
    inlineContent: emptyContent(),
  };
}

function isContentEmpty(v: VariantConfig, blockType: BlockTypeKey | null): boolean {
  if (!blockType) return false;
  const c = v.inlineContent;
  if (blockType === "trust_badges" || blockType === "payment_icons" || blockType === "trust_badges_with_reviews") return c.selectedBadges.length === 0;
  if (blockType === "social_proof") return c.customerCount === 0;
  if (blockType === "image_with_text") return !c.headline.trim();
  if (blockType === "product_upsell") return !c.headline.trim();
  if (blockType === "free_shipping_progress") return c.customerCount === 0;
  return !c.textContent.trim();
}

// ─── Checkout Preview Panel ───────────────────────────────────────────────────

function BlockZoneContent({
  blockType,
  variantContents,
}: {
  blockType: BlockTypeKey | null;
  variantContents: VariantConfig[];
}) {
  const firstVariant = variantContents.find((v) => !v.isControl);
  const c = firstVariant?.inlineContent;

  if (!blockType) {
    return (
      <p className="text-[10px] text-neutral-400 text-center py-1">
        Select a block type to preview
      </p>
    );
  }

  if (blockType === "trust_badges") {
    const badges = c?.selectedBadges.length
      ? c.selectedBadges
      : ["SSL Secure", "Free Returns", "Money-back Guarantee"];
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap py-0.5">
        {badges.slice(0, 4).map((badge) => (
          <span
            key={badge}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100"
          >
            {badge === "SSL Secure" ? "🔒 " : badge === "Free Returns" ? "✓ " : badge === "Money-back Guarantee" ? "💰 " : "✓ "}
            {badge}
          </span>
        ))}
      </div>
    );
  }

  if (blockType === "guarantee") {
    const text = c?.textContent || "30-day money-back guarantee, no questions asked.";
    return (
      <p className="text-[10px] text-green-700 text-center font-medium py-0.5">
        ✅ {text}
      </p>
    );
  }

  if (blockType === "shipping_message") {
    const text = c?.textContent || "Free standard shipping · Delivered in 3–5 business days.";
    return (
      <p className="text-[10px] text-blue-700 text-center font-medium py-0.5">
        🚚 {text}
      </p>
    );
  }

  if (blockType === "social_proof") {
    const count = c?.customerCount || 10000;
    const label = c?.socialLabel || "happy customers";
    return (
      <p className="text-[10px] text-neutral-700 text-center font-medium py-0.5">
        👥 {count.toLocaleString()}+ {label}
      </p>
    );
  }

  if (blockType === "payment_icons") {
    const methods = c?.selectedBadges.length ? c.selectedBadges : ["Visa", "Mastercard", "PayPal", "Apple Pay"];
    return (
      <div className="flex items-center justify-center gap-1 flex-wrap py-0.5">
        {methods.slice(0, 5).map((m) => (
          <span
            key={m}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-neutral-200 bg-white text-neutral-600"
          >
            {m}
          </span>
        ))}
      </div>
    );
  }

  if (blockType === "urgency_message") {
    const text = c?.textContent || "Only 3 left in stock — order in the next 2 hours for same-day dispatch.";
    return (
      <p className="text-[10px] text-red-600 text-center font-medium py-0.5">
        ⏰ {text}
      </p>
    );
  }

  if (blockType === "custom_content") {
    const text = c?.textContent || "Your custom message will appear here.";
    return (
      <p className="text-[10px] text-neutral-700 text-center py-0.5">{text}</p>
    );
  }

  if (blockType === "image_with_text") {
    const headline = c?.headline || "Trusted by 50,000+ customers";
    const body = c?.bodyText || "Your order is protected by our 30-day money-back guarantee.";
    return (
      <div className="text-center py-0.5">
        <p className="text-[10px] font-semibold text-neutral-800">{headline}</p>
        {body && <p className="text-[9px] text-neutral-500 mt-0.5">{body}</p>}
      </div>
    );
  }

  return (
    <p className="text-[10px] text-neutral-400 text-center py-1">[Block content will appear here]</p>
  );
}

// Map placement key to zone position label
function placementToZone(placement: PlacementKey | null): string {
  if (!placement) return "before_payment";
  return placement;
}

function CheckoutFrameMockup({
  blockType,
  placement,
  variantContents,
  showBlockZone,
}: {
  blockType: BlockTypeKey | null;
  placement: PlacementKey | null;
  variantContents: VariantConfig[];
  showBlockZone: boolean;
}) {
  const zone = placementToZone(placement);
  const isOrderSummary = zone === "order_summary";
  const isBeforePayment = zone === "before_payment" || zone === "after_shipping";
  const isBeforeShipping = zone === "before_shipping" || zone === "after_contact";
  const isBeforeInfo = zone === "before_information";
  const isAfterPayment = zone === "after_payment";

  const blockZone = showBlockZone ? (
    <div
      className="rounded border-2 px-2 py-1.5 my-1"
      style={{ borderColor: INDIGO, borderStyle: "dashed", background: "#eef2ff" }}
    >
      <p className="text-[9px] font-semibold mb-1" style={{ color: INDIGO }}>
        {placement
          ? PLACEMENTS.find((p) => p.key === placement)?.label ?? "Block placement"
          : "Block placement"}
      </p>
      <BlockZoneContent blockType={blockType} variantContents={variantContents} />
    </div>
  ) : null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden text-[10px] shadow-sm">
      {/* Browser chrome */}
      <div className="bg-neutral-100 border-b border-neutral-200 px-3 py-1.5 flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-300" />
          <div className="w-2 h-2 rounded-full bg-yellow-300" />
          <div className="w-2 h-2 rounded-full bg-green-300" />
        </div>
        <div className="flex-1 bg-white rounded border border-neutral-200 px-2 py-0.5 text-[9px] text-neutral-400 text-center">
          checkout.shopify.com/store/checkout
        </div>
      </div>

      {/* Checkout header */}
      <div className="px-3 pt-2.5 pb-1.5 border-b border-neutral-100">
        <p className="text-[9px] font-bold text-neutral-800 mb-1.5">Shopify Checkout</p>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[9px]">
          <span className="text-neutral-400">Contact</span>
          <span className="text-neutral-300">›</span>
          <span className="text-neutral-400">Shipping</span>
          <span className="text-neutral-300">›</span>
          <span
            className="font-semibold px-1.5 py-0.5 rounded"
            style={{ color: INDIGO, background: "#eef2ff" }}
          >
            Payment
          </span>
        </div>
      </div>

      {/* Checkout body */}
      <div className="flex gap-0">
        {/* Left col — main form */}
        <div className="flex-1 px-3 py-2 space-y-1.5">
          {isBeforeInfo && blockZone}

          {/* Contact info */}
          <div className="space-y-1">
            <div className="h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center">
              <span className="text-[9px] text-neutral-400">John Doe</span>
            </div>
            <div className="h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center">
              <span className="text-[9px] text-neutral-400">john@example.com</span>
            </div>
          </div>

          {isBeforeShipping && blockZone}

          {/* Shipping */}
          <div className="h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center justify-between">
            <span className="text-[9px] text-neutral-400">Standard shipping</span>
            <span className="text-[9px] text-green-600 font-medium">Free</span>
          </div>

          {isBeforePayment && blockZone}

          {/* Payment fields */}
          <div className="space-y-1">
            <p className="text-[9px] font-semibold text-neutral-600">Payment</p>
            <div className="h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center">
              <span className="text-[9px] text-neutral-300">Card number</span>
            </div>
            <div className="flex gap-1">
              <div className="flex-1 h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center">
                <span className="text-[9px] text-neutral-300">MM/YY</span>
              </div>
              <div className="flex-1 h-4 bg-neutral-50 border border-neutral-100 rounded px-1.5 flex items-center">
                <span className="text-[9px] text-neutral-300">CVV</span>
              </div>
            </div>
          </div>

          {isAfterPayment && blockZone}

          {/* Pay button */}
          <button
            type="button"
            className="w-full h-6 rounded text-[9px] font-bold text-white mt-1"
            style={{ background: GRADIENT }}
          >
            Pay now — $129.00
          </button>
        </div>

        {/* Right col — order summary */}
        <div
          className="w-28 shrink-0 border-l border-neutral-100 px-2 py-2"
          style={{ background: "#fafafa" }}
        >
          <p className="text-[9px] font-semibold text-neutral-600 mb-1.5">Order summary</p>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-8 h-8 bg-neutral-200 rounded shrink-0" />
            <div>
              <p className="text-[9px] font-medium text-neutral-700 leading-tight">Product name</p>
              <p className="text-[9px] text-neutral-500">$129.00</p>
            </div>
          </div>
          <div className="border-t border-neutral-100 pt-1.5 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[9px] text-neutral-500">Subtotal</span>
              <span className="text-[9px] text-neutral-700">$129.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-neutral-500">Shipping</span>
              <span className="text-[9px] text-green-600">Free</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[9px] text-neutral-800">Total</span>
              <span className="text-[9px] text-neutral-800">$129.00</span>
            </div>
          </div>
          {isOrderSummary && (
            <div className="mt-2">
              {blockZone}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

function CheckoutPreviewPanel({
  step,
  blockType,
  placement,
  variantContents,
  qaItems,
}: {
  step: number;
  blockType: BlockTypeKey | null;
  placement: PlacementKey | null;
  variantContents: VariantConfig[];
  qaItems: QAState;
}) {
  const [previewMode, setPreviewMode] = React.useState<"control" | "variant">("variant");

  const firstVariant = variantContents.find((v) => !v.isControl);
  const configuredVariants = variantContents.filter(
    (v) => !v.isControl && !isContentEmpty(v, blockType)
  ).length;

  const showBlockZone = step >= 1 && blockType !== null && previewMode === "variant";
  const blockTypeLabel = BLOCK_TYPES.find((b) => b.key === blockType)?.title ?? null;
  const placementLabel = PLACEMENTS.find((p) => p.key === placement)?.label ?? null;

  return (
    <div className="space-y-3">
      {/* Preview label + toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          Live Preview
        </p>
        {firstVariant && step >= 1 && (
          <div className="flex items-center rounded-lg overflow-hidden border border-neutral-200 text-[9px] font-medium">
            <button
              type="button"
              onClick={() => setPreviewMode("control")}
              className="px-2 py-1 transition-colors"
              style={
                previewMode === "control"
                  ? { background: "#f3f4f6", color: "#374151" }
                  : { background: "#fff", color: "#9ca3af" }
              }
            >
              Control
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("variant")}
              className="px-2 py-1 transition-colors"
              style={
                previewMode === "variant"
                  ? { background: INDIGO, color: "#fff" }
                  : { background: "#fff", color: "#9ca3af" }
              }
            >
              Variant A
            </button>
          </div>
        )}
      </div>

      {/* Control = no block callout */}
      {previewMode === "control" && step >= 1 && (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 flex items-start gap-2">
          <span className="text-sm mt-0.5">🚫</span>
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            <span className="font-semibold text-neutral-700">Control:</span> No block is shown. Visitors see the standard checkout experience.
          </p>
        </div>
      )}

      {/* Checkout frame */}
      <CheckoutFrameMockup
        blockType={blockType}
        placement={placement}
        variantContents={variantContents}
        showBlockZone={showBlockZone}
      />

      {/* Compact summary card */}
      <div className="bg-white border border-neutral-100 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-50">
          <p className="text-[10px] font-bold text-neutral-700">Test configuration</p>
        </div>
        <div className="divide-y divide-neutral-50">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] text-neutral-500">Block type</span>
            {blockTypeLabel ? (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "#eef2ff", color: INDIGO }}
              >
                {blockTypeLabel}
              </span>
            ) : (
              <span className="text-[10px] text-neutral-300 italic">Not selected</span>
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] text-neutral-500">Placement</span>
            {placementLabel ? (
              <span className="text-[10px] font-medium text-neutral-700 text-right max-w-[110px] leading-tight">
                {placementLabel}
              </span>
            ) : (
              <span className="text-[10px] text-neutral-300 italic">Not selected</span>
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] text-neutral-500">Extension</span>
            {qaItems.extensionInstalled ? (
              <span className="text-[10px] font-medium text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Active
              </span>
            ) : (
              <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Unconfirmed
              </span>
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] text-neutral-500">Variants</span>
            <span className="text-[10px] font-medium text-neutral-700">
              {configuredVariants} configured
            </span>
          </div>
        </div>
      </div>

      {/* Hint */}
      {step === 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
          <p className="text-[9px] text-indigo-700 leading-relaxed">
            The checkout frame preview will update as you configure your block type and placement.
          </p>
        </div>
      )}
      {step === 1 && !blockType && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[9px] text-amber-700 leading-relaxed">
            Select a block type on the left to see how it looks inside checkout.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 1 — Setup ───────────────────────────────────────────────────────────

function StepSetup({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Test details" accent={ACCENT}>
        <div className="space-y-4">
          <WizardInput
            label="Test name"
            required
            value={state.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="Trust Badge Placement Test"
            maxLength={80}
            accentColor={ACCENT}
            hint="Use a name that describes the block type and what you're measuring."
          />

          <WizardTextarea
            label="Hypothesis"
            value={state.hypothesis}
            onChange={(v) => onChange({ hypothesis: v })}
            placeholder="Adding payment security badges above the payment step will increase checkout completion rate."
            rows={3}
            maxLength={400}
            accentColor={ACCENT}
            hint="Describe what you expect to happen and why."
            templateText="If we add [trust badge / social proof / shipping message] to [placement], then checkout completion rate will increase because it reduces purchase anxiety."
          />

          <TrafficSlider
            value={state.trafficAllocation}
            onChange={(v) => onChange({ trafficAllocation: v })}
            accentColor={ACCENT}
            holdoutLabel="See default checkout"
          />
        </div>
      </FormSection>
    </div>
  );
}

// ─── Step 2 — Block Type ──────────────────────────────────────────────────────

function StepBlockType({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <FormSection
      title="Block type"
      description="Choose the type of content block you want to test in your checkout."
      accent={ACCENT}
    >
      <div className="grid grid-cols-2 gap-3">
        {BLOCK_TYPES.map((bt) => {
          const selected = state.blockType === bt.key;
          return (
            <button
              key={bt.key}
              type="button"
              onClick={() => onChange({ blockType: bt.key })}
              className="relative text-left rounded-xl border-2 p-3.5 transition-all focus:outline-none"
              style={
                selected
                  ? { borderColor: ACCENT, background: "#eef2ff" }
                  : { borderColor: "#e5e7eb", background: "#fff" }
              }
            >
              {/* Check badge */}
              {selected && (
                <span
                  className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: ACCENT }}
                >
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}

              {/* Icon */}
              <span className="text-2xl block mb-1.5">{bt.icon}</span>

              {/* Title */}
              <p
                className="text-sm font-bold leading-snug"
                style={{ color: selected ? ACCENT : "#111827" }}
              >
                {bt.title}
              </p>

              {/* Description */}
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{bt.description}</p>

              {/* Mini preview */}
              <div
                className="mt-2 pt-2 border-t"
                style={{ borderColor: selected ? "#c7d2fe" : "#f3f4f6" }}
              >
                {bt.preview}
              </div>
            </button>
          );
        })}
      </div>
    </FormSection>
  );
}

// ─── Step 3 — Placement ───────────────────────────────────────────────────────

function StepPlacement({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const steps = ["Information", "Shipping", "Payment", "Review"];

  return (
    <div className="space-y-6">
      <InlineAlert variant="warning">
        The Checkout UI Extension must be installed in your Shopify theme for this block to appear.{" "}
        <a
          href="/checkout-blocks"
          className="font-semibold underline underline-offset-2 inline-flex items-center gap-1"
        >
          Check extension health <ExternalLink className="w-3 h-3" />
        </a>
      </InlineAlert>

      <FormSection title="Checkout flow" accent={ACCENT}>
        {/* Visual flow diagram */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center shrink-0">
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: "#c7d2fe", color: ACCENT, background: "#eef2ff" }}
              >
                {s}
              </div>
              {i < steps.length - 1 && (
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-neutral-300 shrink-0 mx-0.5" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* Radio options */}
        <div className="space-y-2">
          {PLACEMENTS.map((p) => {
            const selected = state.placement === p.key;
            return (
              <label
                key={p.key}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all"
                style={
                  selected
                    ? { borderColor: ACCENT, background: "#eef2ff" }
                    : { borderColor: "#e5e7eb", background: "#fff" }
                }
              >
                <input
                  type="radio"
                  name="placement"
                  value={p.key}
                  checked={selected}
                  onChange={() => onChange({ placement: p.key })}
                  className="shrink-0"
                  style={{ accentColor: ACCENT }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: selected ? ACCENT : "#374151" }}
                >
                  {p.label}
                </span>
                {p.recommended && (
                  <span
                    className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#eef2ff", color: ACCENT }}
                  >
                    Recommended
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

// ─── Step 4 — Variant Content ─────────────────────────────────────────────────

function ContentEditor({
  variant,
  blockType,
  onChange,
}: {
  variant: VariantConfig;
  blockType: BlockTypeKey;
  onChange: (c: Partial<VariantContent>) => void;
}) {
  const c = variant.inlineContent;

  if (blockType === "trust_badges" || blockType === "payment_icons") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-neutral-600 mb-1">Select badges to display</p>
        <div className="grid grid-cols-2 gap-2">
          {BADGE_OPTIONS.map((badge) => {
            const checked = c.selectedBadges.includes(badge);
            return (
              <label key={badge} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      selectedBadges: checked
                        ? c.selectedBadges.filter((b) => b !== badge)
                        : [...c.selectedBadges, badge],
                    })
                  }
                  style={{ accentColor: ACCENT }}
                />
                <span className="text-sm text-neutral-700">{badge}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (blockType === "social_proof") {
    return (
      <div className="space-y-3">
        <FormField label="Customer count">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={c.customerCount}
              onChange={(e) => onChange({ customerCount: parseInt(e.target.value) || 0 })}
              className="input-base w-32"
              placeholder="10000"
            />
            <span className="text-sm text-neutral-500">+</span>
          </div>
        </FormField>
        <FormField label="Label text">
          <input
            type="text"
            value={c.socialLabel}
            onChange={(e) => onChange({ socialLabel: e.target.value })}
            className="input-base"
            placeholder="happy customers"
          />
        </FormField>
        <p className="text-xs text-neutral-400 italic">
          Preview: "{c.customerCount.toLocaleString()}+ {c.socialLabel}"
        </p>
      </div>
    );
  }

  if (blockType === "image_with_text") {
    return (
      <div className="space-y-3">
        <FormField label="Image URL">
          <input
            type="url"
            value={c.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            className="input-base"
            placeholder="https://cdn.shopify.com/..."
          />
        </FormField>
        <FormField label="Headline" required>
          <input
            type="text"
            value={c.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            className="input-base"
            placeholder="Trusted by 50,000+ customers"
          />
        </FormField>
        <FormField label="Body text">
          <textarea
            rows={2}
            value={c.bodyText}
            onChange={(e) => onChange({ bodyText: e.target.value })}
            className="input-base resize-none"
            placeholder="Your order is protected by our 30-day money-back guarantee."
          />
        </FormField>
      </div>
    );
  }

  if (blockType === "trust_badges_with_reviews") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-neutral-600 mb-1">Select trust badges to display</p>
        <div className="grid grid-cols-2 gap-2">
          {BADGE_OPTIONS.map((badge) => {
            const checked = c.selectedBadges.includes(badge);
            return (
              <label key={badge} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      selectedBadges: checked
                        ? c.selectedBadges.filter((b) => b !== badge)
                        : [...c.selectedBadges, badge],
                    })
                  }
                  style={{ accentColor: ACCENT }}
                />
                <span className="text-sm text-neutral-700">{badge}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-neutral-400 mt-2">Customer reviews will be pulled from your Shopify reviews metafields.</p>
      </div>
    );
  }

  if (blockType === "product_upsell") {
    return (
      <div className="space-y-3">
        <FormField label="Product handle or variant ID" required>
          <input
            type="text"
            value={c.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            className="input-base"
            placeholder="creatine-monohydrate or gid://shopify/ProductVariant/..."
          />
        </FormField>
        <FormField label="Offer label">
          <input
            type="text"
            value={c.bodyText}
            onChange={(e) => onChange({ bodyText: e.target.value })}
            className="input-base"
            placeholder="Add to your order and save 15%"
          />
        </FormField>
      </div>
    );
  }

  if (blockType === "free_shipping_progress") {
    return (
      <div className="space-y-3">
        <FormField label="Free shipping threshold ($)" required>
          <input
            type="number"
            min={1}
            value={c.customerCount || ""}
            onChange={(e) => onChange({ customerCount: parseFloat(e.target.value) || 0 })}
            className="input-base w-40"
            placeholder="50"
          />
        </FormField>
        <FormField label="Progress message">
          <input
            type="text"
            value={c.textContent}
            onChange={(e) => onChange({ textContent: e.target.value })}
            className="input-base"
            placeholder="Add {amount} more for free shipping!"
          />
        </FormField>
        <p className="text-[11px] text-neutral-400">Use <code className="bg-neutral-100 px-1 rounded">{"{amount}"}</code> to show the remaining amount dynamically.</p>
      </div>
    );
  }

  // guarantee / shipping_message / urgency_message / custom_content / security_message
  const placeholders: Record<BlockTypeKey, string> = {
    guarantee:                  "30-day money-back guarantee, no questions asked.",
    shipping_message:           "Free standard shipping · Delivered in 3–5 business days.",
    urgency_message:            "Only 3 left in stock — order in the next 2 hours for same-day dispatch.",
    custom_content:             "Enter your custom message here.",
    security_message:           "Your information is encrypted and 100% secure.",
    free_shipping_progress:     "Add $15 more to unlock free shipping.",
    trust_badges:               "",
    trust_badges_with_reviews:  "",
    payment_icons:              "",
    social_proof:               "",
    image_with_text:            "",
    product_upsell:             "",
  };

  return (
    <FormField label="Message text" required>
      <textarea
        rows={3}
        maxLength={300}
        value={c.textContent}
        onChange={(e) => onChange({ textContent: e.target.value })}
        className="input-base resize-none"
        placeholder={placeholders[blockType]}
      />
      <p className="text-[11px] text-neutral-400 mt-1 text-right">{c.textContent.length}/300</p>
    </FormField>
  );
}

function StepVariantContent({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function patchVariant(i: number, patch: Partial<VariantConfig>) {
    onChange({ variants: state.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  }

  function patchContent(i: number, patch: Partial<VariantContent>) {
    const v = state.variants[i];
    if (!v) return;
    patchVariant(i, { inlineContent: { ...v.inlineContent, ...patch } });
  }

  function addVariant() {
    const nonControl = state.variants.filter((v) => !v.isControl).length;
    const even = parseFloat((100 / (state.variants.length + 1)).toFixed(1));
    const remainder = parseFloat((100 - even * state.variants.length).toFixed(1));
    onChange({
      variants: [
        ...state.variants.map((v, i) => ({ ...v, allocationPercent: i === state.variants.length - 1 ? remainder : even })),
        { ...emptyVariant(false, nonControl + 1), allocationPercent: even },
      ],
    });
  }

  const blockType = state.blockType;

  return (
    <div className="space-y-6">
      <InlineAlert variant="warning">
        Do not include custom HTML or JavaScript — Shopify checkout blocks only support safe text content.
      </InlineAlert>

      {/* Allocation editor */}
      <FormSection title="Traffic split" accent={ACCENT}>
        <VariantAllocationEditor
          variants={state.variants}
          onChange={(updated) =>
            onChange({
              variants: state.variants.map((v, i) => ({
                ...v,
                allocationPercent: updated[i]?.allocationPercent ?? v.allocationPercent,
              })),
            })
          }
          accentHex={ACCENT}
        />
      </FormSection>

      {/* Per-variant content */}
      <FormSection title="Variant content" description="Define the block content for each non-control variant." accent={ACCENT}>
        <div className="space-y-4">
          {state.variants.map((v, vi) => (
            <div key={vi} className="rounded-xl border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  {v.isControl && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 uppercase tracking-wide">
                      Control
                    </span>
                  )}
                  <input
                    value={v.name}
                    onChange={(e) => patchVariant(vi, { name: e.target.value })}
                    className="text-sm font-semibold bg-transparent border-0 border-b border-transparent hover:border-neutral-300 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                {!v.isControl && state.variants.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onChange({ variants: state.variants.filter((_, i) => i !== vi) })}
                    className="text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                {v.isControl ? (
                  <p className="text-xs text-neutral-400 italic">
                    Standard checkout — no block shown. Serves as the baseline.
                  </p>
                ) : blockType ? (
                  <>
                    <ContentEditor
                      variant={v}
                      blockType={blockType}
                      onChange={(patch) => patchContent(vi, patch)}
                    />
                    {isContentEmpty(v, blockType) && (
                      <div className="mt-3">
                        <InlineAlert variant="danger">
                          Content cannot be empty for a non-control variant.
                        </InlineAlert>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-neutral-400 italic">Go back to Step 2 to select a block type first.</p>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1.5"
            style={{ borderColor: "#e0e7ff" }}
          >
            <Plus className="w-4 h-4" /> Add Variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ─── Step 5 — QA ─────────────────────────────────────────────────────────────

interface QAItem {
  key: keyof QAState;
  label: string;
}

const QA_ITEMS: QAItem[] = [
  { key: "extensionInstalled",    label: "Checkout UI Extension is installed and active"         },
  { key: "blockAppearsInPreview", label: "Block appears in checkout preview"                     },
  { key: "readableOnMobile",      label: "Content is readable on mobile"                         },
  { key: "noLayoutIssues",        label: "No layout issues on the selected placement"             },
  { key: "testedWithOrder",       label: "Tested with a test order"                              },
];

function StepQA({
  qa,
  onChange,
}: {
  qa: QAState;
  onChange: (patch: Partial<QAState>) => void;
}) {
  const completedCount = Object.values(qa).filter(Boolean).length;
  const total = QA_ITEMS.length;
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-5">
      <FormSection
        title="Pre-launch checklist"
        description="Confirm each item before launching. All are optional but strongly recommended."
        accent={ACCENT}
      >
        <div className="space-y-2">
          {QA_ITEMS.map((item) => {
            const checked = qa[item.key];
            return (
              <label
                key={item.key}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all"
                style={
                  checked
                    ? { borderColor: "#a5b4fc", background: "#eef2ff" }
                    : { borderColor: "#e5e7eb", background: "#fff" }
                }
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all"
                  style={
                    checked
                      ? { background: ACCENT, borderColor: ACCENT }
                      : { borderColor: "#d1d5db" }
                  }
                >
                  {checked && (
                    <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => onChange({ [item.key]: e.target.checked })}
                />
                <span
                  className="text-sm"
                  style={{ color: checked ? ACCENT : "#374151", fontWeight: checked ? 500 : 400 }}
                >
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </FormSection>

      {/* Progress bar */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
          <span>{completedCount}/{total} completed</span>
          <span className="font-semibold" style={{ color: pct === 100 ? "#10b981" : ACCENT }}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : GRADIENT }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 6 — Review ─────────────────────────────────────────────────────────

function buildReadinessChecks(state: WizardState, qa: QAState): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  checks.push({
    id: "name",
    label: "Test name is set",
    status: state.name.trim() ? "pass" : "block",
    detail: state.name.trim() ? undefined : "Enter a name in Step 1.",
  });

  checks.push({
    id: "block_type",
    label: "Block type selected",
    status: state.blockType ? "pass" : "block",
    detail: state.blockType ? undefined : "Select a block type in Step 2.",
  });

  checks.push({
    id: "placement",
    label: "Placement selected",
    status: state.placement ? "pass" : "block",
    detail: state.placement ? undefined : "Choose a checkout placement in Step 3.",
  });

  const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  checks.push({
    id: "allocation",
    label: "Traffic allocation totals 100%",
    status: Math.abs(total - 100) < 0.1 ? "pass" : "block",
    detail: Math.abs(total - 100) < 0.1 ? undefined : `Currently ${total.toFixed(1)}% — must equal 100%.`,
  });

  const hasEmptyContent = state.variants.some((v) => !v.isControl && state.blockType && isContentEmpty(v, state.blockType));
  checks.push({
    id: "content",
    label: "All variant content filled",
    status: hasEmptyContent ? "block" : "pass",
    detail: hasEmptyContent ? "One or more non-control variants have empty content." : undefined,
  });

  checks.push({
    id: "extension_installed",
    label: "Extension confirmed installed",
    status: qa.extensionInstalled ? "pass" : "warn",
    detail: qa.extensionInstalled ? undefined : "Mark as confirmed in the QA step.",
  });

  checks.push({
    id: "mobile_tested",
    label: "Tested on mobile",
    status: qa.readableOnMobile ? "pass" : "warn",
    detail: qa.readableOnMobile ? undefined : "Consider verifying mobile layout before launch.",
  });

  if (state.hypothesis.trim()) {
    checks.push({
      id: "hypothesis",
      label: "Hypothesis documented",
      status: "pass",
    });
  }

  return checks;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-neutral-50 last:border-0">
      <span className="w-36 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-neutral-900 flex-1">{value}</span>
    </div>
  );
}

function StepReview({
  state,
  qa,
  availableBlocks,
}: {
  state: WizardState;
  qa: QAState;
  availableBlocks: CheckoutBlock[];
}) {
  const blockMap = Object.fromEntries(availableBlocks.map((b) => [b.id, b.name]));
  const checks = buildReadinessChecks(state, qa);
  const blockers = checks.filter((c) => c.status === "block");

  const placementLabel = PLACEMENTS.find((p) => p.key === state.placement)?.label ?? "—";
  const blockTypeLabel = BLOCK_TYPES.find((b) => b.key === state.blockType)?.title ?? "—";

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />

      <FormSection title="Test summary" accent={ACCENT}>
        <div className="bg-neutral-50 rounded-xl border border-neutral-100 px-4 py-3 divide-y divide-neutral-100">
          <SummaryRow label="Name" value={state.name || <span className="text-neutral-400 italic">Not set</span>} />
          <SummaryRow label="Traffic" value={`${state.trafficAllocation}% of visitors`} />
          <SummaryRow label="Block type" value={blockTypeLabel} />
          <SummaryRow label="Placement" value={placementLabel} />
          <SummaryRow
            label="Hypothesis"
            value={state.hypothesis.trim() || <span className="text-neutral-400 italic">None</span>}
          />
        </div>
      </FormSection>

      <FormSection title="Variants" accent={ACCENT}>
        <div className="space-y-2">
          {state.variants.map((v) => (
            <div
              key={v.key}
              className="flex items-start justify-between text-sm bg-white border border-neutral-100 rounded-xl px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-neutral-900">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 uppercase">
                      Control
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {v.isControl
                    ? "No block — default checkout experience"
                    : v.checkoutBlockIds.length > 0
                    ? v.checkoutBlockIds.map((id) => blockMap[id] ?? id).join(", ")
                    : "Inline block config"}
                </p>
              </div>
              <span className="shrink-0 ml-3 text-xs font-semibold text-neutral-500 tabular-nums">
                {v.allocationPercent}%
              </span>
            </div>
          ))}
        </div>
      </FormSection>

      {blockers.length === 0 && (
        <p className="text-xs text-neutral-400 text-center">
          Test will be saved as <strong>DRAFT</strong> — activate it when ready.
        </p>
      )}
    </div>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

const DEFAULT_QA: QAState = {
  extensionInstalled: false,
  blockAppearsInPreview: false,
  readableOnMobile: false,
  noLayoutIssues: false,
  testedWithOrder: false,
};

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  blockType: null,
  placement: null,
  variants: [emptyVariant(true, 0), emptyVariant(false, 1)],
};

export function CheckoutTestWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [qa, setQa] = useState<QAState>(DEFAULT_QA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableBlocks, setAvailableBlocks] = useState<CheckoutBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  useEffect(() => {
    fetch("/api/checkout-blocks?limit=100")
      .then((r) => r.json())
      .then((d: { items?: CheckoutBlock[] }) => setAvailableBlocks(d.items ?? []))
      .catch(() => setAvailableBlocks([]))
      .finally(() => setLoadingBlocks(false));
  }, []);

  void loadingBlocks;

  const patch = useCallback(function patch(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  function patchQa(p: Partial<QAState>) {
    setQa((prev) => ({ ...prev, ...p }));
  }

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 1) return state.blockType !== null;
    if (step === 2) return state.placement !== null;
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
      if (Math.abs(total - 100) > 0.1) return false;
      return !state.variants.some((v) => !v.isControl && isContentEmpty(v, state.blockType));
    }
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 1 && !state.blockType) return "Select a block type to continue";
    if (step === 2 && !state.placement) return "Select a placement to continue";
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
      if (Math.abs(total - 100) > 0.1) return "Allocation must total 100%";
      if (state.variants.some((v) => !v.isControl && isContentEmpty(v, state.blockType))) return "All variants need content";
    }
    return undefined;
  }

  const readinessChecks = buildReadinessChecks(state, qa);
  const hasBlockers = readinessChecks.some((c) => c.status === "block");

  const handleSubmit = useCallback(async function handleSubmit() {
    if (hasBlockers) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          trafficAllocation: state.trafficAllocation,
          blockType: state.blockType,
          placement: state.placement,
          variants: state.variants.map((v) => ({
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            checkoutBlockIds: v.isControl ? [] : v.checkoutBlockIds,
            inlineContent: v.isControl ? undefined : v.inlineContent,
          })),
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create test");
      }
      toast.success(`Checkout test "${state.name}" created — activate it from the test detail page.`);
      router.push("/checkout-tests");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create test. Check your connection and try again.";
      toast.error(msg);
      setError(msg);
      setSaving(false);
    }
  }, [state, router, toast]);

  const TOTAL_STEPS = WIZARD_STEPS.length;

  const wizardSteps = WIZARD_STEPS.map((s, i) => ({
    label: s.label,
    sublabel: s.sublabel,
    status: (i < step ? "complete" : i === step ? "active" : "pending") as "complete" | "active" | "pending",
  }));

  const stepContent: React.ReactNode[] = [
    <StepSetup key="setup" state={state} onChange={patch} />,
    <StepBlockType key="block-type" state={state} onChange={patch} />,
    <StepPlacement key="placement" state={state} onChange={patch} />,
    <StepVariantContent key="content" state={state} onChange={patch} />,
    <StepQA key="qa" qa={qa} onChange={patchQa} />,
    <StepReview key="review" state={state} qa={qa} availableBlocks={availableBlocks} />,
  ];

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: "#4f46e50a" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#4f46e515" }}
          >
            <span className="text-base" style={{ color: INDIGO }}>▣</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Checkout Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test trust badges, guarantees, social proof, and custom content inside Shopify checkout.
          </p>
        </div>

        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={wizardSteps}
            currentStep={step}
            accentHex={INDIGO}
            onStepClick={(i) => { if (i < step) setStep(i as StepIndex); }}
          />
        </div>

        <div className="p-3 border-t border-neutral-50">
          <div className="px-2 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[9px] text-indigo-700 font-medium leading-relaxed">
              Requires Shopify Checkout UI Extension to be installed and active.
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
            style={{ color: INDIGO }}
          >
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Two-column content area */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Left — step form */}
            <div className="flex-1 min-w-0 space-y-5">
              {stepContent[step]}

              {error && (
                <InlineAlert variant="danger" title="Error">{error}</InlineAlert>
              )}
            </div>

            {/* Right — checkout preview */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <CheckoutPreviewPanel
                step={step}
                blockType={state.blockType}
                placement={state.placement}
                variantContents={state.variants}
                qaItems={qa}
              />
            </aside>
          </div>
        </div>

        {/* Sticky actions */}
        <StickyFormActions
          step={step}
          totalSteps={TOTAL_STEPS}
          onBack={() => (step === 0 ? router.back() : setStep(step - 1))}
          onNext={step < TOTAL_STEPS - 1 ? () => setStep(step + 1) : handleSubmit}
          canContinue={step < TOTAL_STEPS - 1 ? canAdvance() : !hasBlockers}
          isLastStep={step === TOTAL_STEPS - 1}
          isSubmitting={saving}
          submitLabel="Create Test"
          continueLabel={CONTINUE_LABELS[step]}
          accentHex={ACCENT}
          blockingIssue={step < TOTAL_STEPS - 1 ? blockingIssue() : hasBlockers ? "Fix blocking issues above" : undefined}
        />
      </div>
    </div>
  );
}
