"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OfferType =
  | "PERCENTAGE_DISCOUNT"
  | "FIXED_AMOUNT_DISCOUNT"
  | "PRODUCT_DISCOUNT"
  | "ORDER_DISCOUNT"
  | "FREE_SHIPPING"
  | "FREE_GIFT"
  | "VOLUME_DISCOUNT"
  | "QUANTITY_BREAK"
  | "BUY_X_GET_Y"
  | "TIERED_PROGRESS_BAR"
  | "CAMPAIGN_LINK_OFFER";

interface WizardState {
  name: string;
  type: OfferType | "";
  discountRules: Record<string, unknown>;
  triggerRules: Record<string, unknown>[];
  displaySettings: Record<string, unknown>;
  functionConfig: Record<string, unknown> | null;
}

const STEPS = ["Type", "Configure", "Trigger", "Display", "Review"] as const;

// ---------------------------------------------------------------------------
// Offer type catalog
// ---------------------------------------------------------------------------

const OFFER_TYPES: Array<{
  value: OfferType;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    value: "PERCENTAGE_DISCOUNT",
    label: "Percentage Discount",
    description: "Discount a percentage off order or product",
    emoji: "%",
  },
  {
    value: "FIXED_AMOUNT_DISCOUNT",
    label: "Fixed Amount Discount",
    description: "Knock a fixed $ amount off the order",
    emoji: "$",
  },
  {
    value: "PRODUCT_DISCOUNT",
    label: "Product Discount",
    description: "Percentage off specific products or collections",
    emoji: "🏷",
  },
  {
    value: "ORDER_DISCOUNT",
    label: "Order Discount",
    description: "Fixed amount off the entire order total",
    emoji: "🛒",
  },
  {
    value: "FREE_SHIPPING",
    label: "Free Shipping",
    description: "Remove shipping cost, optionally above a threshold",
    emoji: "📦",
  },
  {
    value: "FREE_GIFT",
    label: "Free Gift",
    description: "Auto-add a free product above a spend threshold",
    emoji: "🎁",
  },
  {
    value: "VOLUME_DISCOUNT",
    label: "Volume Discount",
    description: "Tiered discounts based on total quantity ordered",
    emoji: "📊",
  },
  {
    value: "QUANTITY_BREAK",
    label: "Quantity Break",
    description: "Price breaks per-item when buying in bulk",
    emoji: "🔢",
  },
  {
    value: "BUY_X_GET_Y",
    label: "Buy X Get Y",
    description: "Buy N items, get M items free or discounted",
    emoji: "2️⃣",
  },
  {
    value: "TIERED_PROGRESS_BAR",
    label: "Tiered Progress Bar",
    description: "Spend thresholds with progressive rewards shown in a bar",
    emoji: "📶",
  },
  {
    value: "CAMPAIGN_LINK_OFFER",
    label: "Campaign Link Offer",
    description: "Discount activated via a URL parameter",
    emoji: "🔗",
  },
];

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
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Offer name
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Summer 20% Off"
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Discount type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OFFER_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value })}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                state.type === t.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <span className="text-2xl leading-none mt-0.5">{t.emoji}</span>
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
// Step 2 — Configure discount rules
// ---------------------------------------------------------------------------

