"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ArrowLeft, Layers } from "lucide-react";
import { WizardLayout } from "@/components/layout/WizardLayout";
import { type WizardStep } from "@/components/experiments/WizardStepNav";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutBlockType =
  | "TRUST_BADGES"
  | "SOCIAL_PROOF"
  | "GUARANTEE"
  | "SHIPPING_MESSAGE"
  | "PAYMENT_ICONS"
  | "PRODUCT_UPSELL"
  | "CUSTOM_CONTENT"
  | "IMAGE_WITH_TEXT"
  | "URGENCY_MESSAGE"
  | "SECURITY_MESSAGE"
  | "FREE_SHIPPING_PROGRESS";

type Position =
  | "AFTER_CONTACT"
  | "AFTER_SHIPPING"
  | "BEFORE_PAYMENT"
  | "AFTER_PAYMENT";

interface WizardState {
  name: string;
  type: CheckoutBlockType | "";
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  position: Position;
  targetingRules: {
    deviceType?: string;
    countries?: string;
  };
}

const STEPS = ["Type", "Content", "Targeting", "Review"] as const;

const STEP_TITLES = [
  "Choose a block type",
  "Configure the content",
  "Set targeting rules",
  "Review & create",
];

const STEP_DESCS = [
  "Select the type of content block to add to your checkout flow.",
  "Fill in the content that will appear in this block.",
  "Choose the checkout position and optional audience filters.",
  "Review your settings and create the block as a Draft.",
];

// ---------------------------------------------------------------------------
// Block type catalog
// ---------------------------------------------------------------------------

const BLOCK_TYPES: Array<{
  value: CheckoutBlockType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "TRUST_BADGES",
    label: "Trust Badges",
    description: "Show security and trust signals like secure checkout, free returns",
    icon: "🔒",
  },
  {
    value: "SOCIAL_PROOF",
    label: "Social Proof",
    description: "Display review counts, customer testimonials, or purchase activity",
    icon: "⭐",
  },
  {
    value: "GUARANTEE",
    label: "Guarantee",
    description: "Money-back guarantee or satisfaction promise banner",
    icon: "✅",
  },
  {
    value: "SHIPPING_MESSAGE",
    label: "Shipping Message",
    description: "Inform buyers about shipping speed, free shipping, or delivery dates",
    icon: "📦",
  },
  {
    value: "PAYMENT_ICONS",
    label: "Payment Icons",
    description: "Show accepted payment methods to reduce checkout anxiety",
    icon: "💳",
  },
  {
    value: "PRODUCT_UPSELL",
    label: "Product Upsell",
    description: "Offer an add-on product that buyers can add in one click",
    icon: "🛒",
  },
  {
    value: "CUSTOM_CONTENT",
    label: "Custom Content",
    description: "Freeform heading, body text, and optional CTA button",
    icon: "📝",
  },
  {
    value: "IMAGE_WITH_TEXT",
    label: "Image with Text",
    description: "Side-by-side image and text, great for brand messaging",
    icon: "🖼",
  },
  {
    value: "URGENCY_MESSAGE",
    label: "Urgency Message",
    description: "Scarcity or time-limited offer banner to reduce cart abandonment",
    icon: "⏰",
  },
  {
    value: "SECURITY_MESSAGE",
    label: "Security Message",
    description: "SSL, encryption, and data privacy reassurance block",
    icon: "🛡",
  },
  {
    value: "FREE_SHIPPING_PROGRESS",
    label: "Free Shipping Progress",
    description: "Progress bar showing how close the buyer is to free shipping",
    icon: "📶",
  },
];

const POSITION_OPTIONS: Array<{ value: Position; label: string; description: string }> = [
  {
    value: "AFTER_CONTACT",
    label: "After Contact",
    description: "Displayed after the contact information section",
  },
  {
    value: "AFTER_SHIPPING",
    label: "After Shipping",
    description: "Displayed after the shipping method selection",
  },
  {
    value: "BEFORE_PAYMENT",
    label: "Before Payment",
    description: "Displayed just above the payment form",
  },
  {
    value: "AFTER_PAYMENT",
    label: "After Payment",
    description: "Displayed after the payment section",
  },
];

