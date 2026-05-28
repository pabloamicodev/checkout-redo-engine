"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Check, ChevronRight, ArrowLeft, Layers, Plus, X } from "lucide-react";
import { WizardLayout } from "@/components/layout/WizardLayout";
import { type WizardStep } from "@/components/experiments/WizardStepNav";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutBlockType =
  | "TRUST_BADGES"
  | "TRUST_BADGES_WITH_REVIEWS"
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

const ACCENT = "#6366f1";
const ACCENT_GRADIENT = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";

// ---------------------------------------------------------------------------
// Block type catalog
// ---------------------------------------------------------------------------

const BLOCK_TYPES: Array<{
  value: CheckoutBlockType;
  label: string;
  description: string;
  icon: string;
}> = [
  { value: "TRUST_BADGES",              label: "Trust Badges",              description: "Security and trust signals like secure checkout, free returns", icon: "🔒" },
  { value: "TRUST_BADGES_WITH_REVIEWS", label: "Trust Badges + Reviews",     description: "3 trust badges combined with a horizontal customer reviews carousel", icon: "🏅" },
  { value: "SOCIAL_PROOF",             label: "Social Proof",               description: "Review counts, customer testimonials, or purchase activity",    icon: "⭐" },
  { value: "GUARANTEE",            label: "Guarantee",              description: "Money-back guarantee or satisfaction promise banner",            icon: "✅" },
  { value: "SHIPPING_MESSAGE",     label: "Shipping Message",       description: "Inform buyers about shipping speed, free shipping, or delivery", icon: "📦" },
  { value: "PAYMENT_ICONS",        label: "Payment Icons",          description: "Show accepted payment methods to reduce checkout anxiety",       icon: "💳" },
  { value: "PRODUCT_UPSELL",       label: "Product Upsell",         description: "Offer an add-on product that buyers can add in one click",       icon: "🛒" },
  { value: "CUSTOM_CONTENT",       label: "Custom Content",         description: "Freeform heading, body text, and optional CTA button",           icon: "📝" },
  { value: "IMAGE_WITH_TEXT",      label: "Image with Text",        description: "Side-by-side image and text, great for brand messaging",         icon: "🖼" },
  { value: "URGENCY_MESSAGE",      label: "Urgency Message",        description: "Scarcity or time-limited offer banner to reduce abandonment",    icon: "⏰" },
  { value: "SECURITY_MESSAGE",     label: "Security Message",       description: "SSL, encryption, and data privacy reassurance block",            icon: "🛡" },
  { value: "FREE_SHIPPING_PROGRESS", label: "Free Shipping Progress", description: "Progress bar showing how close the buyer is to free shipping", icon: "📶" },
];

const POSITION_OPTIONS: Array<{ value: Position; label: string; description: string }> = [
  { value: "AFTER_CONTACT",  label: "After Contact",  description: "Displayed after the contact information section" },
  { value: "AFTER_SHIPPING", label: "After Shipping", description: "Displayed after the shipping method selection"   },
  { value: "BEFORE_PAYMENT", label: "Before Payment", description: "Displayed just above the payment form"           },
  { value: "AFTER_PAYMENT",  label: "After Payment",  description: "Displayed after the payment section"             },
];

// ---------------------------------------------------------------------------
// Visual content preview (replaces raw JSON)
// ---------------------------------------------------------------------------