function StepConfigure({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const rules = state.discountRules;

  function setRule(key: string, value: unknown) {
    onChange({ discountRules: { ...rules, [key]: value } });
  }

  function addTier() {
    const tiers = (rules["tiers"] as unknown[]) ?? [];
    onChange({
      discountRules: {
        ...rules,
        tiers: [...tiers, { minQuantity: 1, discountPercent: 0 }],
      },
    });
  }

  function updateTier(index: number, key: string, value: unknown) {
    const tiers = [...((rules["tiers"] as unknown[]) ?? [])] as Record<string, unknown>[];
    tiers[index] = { ...tiers[index], [key]: value };
    onChange({ discountRules: { ...rules, tiers } });
  }

  function removeTier(index: number) {
    const tiers = [...((rules["tiers"] as unknown[]) ?? [])] as Record<string, unknown>[];
    tiers.splice(index, 1);
    onChange({ discountRules: { ...rules, tiers } });
  }

  switch (state.type) {
    case "PERCENTAGE_DISCOUNT":
    case "PRODUCT_DISCOUNT":
      return (
        <div className="space-y-4">
          <Field label="Discount percentage (0–100)">
            <input
              type="number"
              min={0}
              max={100}
              value={(rules["percentage"] as number) ?? ""}
              onChange={(e) => setRule("percentage", parseFloat(e.target.value))}
              className="input-base"
              placeholder="20"
            />
          </Field>
        </div>
      );

    case "FIXED_AMOUNT_DISCOUNT":
    case "ORDER_DISCOUNT":
      return (
        <div className="space-y-4">
          <Field label="Discount amount">
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={(rules["amount"] as number) ?? ""}
              onChange={(e) => setRule("amount", parseFloat(e.target.value))}
              className="input-base"
              placeholder="10.00"
            />
          </Field>
        </div>
      );

    case "FREE_SHIPPING":
      return (
        <div className="space-y-4">
          <Field label="Minimum order threshold (optional)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={(rules["threshold"] as number) ?? ""}
              onChange={(e) =>
                setRule(
                  "threshold",
                  e.target.value === "" ? undefined : parseFloat(e.target.value)
                )
              }
              className="input-base"
              placeholder="Leave blank for free for all"
            />
          </Field>
        </div>
      );

    case "FREE_GIFT":
      return (
        <div className="space-y-4">
          <Field label="Spend threshold (required)">
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={(rules["threshold"] as number) ?? ""}
              onChange={(e) => setRule("threshold", parseFloat(e.target.value))}
              className="input-base"
              placeholder="50.00"
            />
          </Field>
          <Field label="Gift product variant ID (Shopify GID)">
            <input
              type="text"
              value={(rules["giftVariantId"] as string) ?? ""}
              onChange={(e) => setRule("giftVariantId", e.target.value)}
              className="input-base"
              placeholder="gid://shopify/ProductVariant/123"
            />
          </Field>
        </div>
      );

    case "BUY_X_GET_Y":
      return (
        <div className="space-y-4">
          <Field label="Buy quantity (X)">
            <input
              type="number"
              min={1}
              value={(rules["buyQuantity"] as number) ?? ""}
              onChange={(e) => setRule("buyQuantity", parseInt(e.target.value, 10))}
              className="input-base"
              placeholder="2"
            />
          </Field>
          <Field label="Get quantity (Y)">
            <input
              type="number"
              min={1}
              value={(rules["getQuantity"] as number) ?? ""}
              onChange={(e) => setRule("getQuantity", parseInt(e.target.value, 10))}
              className="input-base"
              placeholder="1"
            />
          </Field>
          <Field label="Get discount (%) — 100 = free">
            <input
              type="number"
              min={0}
              max={100}
              value={(rules["getDiscountPercent"] as number) ?? 100}
              onChange={(e) =>
                setRule("getDiscountPercent", parseFloat(e.target.value))
              }
              className="input-base"
            />
          </Field>
        </div>
      );

    case "VOLUME_DISCOUNT":
    case "QUANTITY_BREAK":
    case "TIERED_PROGRESS_BAR": {
      const tiers = ((rules["tiers"] as unknown[]) ?? []) as Record<string, unknown>[];
      const isSpendTier = state.type === "TIERED_PROGRESS_BAR";
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-700">Tiers</p>
              <button
                type="button"
                onClick={addTier}
                className="text-xs text-brand-600 hover:underline"
              >
                + Add tier
              </button>
            </div>
            {tiers.length === 0 && (
              <p className="text-xs text-neutral-400">No tiers yet — add at least one.</p>
            )}
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={(tier[isSpendTier ? "minSpend" : "minQuantity"] as number) ?? ""}
                    onChange={(e) =>
                      updateTier(
                        i,
                        isSpendTier ? "minSpend" : "minQuantity",
                        parseFloat(e.target.value)
                      )
                    }
                    className="input-base w-32"
                    placeholder={isSpendTier ? "Min spend" : "Min qty"}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={(tier["discountPercent"] as number) ?? ""}
                    onChange={(e) =>
                      updateTier(i, "discountPercent", parseFloat(e.target.value))
                    }
                    className="input-base w-28"
                    placeholder="Discount %"
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="text-xs text-danger-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "CAMPAIGN_LINK_OFFER":
      return (
        <div className="space-y-4">
          <Field label="URL parameter key">
            <input
              type="text"
              value={(rules["paramKey"] as string) ?? ""}
              onChange={(e) => setRule("paramKey", e.target.value)}
              className="input-base"
              placeholder="promo"
            />
          </Field>
          <Field label="URL parameter value">
            <input
              type="text"
              value={(rules["paramValue"] as string) ?? ""}
              onChange={(e) => setRule("paramValue", e.target.value)}
              className="input-base"
              placeholder="summer2025"
            />
          </Field>
          <Field label="Discount percentage (0–100)">
            <input
              type="number"
              min={0}
              max={100}
              value={(rules["percentage"] as number) ?? ""}
              onChange={(e) => setRule("percentage", parseFloat(e.target.value))}
              className="input-base"
              placeholder="15"
            />
          </Field>
        </div>
      );

    default:
      return (
        <p className="text-sm text-neutral-500">Select an offer type in step 1 first.</p>
      );
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Trigger rules
// ---------------------------------------------------------------------------

const TRIGGER_TYPES = [
  { value: "always", label: "Always (no conditions)" },
  { value: "min_cart_value", label: "Minimum cart value" },
  { value: "specific_product", label: "Specific product in cart" },
  { value: "customer_tag", label: "Customer tag" },
  { value: "first_order", label: "First order only" },
] as const;

function StepTrigger({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const rules = state.triggerRules;
  const triggerType = (rules[0] as Record<string, unknown> | undefined)?.type ?? "always";

  function setTrigger(type: string, extra: Record<string, unknown> = {}) {
    if (type === "always") {
      onChange({ triggerRules: [] });
    } else {
      onChange({ triggerRules: [{ type, ...extra }] });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">When to apply this offer</p>
        <div className="space-y-2">
          {TRIGGER_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                (triggerType === t.value) || (t.value === "always" && rules.length === 0)
                  ? "border-brand-500 bg-brand-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="trigger"
                value={t.value}
                checked={
                  t.value === "always"
                    ? rules.length === 0
                    : triggerType === t.value
                }
                onChange={() => setTrigger(t.value)}
                className="text-brand-600"
              />
              <span className="text-sm text-neutral-800">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {triggerType === "min_cart_value" && (
        <Field label="Minimum cart value">
          <input
            type="number"
            min={0}
            step={0.01}
            value={((rules[0] as Record<string, unknown>)?.minValue as number) ?? ""}
            onChange={(e) =>
              setTrigger("min_cart_value", { minValue: parseFloat(e.target.value) })
            }
            className="input-base"
            placeholder="50.00"
          />
        </Field>
      )}

      {triggerType === "specific_product" && (
        <Field label="Product ID (Shopify GID)">
          <input
            type="text"
            value={((rules[0] as Record<string, unknown>)?.productId as string) ?? ""}
            onChange={(e) =>
              setTrigger("specific_product", { productId: e.target.value })
            }
            className="input-base"
            placeholder="gid://shopify/Product/123"
          />
        </Field>
      )}

      {triggerType === "customer_tag" && (
        <Field label="Customer tag">
          <input
            type="text"
            value={((rules[0] as Record<string, unknown>)?.tag as string) ?? ""}
            onChange={(e) => setTrigger("customer_tag", { tag: e.target.value })}
            className="input-base"
            placeholder="vip"
          />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Display settings
// ---------------------------------------------------------------------------

function StepDisplay({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const ds = state.displaySettings;

  function set(key: string, value: unknown) {
    onChange({ displaySettings: { ...ds, [key]: value } });
  }

  return (
    <div className="space-y-4">
      <Field label="Banner headline (shown in cart / checkout)">
        <input
          type="text"
          value={(ds["headline"] as string) ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          className="input-base"
          placeholder="🎉 You've unlocked a discount!"
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          rows={2}
          value={(ds["description"] as string) ?? ""}
          onChange={(e) => set("description", e.target.value)}
          className="input-base resize-none"
          placeholder="Add more items to save even more."
        />
      </Field>

      <Field label="Badge text (optional, short)">
        <input
          type="text"
          value={(ds["badgeText"] as string) ?? ""}
          onChange={(e) => set("badgeText", e.target.value)}
          className="input-base"
          placeholder="SAVE 20%"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Primary color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(ds["primaryColor"] as string) ?? "#3B82F6"}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-9 w-14 rounded border border-neutral-200 cursor-pointer"
            />
            <input
              type="text"
              value={(ds["primaryColor"] as string) ?? "#3B82F6"}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="input-base flex-1"
            />
          </div>
        </Field>

        <Field label="Show in checkout">
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(ds["showInCheckout"] as boolean) ?? true}
              onChange={(e) => set("showInCheckout", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-neutral-700">Show in checkout</span>
          </label>
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Review
// ---------------------------------------------------------------------------

function StepReview({ state }: { state: WizardState }) {
  const offerType = OFFER_TYPES.find((t) => t.value === state.type);

  return (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <Row label="Name" value={state.name || "(not set)"} />
        <Row label="Type" value={offerType?.label ?? state.type} />
        <Row
          label="Trigger"
          value={
            state.triggerRules.length === 0
              ? "Always"
              : String(
                  (state.triggerRules[0] as Record<string, unknown>)?.type ?? "custom"
                )
          }
        />
        <Row
          label="Headline"
          value={(state.displaySettings["headline"] as string) || "(none)"}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">
          Discount Rules
        </p>
        <pre className="text-xs bg-neutral-900 text-green-400 rounded-xl p-3 overflow-auto">
          {JSON.stringify(state.discountRules, null, 2)}
        </pre>
      </div>

      <p className="text-xs text-neutral-500">
        The offer will be saved as a <strong>Draft</strong>. Activate it from the library
        when ready.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-28 shrink-0 text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium">{value}</span>
    </div>
  );
}

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
// Wizard shell
// ---------------------------------------------------------------------------

export function OfferWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: "",
    type: "",
    discountRules: {},
    triggerRules: [],
    displaySettings: { showInCheckout: true, primaryColor: "#3B82F6" },
    functionConfig: null,
  });

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0 && state.type !== "";
    return true;
  }

  const handleBack = useCallback(() => {
    if (step === 0) router.back();
    else setStep(step - 1);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          type: state.type,
          discountRules: state.discountRules,
          triggerRules: state.triggerRules,
          displaySettings: state.displaySettings,
          functionConfig: state.functionConfig,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown };
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to create offer"
        );
      }

      showSuccess(`Offer "${state.name}" created — activate it from the offers library.`);
      router.push(`/offers-library`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create offer. Check your connection and try again.");
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }, [step, handleSubmit]);

  const stepContent = [
    <StepType key="type" state={state} onChange={patch} />,
    <StepConfigure key="configure" state={state} onChange={patch} />,
    <StepTrigger key="trigger" state={state} onChange={patch} />,
    <StepDisplay key="display" state={state} onChange={patch} />,
    <StepReview key="review" state={state} />,
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <nav className="flex items-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                i === step
                  ? "text-brand-700 font-semibold"
                  : i < step
                  ? "text-neutral-500 hover:text-neutral-700 cursor-pointer"
                  : "text-neutral-300 cursor-not-allowed"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i < step
                    ? "bg-brand-600 text-white"
                    : i === step
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-neutral-300 mx-1" />
            )}
          </div>
        ))}
      </nav>

      {/* Step card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-5">
          {STEPS[step]}
        </h2>

        {stepContent[step]}

        {error && (
          <p className="mt-4 text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={saving}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canAdvance()}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving || !canAdvance()}>
              {saving ? "Saving…" : "Create Offer"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