// ---------------------------------------------------------------------------
// Shared Field wrapper
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Type selector
// ---------------------------------------------------------------------------

function StepType({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Block name">
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Trust Badges — Control"
          className="input-base"
        />
      </Field>

      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Block type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value, content: {} })}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                state.type === t.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <span className="text-2xl leading-none mt-0.5">{t.icon}</span>
              <div>
                <p
                  className={`text-sm font-medium ${
                    state.type === t.value ? "text-brand-700" : "text-neutral-900"
                  }`}
                >
                  {t.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Content editor (adapts to block type)
// ---------------------------------------------------------------------------

function StepContent({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const c = state.content;

  function setContent(key: string, value: unknown) {
    onChange({ content: { ...c, [key]: value } });
  }

  switch (state.type) {
    case "TRUST_BADGES": {
      type Badge  = { id: string; iconSource: string; line1: string; line2: string; accessibilityLabel: string };
      type Review = { id: string; quote: string; name: string; rating: number };

      const DEFAULT_BADGES: Badge[] = [
        { id: "guarantee",      iconSource: "", line1: "30-Day Money",  line2: "Back Guarantee",  accessibilityLabel: "30-Day Money Back Guarantee" },
        { id: "shipping",       iconSource: "", line1: "Fast",          line2: "Shipping",         accessibilityLabel: "Fast Shipping" },
        { id: "secure-checkout",iconSource: "", line1: "Safe & Secure", line2: "Checkout",         accessibilityLabel: "Safe and Secure Checkout" },
      ];
      const DEFAULT_REVIEWS: Review[] = [
        { id: "r1", quote: "", name: "", rating: 5 },
      ];

      const badges  = (c["badges"]  as Badge[]  | undefined) ?? DEFAULT_BADGES;
      const reviews = (c["reviews"] as Review[] | undefined) ?? DEFAULT_REVIEWS;

      function setBadgeField(i: number, field: keyof Badge, val: string) {
        const next = badges.map((b, idx) => idx === i ? { ...b, [field]: val } : b);
        setContent("badges", next);
      }
      function addBadge()          { setContent("badges",  [...badges,  { id: `badge-${Date.now()}`,  iconSource: "", line1: "", line2: "", accessibilityLabel: "" }]); }
      function removeBadge(i: number) { setContent("badges",  badges.filter((_, idx) => idx !== i)); }

      function setReviewField(i: number, field: keyof Review, val: string | number) {
        const next = reviews.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
        setContent("reviews", next);
      }
      function addReview()          { setContent("reviews", [...reviews, { id: `review-${Date.now()}`, quote: "", name: "", rating: 5 }]); }
      function removeReview(i: number) { setContent("reviews", reviews.filter((_, idx) => idx !== i)); }

      return (
        <div className="space-y-6">
          {/* Badges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-neutral-800">Trust badges</p>
              <button type="button" onClick={addBadge} className="text-xs text-brand-600 hover:underline">+ Add badge</button>
            </div>
            <div className="space-y-3">
              {badges.map((badge, i) => (
                <div key={badge.id} className="rounded-lg border border-neutral-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-neutral-500">Badge {i + 1}</p>
                    <button type="button" onClick={() => removeBadge(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Line 1">
                      <input type="text" value={badge.line1} onChange={(e) => setBadgeField(i, "line1", e.target.value)} className="input-base" placeholder="30-Day Money" />
                    </Field>
                    <Field label="Line 2">
                      <input type="text" value={badge.line2} onChange={(e) => setBadgeField(i, "line2", e.target.value)} className="input-base" placeholder="Back Guarantee" />
                    </Field>
                  </div>
                  <Field label="Icon URL (optional)">
                    <input type="text" value={badge.iconSource} onChange={(e) => setBadgeField(i, "iconSource", e.target.value)} className="input-base" placeholder="https://cdn.shopify.com/…/icon.svg" />
                  </Field>
                  <Field label="Accessibility label">
                    <input type="text" value={badge.accessibilityLabel} onChange={(e) => setBadgeField(i, "accessibilityLabel", e.target.value)} className="input-base" placeholder="30-Day Money Back Guarantee" />
                  </Field>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-neutral-800">Customer reviews</p>
              <button type="button" onClick={addReview} className="text-xs text-brand-600 hover:underline">+ Add review</button>
            </div>
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <div key={review.id} className="rounded-lg border border-neutral-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-neutral-500">Review {i + 1}</p>
                    <button type="button" onClick={() => removeReview(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                  <Field label="Quote">
                    <textarea rows={2} value={review.quote} onChange={(e) => setReviewField(i, "quote", e.target.value)} className="input-base resize-none" placeholder="Great product, super fast shipping!" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Customer name">
                      <input type="text" value={review.name} onChange={(e) => setReviewField(i, "name", e.target.value)} className="input-base" placeholder="- Jane D." />
                    </Field>
                    <Field label="Rating (1–5)">
                      <input type="number" min={1} max={5} value={review.rating} onChange={(e) => setReviewField(i, "rating", Math.min(5, Math.max(1, parseInt(e.target.value) || 5)))} className="input-base" />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "SOCIAL_PROOF":
      return (
        <div className="space-y-4">
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Trusted by 10,000+ customers"
            />
          </Field>
          <Field label="Body text">
            <textarea
              rows={3}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Join thousands of happy customers who love our products."
            />
          </Field>
        </div>
      );

    case "GUARANTEE":
      return (
        <div className="space-y-4">
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="30-Day Money-Back Guarantee"
            />
          </Field>
          <Field label="Guarantee text">
            <textarea
              rows={3}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Not satisfied? We'll give you a full refund, no questions asked."
            />
          </Field>
        </div>
      );

    case "SHIPPING_MESSAGE":
      return (
        <div className="space-y-4">
          <Field label="Shipping message">
            <textarea
              rows={3}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Free standard shipping on all orders over $50."
            />
          </Field>
        </div>
      );

    case "PAYMENT_ICONS":
      return (
        <div className="space-y-4">
          <Field label="Heading (optional)">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Secure payment methods"
            />
          </Field>
          <Field label="Subtext (optional)">
            <input
              type="text"
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base"
              placeholder="We accept Visa, Mastercard, PayPal, and more."
            />
          </Field>
        </div>
      );

    case "PRODUCT_UPSELL":
      return (
        <div className="space-y-4">
          <Field label="Shopify variant GID (required)">
            <input
              type="text"
              value={(c["variantId"] as string) ?? ""}
              onChange={(e) => setContent("variantId", e.target.value)}
              className="input-base"
              placeholder="gid://shopify/ProductVariant/123456789"
            />
          </Field>
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Complete your order with this add-on"
            />
          </Field>
          <Field label="Body text (optional)">
            <textarea
              rows={2}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Customers who bought this also love…"
            />
          </Field>
          <Field label="Button text">
            <input
              type="text"
              value={(c["buttonText"] as string) ?? ""}
              onChange={(e) => setContent("buttonText", e.target.value)}
              className="input-base"
              placeholder="Add to order"
            />
          </Field>
        </div>
      );

    case "CUSTOM_CONTENT":
      return (
        <div className="space-y-4">
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Custom heading"
            />
          </Field>
          <Field label="Body text">
            <textarea
              rows={3}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Custom body content."
            />
          </Field>
          <Field label="Button text (optional)">
            <input
              type="text"
              value={(c["buttonText"] as string) ?? ""}
              onChange={(e) => setContent("buttonText", e.target.value)}
              className="input-base"
              placeholder="Click here"
            />
          </Field>
          <Field label="Button URL (optional)">
            <input
              type="url"
              value={(c["buttonUrl"] as string) ?? ""}
              onChange={(e) => setContent("buttonUrl", e.target.value)}
              className="input-base"
              placeholder="https://example.com/page"
            />
          </Field>
        </div>
      );

    case "IMAGE_WITH_TEXT":
      return (
        <div className="space-y-4">
          <Field label="Image URL">
            <input
              type="url"
              value={(c["imageUrl"] as string) ?? ""}
              onChange={(e) => setContent("imageUrl", e.target.value)}
              className="input-base"
              placeholder="https://cdn.example.com/image.jpg"
            />
          </Field>
          <Field label="Image alt text">
            <input
              type="text"
              value={(c["imageAlt"] as string) ?? ""}
              onChange={(e) => setContent("imageAlt", e.target.value)}
              className="input-base"
              placeholder="Descriptive alt text for accessibility"
            />
          </Field>
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Heading text"
            />
          </Field>
          <Field label="Body text">
            <textarea
              rows={2}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="Supporting body text."
            />
          </Field>
        </div>
      );

    case "URGENCY_MESSAGE":
      return (
        <div className="space-y-4">
          <Field label="Urgency text">
            <textarea
              rows={2}
              value={(c["urgencyText"] as string) ?? ""}
              onChange={(e) => setContent("urgencyText", e.target.value)}
              className="input-base resize-none"
              placeholder="Only 3 left in stock — order soon!"
            />
          </Field>
        </div>
      );

    case "SECURITY_MESSAGE":
      return (
        <div className="space-y-4">
          <Field label="Heading">
            <input
              type="text"
              value={(c["heading"] as string) ?? ""}
              onChange={(e) => setContent("heading", e.target.value)}
              className="input-base"
              placeholder="Your data is protected"
            />
          </Field>
          <Field label="Security message">
            <textarea
              rows={3}
              value={(c["body"] as string) ?? ""}
              onChange={(e) => setContent("body", e.target.value)}
              className="input-base resize-none"
              placeholder="All transactions are encrypted with 256-bit SSL."
            />
          </Field>
        </div>
      );

    case "FREE_SHIPPING_PROGRESS":
      return (
        <div className="space-y-4">
          <Field label="Free shipping threshold ($)">
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={(c["threshold"] as number) ?? ""}
              onChange={(e) => setContent("threshold", parseFloat(e.target.value))}
              className="input-base"
              placeholder="75.00"
            />
          </Field>
          <Field label="Progress message (use {remaining} placeholder)">
            <input
              type="text"
              value={(c["message"] as string) ?? ""}
              onChange={(e) => setContent("message", e.target.value)}
              className="input-base"
              placeholder="Add {remaining} more for free shipping!"
            />
          </Field>
          <Field label="Success message (when threshold is reached)">
            <input
              type="text"
              value={(c["successMessage"] as string) ?? ""}
              onChange={(e) => setContent("successMessage", e.target.value)}
              className="input-base"
              placeholder="You've unlocked free shipping!"
            />
          </Field>
        </div>
      );

    default:
      return (
        <p className="text-sm text-neutral-500">Select a block type in step 1 first.</p>
      );
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Targeting (position + device/country)
// ---------------------------------------------------------------------------

function StepTargeting({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  function setTargeting(key: keyof WizardState["targetingRules"], value: string) {
    onChange({ targetingRules: { ...state.targetingRules, [key]: value || undefined } });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Checkout position</p>
        <div className="space-y-2">
          {POSITION_OPTIONS.map((pos) => (
            <label
              key={pos.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                state.position === pos.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="position"
                value={pos.value}
                checked={state.position === pos.value}
                onChange={() => onChange({ position: pos.value })}
                className="mt-0.5 text-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900">{pos.label}</p>
                <p className="text-xs text-neutral-500">{pos.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-neutral-700">Targeting rules (optional)</p>

        <Field label="Device type">
          <select
            value={state.targetingRules.deviceType ?? ""}
            onChange={(e) => setTargeting("deviceType", e.target.value)}
            className="input-base"
          >
            <option value="">All devices</option>
            <option value="mobile">Mobile only</option>
            <option value="desktop">Desktop only</option>
            <option value="tablet">Tablet only</option>
          </select>
        </Field>

        <Field label="Countries (comma-separated ISO codes, e.g. US,CA,GB)">
          <input
            type="text"
            value={state.targetingRules.countries ?? ""}
            onChange={(e) => setTargeting("countries", e.target.value)}
            className="input-base"
            placeholder="Leave blank to target all countries"
          />
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

function StepReview({ state }: { state: WizardState }) {
  const blockType = BLOCK_TYPES.find((t) => t.value === state.type);
  const position = POSITION_OPTIONS.find((p) => p.value === state.position);

  return (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <ReviewRow label="Name" value={state.name || "(not set)"} />
        <ReviewRow label="Type" value={blockType?.label ?? state.type} />
        <ReviewRow label="Position" value={position?.label ?? state.position} />
        <ReviewRow
          label="Device"
          value={state.targetingRules.deviceType ?? "All devices"}
        />
        <ReviewRow
          label="Countries"
          value={state.targetingRules.countries || "All countries"}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">
          Content preview
        </p>
        <pre className="text-xs bg-neutral-900 text-green-400 rounded-xl p-3 overflow-auto">
          {JSON.stringify(state.content, null, 2)}
        </pre>
      </div>

      <p className="text-xs text-neutral-500">
        The block will be saved as a <strong>Draft</strong>. Activate it from the Checkout
        Blocks page when ready.
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export function CheckoutBlockWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: "",
    type: "",
    content: {},
    styles: {},
    position: "AFTER_CONTACT",
    targetingRules: {},
  });

  function patch(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0 && state.type !== "";
    return true;
  }

  // Build the targetingRules array from the simplified form state
  function buildTargetingRules() {
    const rules: Array<{
      operator: "AND";
      conditions: Array<{
        type: string;
        operator: "eq" | "in";
        value: string | string[];
      }>;
    }> = [];

    const conditions: Array<{
      type: string;
      operator: "eq" | "in";
      value: string | string[];
    }> = [];

    if (state.targetingRules.deviceType) {
      conditions.push({
        type: "device_type",
        operator: "eq",
        value: state.targetingRules.deviceType,
      });
    }

    if (state.targetingRules.countries) {
      const countryList = state.targetingRules.countries
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (countryList.length > 0) {
        conditions.push({
          type: "country",
          operator: "in",
          value: countryList,
        });
      }
    }

    if (conditions.length > 0) {
      rules.push({ operator: "AND", conditions });
    }

    return rules;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          type: state.type,
          content: state.content,
          styles: state.styles,
          position: state.position,
          targetingRules: buildTargetingRules(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown };
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to create checkout block"
        );
      }

      router.push("/checkout-blocks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save checkout block");
      setSaving(false);
    }
  }

  const stepContent = [
    <StepType key="type" state={state} onChange={patch} />,
    <StepContent key="content" state={state} onChange={patch} />,
    <StepTargeting key="targeting" state={state} onChange={patch} />,
    <StepReview key="review" state={state} />,
  ];

  const wizardSteps: WizardStep[] = STEPS.map((label, i) => ({
    label,
    status: i < step ? "complete" : i === step ? "active" : "pending",
  }));

  return (
    <WizardLayout
      title="Checkout Block"
      subtitle="Add trust elements and content to your checkout"
      icon={<Layers className="w-4 h-4" />}
      accentHex="#6366f1"
      steps={wizardSteps}
      currentStep={step}
      onStepClick={(i) => { if (i < step) setStep(i); }}
      onCancel={() => router.back()}
      stickyActions={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => step === 0 ? router.back() : setStep(step - 1)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            {step === 0 ? "Cancel" : <><ArrowLeft className="w-3.5 h-3.5" /> Back</>}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
              style={{ background: "#4f46e5" }}
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Create Block"}
            </button>
          )}
        </div>
      }
    >
      {/* Step header — sticky */}
      <div className="sticky top-0 z-10 px-8 pt-6 pb-4 border-b border-neutral-100 bg-white">
        <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
        <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
      </div>

      {/* Step content */}
      <div className="px-8 py-6 space-y-5 max-w-xl">
        {stepContent[step]}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </WizardLayout>
  );
}