function BlockContentPreview({ state }: { state: WizardState }) {
  const c = state.content;
  const blockType = BLOCK_TYPES.find((t) => t.value === state.type);

  if (!state.type) {
    return (
      <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-neutral-200">
        <p className="text-xs text-neutral-400">No block type selected</p>
      </div>
    );
  }

  // Shared wrapper for all previews
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div
        className="px-3 py-1.5 flex items-center gap-1.5 border-b border-neutral-100"
        style={{ background: `${ACCENT}08` }}
      >
        <span className="text-sm">{blockType?.icon}</span>
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
          {blockType?.label} — Preview
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  switch (state.type) {
    case "TRUST_BADGES": {
      type Badge  = { id: string; line1: string; line2: string; iconSource: string };
      type Review = { id: string; quote: string; name: string; rating: number };
      const badges  = (c["badges"]  as Badge[]  | undefined) ?? [];
      const reviews = (c["reviews"] as Review[] | undefined) ?? [];
      return (
        <Wrapper>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {badges.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50"
                >
                  {b.iconSource ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.iconSource} alt="" className="w-4 h-4 object-contain" />
                  ) : (
                    <span className="text-xs">🔒</span>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-800 leading-tight">{b.line1 || "—"}</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">{b.line2}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              {reviews.map((r, i) => (
                <div key={i} className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
                  <div className="flex items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <span key={s} className={`text-xs ${s < r.rating ? "text-amber-400" : "text-neutral-200"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-700 italic leading-snug">
                    {r.quote || <span className="text-neutral-300">No quote entered</span>}
                  </p>
                  {r.name && <p className="text-[10px] text-neutral-400 mt-1">{r.name}</p>}
                </div>
              ))}
            </div>
          )}
          {badges.length === 0 && reviews.length === 0 && (
            <p className="text-xs text-neutral-400 italic">No content configured yet.</p>
          )}
        </Wrapper>
      );
    }

    case "SOCIAL_PROOF":
      return (
        <Wrapper>
          <p className="text-sm font-semibold text-neutral-900 mb-1">
            {(c["heading"] as string) || <span className="text-neutral-300 font-normal italic">Heading…</span>}
          </p>
          {(c["body"] as string) && (
            <p className="text-xs text-neutral-500 leading-relaxed">{c["body"] as string}</p>
          )}
        </Wrapper>
      );

    case "GUARANTEE":
      return (
        <Wrapper>
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">✅</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {(c["heading"] as string) || <span className="text-neutral-300 font-normal italic">Guarantee heading…</span>}
              </p>
              {(c["body"] as string) && (
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{c["body"] as string}</p>
              )}
            </div>
          </div>
        </Wrapper>
      );

    case "SHIPPING_MESSAGE":
      return (
        <Wrapper>
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">📦</span>
            <p className="text-xs text-neutral-700 leading-relaxed">
              {(c["body"] as string) || <span className="text-neutral-300 italic">Shipping message…</span>}
            </p>
          </div>
        </Wrapper>
      );

    case "PAYMENT_ICONS": {
      const MOCK_ICONS = ["VISA", "MC", "AMEX", "PayPal", "Apple Pay", "Shop Pay"];
      return (
        <Wrapper>
          {(c["heading"] as string) && (
            <p className="text-xs font-medium text-neutral-700 mb-2">{c["heading"] as string}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {MOCK_ICONS.map((icon) => (
              <span
                key={icon}
                className="px-2 py-1 text-[10px] font-semibold rounded border border-neutral-200 bg-neutral-50 text-neutral-600"
              >
                {icon}
              </span>
            ))}
          </div>
          {(c["body"] as string) && (
            <p className="text-[11px] text-neutral-400 mt-2">{c["body"] as string}</p>
          )}
        </Wrapper>
      );
    }

    case "PRODUCT_UPSELL":
      return (
        <Wrapper>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
              <span className="text-xl">🛒</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-900">
                {(c["heading"] as string) || <span className="text-neutral-300 font-normal italic">Upsell heading…</span>}
              </p>
              {(c["body"] as string) && (
                <p className="text-xs text-neutral-500 mt-0.5">{c["body"] as string}</p>
              )}
              <button
                tabIndex={-1}
                className="mt-2 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg"
                style={{ background: ACCENT }}
              >
                {(c["buttonText"] as string) || "Add to order"}
              </button>
            </div>
          </div>
        </Wrapper>
      );

    case "CUSTOM_CONTENT":
      return (
        <Wrapper>
          {(c["heading"] as string) && (
            <p className="text-sm font-semibold text-neutral-900 mb-1">{c["heading"] as string}</p>
          )}
          {(c["body"] as string) && (
            <p className="text-xs text-neutral-600 leading-relaxed">{c["body"] as string}</p>
          )}
          {(c["buttonText"] as string) && (
            <button
              tabIndex={-1}
              className="mt-2 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ background: ACCENT }}
            >
              {c["buttonText"] as string}
            </button>
          )}
          {!c["heading"] && !c["body"] && (
            <p className="text-xs text-neutral-300 italic">No content yet.</p>
          )}
        </Wrapper>
      );

    case "IMAGE_WITH_TEXT":
      return (
        <Wrapper>
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-lg border border-neutral-200 bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
              {(c["imageUrl"] as string) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c["imageUrl"] as string} alt={(c["imageAlt"] as string) ?? ""} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🖼</span>
              )}
            </div>
            <div>
              {(c["heading"] as string) && (
                <p className="text-sm font-semibold text-neutral-900">{c["heading"] as string}</p>
              )}
              {(c["body"] as string) && (
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{c["body"] as string}</p>
              )}
              {!c["heading"] && !c["body"] && (
                <p className="text-xs text-neutral-300 italic mt-2">No text content yet.</p>
              )}
            </div>
          </div>
        </Wrapper>
      );

    case "URGENCY_MESSAGE":
      return (
        <Wrapper>
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}
          >
            <span className="text-base mt-0.5">⏰</span>
            <p className="text-xs font-medium text-orange-700 leading-relaxed">
              {(c["urgencyText"] as string) || <span className="text-orange-300 font-normal italic">Urgency message…</span>}
            </p>
          </div>
        </Wrapper>
      );

    case "SECURITY_MESSAGE":
      return (
        <Wrapper>
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">🛡</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {(c["heading"] as string) || <span className="text-neutral-300 font-normal italic">Security heading…</span>}
              </p>
              {(c["body"] as string) && (
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{c["body"] as string}</p>
              )}
            </div>
          </div>
        </Wrapper>
      );

    case "FREE_SHIPPING_PROGRESS": {
      const threshold = (c["threshold"] as number) ?? 75;
      const mockCart = threshold * 0.6;
      const progress = Math.min((mockCart / threshold) * 100, 100);
      const remaining = Math.max(threshold - mockCart, 0).toFixed(2);
      const msg = ((c["message"] as string) ?? "Add {remaining} more for free shipping!").replace(
        "{remaining}",
        `$${remaining}`
      );
      return (
        <Wrapper>
          <p className="text-xs font-medium text-neutral-700 mb-2">{msg}</p>
          <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: ACCENT_GRADIENT }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-neutral-400">$0</span>
            <span className="text-[10px] text-neutral-400">${threshold} — Free shipping</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 italic">
            * Example using 60% of threshold for preview
          </p>
        </Wrapper>
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Live preview panel (right sidebar)
// ---------------------------------------------------------------------------

function CheckoutBlockPreviewPanel({ state }: { state: WizardState }) {
  const blockType = BLOCK_TYPES.find((t) => t.value === state.type);
  const position = POSITION_OPTIONS.find((p) => p.value === state.position);

  return (
    <div className="space-y-4">
      {/* Simulated checkout context */}
      <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-50" style={{ background: `${ACCENT}08` }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Checkout Position
          </p>
        </div>
        <div className="p-4 space-y-1.5">
          {POSITION_OPTIONS.map((pos) => (
            <div
              key={pos.value}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
                pos.value === state.position
                  ? "font-semibold border"
                  : "text-neutral-400 bg-neutral-50 border border-neutral-100",
              ].join(" ")}
              style={
                pos.value === state.position
                  ? { background: `${ACCENT}10`, borderColor: `${ACCENT}30`, color: ACCENT }
                  : {}
              }
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: pos.value === state.position ? ACCENT : "#e5e7eb" }}
              />
              {pos.label}
              {pos.value === state.position && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide">← here</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live content preview */}
      <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Block Preview
          </p>
        </div>
        <div className="p-4">
          {state.type ? (
            <BlockContentPreview state={state} />
          ) : (
            <p className="text-xs text-neutral-400 italic text-center py-4">
              Select a block type to see a preview
            </p>
          )}
        </div>
      </div>

      {/* Config summary */}
      <div className="rounded-xl border border-neutral-100 bg-white px-4 py-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">
          Configuration
        </p>
        <MiniRow label="Name" value={state.name || <span className="text-neutral-300 italic">—</span>} />
        <MiniRow label="Type" value={blockType ? `${blockType.icon} ${blockType.label}` : <span className="text-neutral-300 italic">—</span>} />
        <MiniRow label="Position" value={position?.label ?? <span className="text-neutral-300 italic">—</span>} />
        <MiniRow label="Device" value={state.targetingRules.deviceType ?? "All devices"} />
        <MiniRow label="Countries" value={state.targetingRules.countries || "All countries"} />
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-neutral-400 shrink-0">{label}</span>
      <span className="text-[10px] font-medium text-neutral-700 text-right truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Type selector
// ---------------------------------------------------------------------------

function StepType({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <FormSection title="Block identity" accent={ACCENT}>
        <FormField label="Block name" required hint="Internal label to identify this block in your list.">
          <input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Trust Badges — Control"
            className="input-base"
            autoFocus
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Block type"
        description="Choose what kind of content this block will display at checkout."
        accent={ACCENT}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value, content: {} })}
              className={[
                "flex items-start gap-3 p-3 rounded-xl border text-left transition-colors",
                state.type === t.value
                  ? "border-indigo-400 bg-indigo-50 shadow-sm"
                  : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
              ].join(" ")}
            >
              <span className="text-2xl leading-none mt-0.5">{t.icon}</span>
              <div>
                <p className={`text-sm font-medium ${state.type === t.value ? "text-indigo-700" : "text-neutral-900"}`}>
                  {t.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Content editor (adapts to block type)
// ---------------------------------------------------------------------------

function StepContent({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const c = state.content;

  function setContent(key: string, value: unknown) {
    onChange({ content: { ...c, [key]: value } });
  }

  switch (state.type) {
    case "TRUST_BADGES": {
      type Badge  = { id: string; iconSource: string; line1: string; line2: string; accessibilityLabel: string };
      type Review = { id: string; quote: string; name: string; rating: number };

      const DEFAULT_BADGES: Badge[] = [
        { id: "guarantee",       iconSource: "", line1: "30-Day Money",  line2: "Back Guarantee", accessibilityLabel: "30-Day Money Back Guarantee" },
        { id: "shipping",        iconSource: "", line1: "Fast",          line2: "Shipping",        accessibilityLabel: "Fast Shipping" },
        { id: "secure-checkout", iconSource: "", line1: "Safe & Secure", line2: "Checkout",        accessibilityLabel: "Safe and Secure Checkout" },
      ];
      const DEFAULT_REVIEWS: Review[] = [{ id: "r1", quote: "", name: "", rating: 5 }];

      const badges  = (c["badges"]  as Badge[]  | undefined) ?? DEFAULT_BADGES;
      const reviews = (c["reviews"] as Review[] | undefined) ?? DEFAULT_REVIEWS;

      function setBadgeField(i: number, field: keyof Badge, val: string) {
        setContent("badges", badges.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
      }
      function addBadge()           { setContent("badges",  [...badges,  { id: `badge-${Date.now()}`,  iconSource: "", line1: "", line2: "", accessibilityLabel: "" }]); }
      function removeBadge(i: number) { setContent("badges",  badges.filter((_, idx) => idx !== i)); }

      function setReviewField(i: number, field: keyof Review, val: string | number) {
        setContent("reviews", reviews.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
      }
      function addReview()           { setContent("reviews", [...reviews, { id: `review-${Date.now()}`, quote: "", name: "", rating: 5 }]); }
      function removeReview(i: number) { setContent("reviews", reviews.filter((_, idx) => idx !== i)); }

      return (
        <div className="space-y-5">
          <FormSection
            title="Trust badges"
            description="Each badge shows an icon and two lines of text."
            accent={ACCENT}
          >
            <div className="space-y-3">
              {badges.map((badge, i) => (
                <div key={badge.id} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500">Badge {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBadge(i)}
                      className="text-neutral-300 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Line 1">
                      <input type="text" value={badge.line1} onChange={(e) => setBadgeField(i, "line1", e.target.value)} className="input-base" placeholder="30-Day Money" />
                    </FormField>
                    <FormField label="Line 2">
                      <input type="text" value={badge.line2} onChange={(e) => setBadgeField(i, "line2", e.target.value)} className="input-base" placeholder="Back Guarantee" />
                    </FormField>
                  </div>
                  <FormField label="Icon URL" hint="Optional. Leave blank to use the default lock icon.">
                    <input type="text" value={badge.iconSource} onChange={(e) => setBadgeField(i, "iconSource", e.target.value)} className="input-base" placeholder="https://cdn.shopify.com/…/icon.svg" />
                  </FormField>
                  <FormField label="Accessibility label" hint="Describe the badge for screen readers.">
                    <input type="text" value={badge.accessibilityLabel} onChange={(e) => setBadgeField(i, "accessibilityLabel", e.target.value)} className="input-base" placeholder="30-Day Money Back Guarantee" />
                  </FormField>
                </div>
              ))}
              <button
                type="button"
                onClick={addBadge}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add badge
              </button>
            </div>
          </FormSection>

          <FormSection
            title="Customer reviews"
            description="Optional testimonials shown below the badges."
            accent={ACCENT}
          >
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <div key={review.id} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500">Review {i + 1}</span>
                    <button type="button" onClick={() => removeReview(i)} className="text-neutral-300 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <FormField label="Quote">
                    <textarea rows={2} value={review.quote} onChange={(e) => setReviewField(i, "quote", e.target.value)} className="input-base resize-none" placeholder="Great product, super fast shipping!" />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Customer name">
                      <input type="text" value={review.name} onChange={(e) => setReviewField(i, "name", e.target.value)} className="input-base" placeholder="Jane D." />
                    </FormField>
                    <FormField label="Rating">
                      <select
                        value={review.rating}
                        onChange={(e) => setReviewField(i, "rating", parseInt(e.target.value))}
                        className="input-base"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} star{n !== 1 ? "s" : ""} {"★".repeat(n)}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addReview}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add review
              </button>
            </div>
          </FormSection>
        </div>
      );
    }

    case "SOCIAL_PROOF":
      return (
        <FormSection title="Social proof content" accent={ACCENT}>
          <div className="space-y-4">
            <FormField label="Heading" hint="Main line shown to visitors.">
              <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Trusted by 10,000+ customers" />
            </FormField>
            <FormField label="Body text" hint="Supporting detail beneath the heading.">
              <textarea rows={3} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Join thousands of happy customers who love our products." />
            </FormField>
          </div>
        </FormSection>
      );

    case "GUARANTEE":
      return (
        <FormSection title="Guarantee content" accent={ACCENT}>
          <div className="space-y-4">
            <FormField label="Heading">
              <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="30-Day Money-Back Guarantee" />
            </FormField>
            <FormField label="Guarantee text">
              <textarea rows={3} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Not satisfied? We'll give you a full refund, no questions asked." />
            </FormField>
          </div>
        </FormSection>
      );

    case "SHIPPING_MESSAGE":
      return (
        <FormSection title="Shipping message" accent={ACCENT}>
          <FormField label="Message text" hint="Shown as a single paragraph at the configured checkout position.">
            <textarea rows={3} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Free standard shipping on all orders over $50." />
          </FormField>
        </FormSection>
      );

    case "PAYMENT_ICONS":
      return (
        <div className="space-y-5">
          <FormSection title="Payment icons content" accent={ACCENT}>
            <div className="space-y-4">
              <FormField label="Heading" hint="Optional. Leave blank for icons only.">
                <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Secure payment methods" />
              </FormField>
              <FormField label="Subtext" hint="Optional description below the icons.">
                <input type="text" value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base" placeholder="We accept Visa, Mastercard, PayPal, and more." />
              </FormField>
            </div>
          </FormSection>
          <InlineAlert variant="info">
            Payment icons (Visa, Mastercard, PayPal, Apple Pay, etc.) are rendered automatically by the Shopify extension — no icons to upload.
          </InlineAlert>
        </div>
      );

    case "PRODUCT_UPSELL":
      return (
        <div className="space-y-5">
          <FormSection title="Product upsell" description="Highlight a specific product variant that buyers can add with one click." accent={ACCENT}>
            <div className="space-y-4">
              <FormField label="Shopify variant GID" required hint="Found in your Shopify admin under Products → Variants.">
                <input type="text" value={(c["variantId"] as string) ?? ""} onChange={(e) => setContent("variantId", e.target.value)} className="input-base" placeholder="gid://shopify/ProductVariant/123456789" />
              </FormField>
              <FormField label="Heading">
                <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Complete your order with this add-on" />
              </FormField>
              <FormField label="Body text" hint="Optional supporting detail.">
                <textarea rows={2} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Customers who bought this also love…" />
              </FormField>
              <FormField label="Button text">
                <input type="text" value={(c["buttonText"] as string) ?? ""} onChange={(e) => setContent("buttonText", e.target.value)} className="input-base" placeholder="Add to order" />
              </FormField>
            </div>
          </FormSection>
        </div>
      );

    case "CUSTOM_CONTENT":
      return (
        <FormSection title="Custom content" accent={ACCENT}>
          <div className="space-y-4">
            <FormField label="Heading">
              <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Custom heading" />
            </FormField>
            <FormField label="Body text">
              <textarea rows={3} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Custom body content." />
            </FormField>
            <FormField label="Button text" hint="Optional. Leave blank to hide the button.">
              <input type="text" value={(c["buttonText"] as string) ?? ""} onChange={(e) => setContent("buttonText", e.target.value)} className="input-base" placeholder="Click here" />
            </FormField>
            <FormField label="Button URL" hint="Required if button text is set.">
              <input type="url" value={(c["buttonUrl"] as string) ?? ""} onChange={(e) => setContent("buttonUrl", e.target.value)} className="input-base" placeholder="https://example.com/page" />
            </FormField>
          </div>
        </FormSection>
      );

    case "IMAGE_WITH_TEXT":
      return (
        <FormSection title="Image with text" description="Image appears alongside the text content." accent={ACCENT}>
          <div className="space-y-4">
            <FormField label="Image URL" required>
              <input type="url" value={(c["imageUrl"] as string) ?? ""} onChange={(e) => setContent("imageUrl", e.target.value)} className="input-base" placeholder="https://cdn.example.com/image.jpg" />
            </FormField>
            <FormField label="Image alt text" hint="Describes the image for screen readers.">
              <input type="text" value={(c["imageAlt"] as string) ?? ""} onChange={(e) => setContent("imageAlt", e.target.value)} className="input-base" placeholder="Descriptive alt text for accessibility" />
            </FormField>
            <FormField label="Heading">
              <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Heading text" />
            </FormField>
            <FormField label="Body text">
              <textarea rows={2} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="Supporting body text." />
            </FormField>
          </div>
        </FormSection>
      );

    case "URGENCY_MESSAGE":
      return (
        <div className="space-y-5">
          <FormSection title="Urgency message" accent={ACCENT}>
            <FormField label="Urgency text" hint="Keep it short and action-oriented.">
              <textarea rows={2} value={(c["urgencyText"] as string) ?? ""} onChange={(e) => setContent("urgencyText", e.target.value)} className="input-base resize-none" placeholder="Only 3 left in stock — order soon!" />
            </FormField>
          </FormSection>
          <InlineAlert variant="warning">
            Use urgency messaging sparingly. Overuse can reduce buyer trust.
          </InlineAlert>
        </div>
      );

    case "SECURITY_MESSAGE":
      return (
        <FormSection title="Security message" description="Reassure buyers about data safety and encryption." accent={ACCENT}>
          <div className="space-y-4">
            <FormField label="Heading">
              <input type="text" value={(c["heading"] as string) ?? ""} onChange={(e) => setContent("heading", e.target.value)} className="input-base" placeholder="Your data is protected" />
            </FormField>
            <FormField label="Security message">
              <textarea rows={3} value={(c["body"] as string) ?? ""} onChange={(e) => setContent("body", e.target.value)} className="input-base resize-none" placeholder="All transactions are encrypted with 256-bit SSL." />
            </FormField>
          </div>
        </FormSection>
      );

    case "FREE_SHIPPING_PROGRESS":
      return (
        <div className="space-y-5">
          <FormSection
            title="Free shipping progress bar"
            description="Shows buyers how close they are to unlocking free shipping."
            accent={ACCENT}
          >
            <div className="space-y-4">
              <FormField label="Free shipping threshold ($)" required hint="Cart total needed to unlock free shipping.">
                <div className="relative w-40">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">$</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={(c["threshold"] as number) ?? ""}
                    onChange={(e) => setContent("threshold", parseFloat(e.target.value))}
                    className="input-base pl-8"
                    placeholder="75.00"
                  />
                </div>
              </FormField>
              <FormField label="Progress message" hint="Use {remaining} as a placeholder for the missing amount.">
                <input type="text" value={(c["message"] as string) ?? ""} onChange={(e) => setContent("message", e.target.value)} className="input-base" placeholder="Add {remaining} more for free shipping!" />
              </FormField>
              <FormField label="Success message" hint="Shown when the buyer has reached the threshold.">
                <input type="text" value={(c["successMessage"] as string) ?? ""} onChange={(e) => setContent("successMessage", e.target.value)} className="input-base" placeholder="You've unlocked free shipping! 🎉" />
              </FormField>
            </div>
          </FormSection>
        </div>
      );

    default:
      return (
        <InlineAlert variant="warning">
          Select a block type in step 1 before configuring content.
        </InlineAlert>
      );
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Targeting
// ---------------------------------------------------------------------------

function StepTargeting({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  function setTargeting(key: keyof WizardState["targetingRules"], value: string) {
    onChange({ targetingRules: { ...state.targetingRules, [key]: value || undefined } });
  }

  return (
    <div className="space-y-5">
      <FormSection
        title="Checkout position"
        description="Where in the checkout flow this block will appear."
        accent={ACCENT}
      >
        <div className="space-y-2">
          {POSITION_OPTIONS.map((pos) => (
            <label
              key={pos.value}
              className={[
                "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                state.position === pos.value
                  ? "border-indigo-300 bg-indigo-50 shadow-sm"
                  : "border-neutral-200 hover:border-indigo-200 hover:bg-indigo-50/40",
              ].join(" ")}
            >
              <input
                type="radio"
                name="position"
                value={pos.value}
                checked={state.position === pos.value}
                onChange={() => onChange({ position: pos.value })}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900">{pos.label}</p>
                <p className="text-xs text-neutral-500">{pos.description}</p>
              </div>
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Audience filters"
        description="Optional. Leave blank to show to all visitors."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Device type">
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
          </FormField>

          <FormField label="Countries" hint="Comma-separated ISO codes, e.g. US,CA,GB. Leave blank for all countries.">
            <input
              type="text"
              value={state.targetingRules.countries ?? ""}
              onChange={(e) => setTargeting("countries", e.target.value)}
              className="input-base"
              placeholder="US,CA,GB"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

function StepReview({ state, error }: { state: WizardState; error: string | null }) {
  const blockType = BLOCK_TYPES.find((t) => t.value === state.type);
  const position  = POSITION_OPTIONS.find((p) => p.value === state.position);

  const readinessChecks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Block name",
      status: state.name.trim() ? "pass" : "block",
      detail: state.name.trim() ? `"${state.name.trim()}"` : "A name is required before creating.",
    },
    {
      id: "type",
      label: "Block type",
      status: state.type ? "pass" : "block",
      detail: state.type ? `${blockType?.icon} ${blockType?.label}` : "Select a block type in step 1.",
    },
    {
      id: "position",
      label: "Checkout position",
      status: "pass",
      detail: position?.label ?? state.position,
    },
    {
      id: "draft",
      label: "Created as DRAFT",
      status: "info",
      detail: "This block will be saved as DRAFT. Activate it from the Checkout Blocks page when ready.",
    },
  ];

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={readinessChecks} accentHex={ACCENT} />

      {/* Visual content preview */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Content preview
        </p>
        <BlockContentPreview state={state} />
      </div>

      {/* Config summary */}
      <div className="bg-white rounded-xl border border-neutral-100 divide-y divide-neutral-100">
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Summary</p>
          <dl className="space-y-2.5">
            <SummaryRow label="Name"     value={state.name || <span className="text-neutral-400 italic">Not set</span>} />
            <SummaryRow label="Type"     value={blockType ? `${blockType.icon} ${blockType.label}` : <span className="text-neutral-400 italic">Not set</span>} />
            <SummaryRow label="Position" value={position?.label ?? state.position} />
            <SummaryRow label="Device"   value={state.targetingRules.deviceType ?? "All devices"} />
            <SummaryRow label="Countries" value={state.targetingRules.countries || "All countries"} />
          </dl>
        </div>
      </div>

      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-neutral-500 shrink-0 w-24">{label}</dt>
      <dd className="text-xs font-medium text-neutral-800 text-right">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export function CheckoutBlockWizard() {
  const router = useRouter();
  const toast = useToast();
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
    setError(null);
  }

  const canAdvanceStep: Record<number, boolean> = {
    0: state.name.trim().length > 0 && state.type !== "",
    1: true,
    2: true,
    3: state.name.trim().length > 0 && state.type !== "",
  };

  const blockingIssue: Record<number, string | undefined> = {
    0: !state.name.trim() ? "Block name is required" : !state.type ? "Select a block type" : undefined,
    1: undefined,
    2: undefined,
    3: !state.name.trim() ? "Block name is required" : !state.type ? "Block type is required" : undefined,
  };

  function buildTargetingRules() {
    const conditions: Array<{ type: string; operator: "eq" | "in"; value: string | string[] }> = [];

    if (state.targetingRules.deviceType) {
      conditions.push({ type: "device_type", operator: "eq", value: state.targetingRules.deviceType });
    }
    if (state.targetingRules.countries) {
      const list = state.targetingRules.countries.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) conditions.push({ type: "country", operator: "in", value: list });
    }

    return conditions.length > 0 ? [{ operator: "AND" as const, conditions }] : [];
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
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create checkout block");
      }

      toast.success(`Checkout block "${state.name}" created — activate it from the blocks page.`);
      router.push("/checkout-blocks");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save checkout block";
      toast.error(msg);
      setError(msg);
      setSaving(false);
    }
  }

  const stepContent = [
    <StepType     key="type"      state={state} onChange={patch} />,
    <StepContent  key="content"   state={state} onChange={patch} />,
    <StepTargeting key="targeting" state={state} onChange={patch} />,
    <StepReview   key="review"    state={state} error={error} />,
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
      accentHex={ACCENT}
      steps={wizardSteps}
      currentStep={step}
      onStepClick={(i) => { if (i < step) setStep(i); }}
      onCancel={() => router.back()}
      previewPanel={<CheckoutBlockPreviewPanel state={state} />}
      previewLabel="Live Preview"
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
              disabled={!canAdvanceStep[step]}
              title={blockingIssue[step]}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: ACCENT_GRADIENT }}
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !canAdvanceStep[3]}
              title={blockingIssue[3]}
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
      <div className="sticky top-0 z-10 px-6 pt-5 pb-4 border-b border-neutral-100 bg-white">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: ACCENT }}>
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
        <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
      </div>

      {/* Step content */}
      <div className="p-6 space-y-5">
        {stepContent[step]}
        {error && step < 3 && <InlineAlert variant="danger">{error}</InlineAlert>}
      </div>
    </WizardLayout>
  );
}
