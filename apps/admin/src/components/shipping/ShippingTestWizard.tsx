"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Truck, ToggleLeft, ToggleRight, ShoppingCart, CheckCircle2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { UpgradePlanModal } from "@/components/ui/UpgradePlanModal";
import { VariantAllocationEditor, AllocationVariant } from "@/components/experiments/VariantAllocationEditor";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#0891b2";
const CYAN = "#0891b2";
const ACCENT_GRADIENT = "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)";

const STEPS = [
  { label: "Setup",             sublabel: "Name & hypothesis" },
  { label: "Shipping Strategy", sublabel: "Choose test type" },
  { label: "Variant Config",    sublabel: "Configure variants" },
  { label: "Display",           sublabel: "Progress bar" },
  { label: "Review",            sublabel: "Launch readiness" },
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;

const CONTINUE_LABELS: Record<number, string> = {
  0: "Choose strategy",
  1: "Configure variants",
  2: "Set up display",
  3: "Review & launch",
};

const STEP_TITLES = [
  "Define your shipping experiment",
  "Choose a shipping strategy",
  "Configure variant shipping rules",
  "Set up storefront display",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a hypothesis about how the shipping change will affect conversion or AOV.",
  "Select the shipping mechanic you want to test — threshold, method visibility, renaming, or progress bar.",
  "Configure the specific shipping rules for each test variant.",
  "Set up how the threshold or progress bar appears to visitors on the storefront.",
  "Review the full shipping test configuration and fix any issues before launching.",
];

type Strategy = "FREE_THRESHOLD" | "METHOD_VISIBILITY" | "METHOD_RENAME" | "PROGRESS_BAR";

interface StrategyCard {
  id: Strategy;
  icon: string;
  title: string;
  description: string;
  metric: string;
  requiresPlus?: boolean;
}

const STRATEGY_CARDS: StrategyCard[] = [
  {
    id: "FREE_THRESHOLD",
    icon: "🚚",
    title: "Free Shipping Threshold",
    description: "Test different cart value thresholds for free shipping",
    metric: "+12% AOV when threshold lowered $75→$50",
  },
  {
    id: "METHOD_VISIBILITY",
    icon: "👁",
    title: "Method Visibility",
    description: "Show or hide specific delivery methods",
    metric: "+8% conversion hiding express at checkout",
    requiresPlus: true,
  },
  {
    id: "METHOD_RENAME",
    icon: "✏️",
    title: "Method Rename",
    description: "Rename delivery method labels at checkout",
    metric: "+5% checkout rate with clearer method names",
    requiresPlus: true,
  },
  {
    id: "PROGRESS_BAR",
    icon: "📊",
    title: "Shipping Progress Bar",
    description: "Show a progress bar toward free shipping threshold",
    metric: "+18% AOV with visible free shipping progress",
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MethodOp =
  | { type: "hide"; titleContains: string }
  | { type: "rename"; titleFrom: string; titleTo: string };

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  freeShippingThreshold: number | null;
  progressBarMessage: string;
  methodOperations: MethodOp[];
}

interface WizardState {
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  strategy: Strategy;
  progressBarEnabled: boolean;
  progressBarMessageTemplate: string;
  useDeliveryCustomization: boolean;
  variants: VariantConfig[];
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  strategy: "FREE_THRESHOLD",
  progressBarEnabled: false,
  progressBarMessageTemplate: "Add {remaining} more for free shipping!",
  useDeliveryCustomization: false,
  variants: [
    {
      key: "control",
      name: "Control",
      isControl: true,
      allocationPercent: 50,
      freeShippingThreshold: 75,
      progressBarMessage: "Add {remaining} more for free shipping!",
      methodOperations: [],
    },
    {
      key: "variant_a",
      name: "Variant A",
      isControl: false,
      allocationPercent: 50,
      freeShippingThreshold: 50,
      progressBarMessage: "Add {remaining} more for free shipping!",
      methodOperations: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Live Cart Simulator — ShippingPreviewPanel
// ---------------------------------------------------------------------------

const SIMULATED_CART = 45;

function formatDollar(n: number) {
  return `$${n.toFixed(2)}`;
}

function FreeThresholdPreview({ variants, progressBarMessageTemplate, progressBarEnabled, strategy }: {
  variants: VariantConfig[];
  progressBarMessageTemplate: string;
  progressBarEnabled: boolean;
  strategy: Strategy;
}) {
  const showBar = progressBarEnabled || strategy === "PROGRESS_BAR";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <ShoppingCart className="w-3.5 h-3.5" style={{ color: CYAN }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>
          Cart Simulator
        </span>
      </div>
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-neutral-500">Simulated cart value</span>
        <span className="text-sm font-bold text-neutral-800">{formatDollar(SIMULATED_CART)}</span>
      </div>

      {variants.map((v) => {
        const threshold = v.freeShippingThreshold;
        if (threshold === null || threshold === undefined) return null;
        const pct = Math.min(Math.round((SIMULATED_CART / threshold) * 100), 100);
        const remaining = Math.max(threshold - SIMULATED_CART, 0);
        const reached = SIMULATED_CART >= threshold;
        const msgTemplate = showBar
          ? (progressBarMessageTemplate || "Add {remaining} more for free shipping!")
          : "Add {remaining} more for free shipping!";
        const msg = reached
          ? "Free shipping unlocked!"
          : msgTemplate.replace("{remaining}", formatDollar(remaining));

        return (
          <div
            key={v.key}
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: v.isControl ? "#e5e7eb" : `${CYAN}40`,
              background: v.isControl ? "#fff" : `${CYAN}06`,
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: v.isControl ? "#f3f4f6" : `${CYAN}20` }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: v.isControl ? "#9ca3af" : CYAN }}
                />
                <span className="text-[11px] font-semibold text-neutral-700">{v.name}</span>
              </div>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: v.isControl ? "#f3f4f6" : `${CYAN}18`,
                  color: v.isControl ? "#6b7280" : CYAN,
                }}
              >
                threshold {formatDollar(threshold)}
              </span>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: reached
                        ? "linear-gradient(90deg, #10b981, #059669)"
                        : v.isControl
                          ? "linear-gradient(90deg, #9ca3af, #6b7280)"
                          : ACCENT_GRADIENT,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-neutral-400">$0</span>
                  <span className="text-[9px] font-medium" style={{ color: v.isControl ? "#6b7280" : CYAN }}>
                    {pct}%
                  </span>
                  <span className="text-[9px] text-neutral-400">{formatDollar(threshold)}</span>
                </div>
              </div>
              {/* Message */}
              <div
                className="flex items-start gap-1.5 rounded-lg px-2 py-1.5"
                style={{ background: reached ? "#ecfdf5" : "#f9fafb" }}
              >
                {reached ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <Truck className="w-3 h-3 mt-0.5 shrink-0" style={{ color: v.isControl ? "#9ca3af" : CYAN }} />
                )}
                <p
                  className="text-[10px] leading-snug"
                  style={{ color: reached ? "#059669" : "#6b7280" }}
                >
                  {msg}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MethodVisibilityPreview({ variants }: { variants: VariantConfig[] }) {
  const mockMethods = [
    { label: "Standard (5-7 days)", price: "Free" },
    { label: "Express (2-3 days)", price: "$9.99" },
    { label: "Overnight", price: "$19.99" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>
          Checkout Preview
        </span>
      </div>
      {variants.map((v) => {
        const hiddenPatterns = v.methodOperations
          .filter((op) => op.type === "hide")
          .map((op) => (op as { type: "hide"; titleContains: string }).titleContains.toLowerCase());

        return (
          <div
            key={v.key}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: v.isControl ? "#e5e7eb" : `${CYAN}40`, background: v.isControl ? "#fff" : `${CYAN}06` }}
          >
            <div
              className="px-3 py-2 border-b flex items-center gap-1.5"
              style={{ borderColor: v.isControl ? "#f3f4f6" : `${CYAN}20` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.isControl ? "#9ca3af" : CYAN }} />
              <span className="text-[11px] font-semibold text-neutral-700">{v.name}</span>
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              {mockMethods.map((method, mi) => {
                const isHidden = !v.isControl && hiddenPatterns.some((p) =>
                  p.length > 0 && method.label.toLowerCase().includes(p)
                );
                return isHidden ? (
                  <div key={mi} className="flex items-center gap-2 opacity-40">
                    <span className="w-3 h-3 rounded-full border border-dashed border-neutral-300" />
                    <span className="text-[10px] text-neutral-400 line-through">{method.label}</span>
                    <span className="ml-auto text-[9px] bg-red-50 text-red-400 px-1.5 py-0.5 rounded font-medium">HIDDEN</span>
                  </div>
                ) : (
                  <div key={mi} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-neutral-300" />
                    <span className="text-[10px] text-neutral-700">{method.label}</span>
                    <span className="ml-auto text-[10px] font-medium text-neutral-500">{method.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MethodRenamePreview({ variants }: { variants: VariantConfig[] }) {
  const mockMethods = [
    { label: "Standard Shipping", price: "Free" },
    { label: "Express Delivery", price: "$9.99" },
    { label: "Overnight Express", price: "$19.99" },
  ];

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>
        Method Name Preview
      </span>
      {variants.map((v) => {
        const renameOps = v.methodOperations
          .filter((op) => op.type === "rename") as Array<{ type: "rename"; titleFrom: string; titleTo: string }>;

        return (
          <div
            key={v.key}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: v.isControl ? "#e5e7eb" : `${CYAN}40`, background: v.isControl ? "#fff" : `${CYAN}06` }}
          >
            <div
              className="px-3 py-2 border-b flex items-center gap-1.5"
              style={{ borderColor: v.isControl ? "#f3f4f6" : `${CYAN}20` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.isControl ? "#9ca3af" : CYAN }} />
              <span className="text-[11px] font-semibold text-neutral-700">{v.name}</span>
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              {mockMethods.map((method, mi) => {
                const rename = renameOps.find(
                  (op) => op.titleFrom.length > 0 && method.label.toLowerCase().includes(op.titleFrom.toLowerCase())
                );
                const displayLabel = rename ? rename.titleTo || method.label : method.label;
                return (
                  <div key={mi} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-neutral-300" />
                    <span className="text-[10px] text-neutral-700">{displayLabel}</span>
                    {rename && (
                      <span className="text-[9px] text-cyan-600 bg-cyan-50 px-1 py-0.5 rounded ml-0.5">renamed</span>
                    )}
                    <span className="ml-auto text-[10px] font-medium text-neutral-500">{method.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBarPreview({ variants, progressBarMessageTemplate, strategy }: {
  variants: VariantConfig[];
  progressBarMessageTemplate: string;
  strategy: Strategy;
}) {
  const controlThreshold = variants.find((v) => v.isControl)?.freeShippingThreshold ?? 75;
  const threshold = controlThreshold ?? 75;
  const pct = Math.min(Math.round((SIMULATED_CART / threshold) * 100), 100);
  const remaining = Math.max(threshold - SIMULATED_CART, 0);
  const msgTemplate = progressBarMessageTemplate || "Add {remaining} more for free shipping!";
  const msg = msgTemplate.replace("{remaining}", formatDollar(remaining));

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>
        Progress Bar Preview
      </span>
      <div className="rounded-xl border border-neutral-100 bg-white p-3 shadow-sm">
        <div className="flex items-start gap-2 mb-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: ACCENT_GRADIENT }}
          >
            <Truck className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-[11px] text-neutral-700 leading-snug pt-0.5">{msg}</p>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: ACCENT_GRADIENT }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-neutral-400">$0</span>
          <span className="text-[9px] font-semibold" style={{ color: CYAN }}>{formatDollar(threshold)} free shipping</span>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-neutral-500">Simulated cart</span>
        <span className="text-[11px] font-bold text-neutral-800">{formatDollar(SIMULATED_CART)}</span>
      </div>
    </div>
  );
}

function ShippingPreviewPanel({
  step,
  strategy,
  variants,
  progressBarMessageTemplate,
  progressBarEnabled,
  name,
  trafficAllocation,
}: {
  step: number;
  strategy: Strategy;
  variants: VariantConfig[];
  progressBarMessageTemplate: string;
  progressBarEnabled: boolean;
  name: string;
  trafficAllocation: number;
}) {
  const strategyCard = STRATEGY_CARDS.find((c) => c.id === strategy);

  return (
    <div className="space-y-4">
      {/* Simulator / Preview */}
      <div className="rounded-2xl border border-neutral-100 bg-white shadow-sm overflow-hidden">
        <div
          className="px-4 py-3 border-b border-neutral-50"
          style={{ background: `${CYAN}08` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>
            Live Preview
          </p>
        </div>
        <div className="p-4">
          {strategy === "FREE_THRESHOLD" && (
            <FreeThresholdPreview
              variants={variants}
              progressBarMessageTemplate={progressBarMessageTemplate}
              progressBarEnabled={progressBarEnabled}
              strategy={strategy}
            />
          )}
          {strategy === "METHOD_VISIBILITY" && (
            <MethodVisibilityPreview variants={variants} />
          )}
          {strategy === "METHOD_RENAME" && (
            <MethodRenamePreview variants={variants} />
          )}
          {strategy === "PROGRESS_BAR" && (
            <ProgressBarPreview
              variants={variants}
              progressBarMessageTemplate={progressBarMessageTemplate}
              strategy={strategy}
            />
          )}
        </div>
      </div>

      {/* Config summary */}
      <div className="rounded-2xl border border-neutral-100 bg-white shadow-sm overflow-hidden">
        <div
          className="px-4 py-3 border-b border-neutral-50"
          style={{ background: "#f9fafb" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Test Summary
          </p>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-neutral-400 w-20 shrink-0 pt-0.5">Name</span>
            <span className="text-[11px] font-medium text-neutral-700 leading-snug">
              {name || <span className="italic text-neutral-300">Not set</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 w-20 shrink-0">Strategy</span>
            <span className="text-[11px] font-medium text-neutral-700">
              {strategyCard?.icon} {strategyCard?.title ?? strategy}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 w-20 shrink-0">Variants</span>
            <span className="text-[11px] font-medium text-neutral-700">{variants.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 w-20 shrink-0">Traffic</span>
            <span className="text-[11px] font-medium text-neutral-700">{trafficAllocation}%</span>
          </div>
        </div>
      </div>

      {/* Strategy metric hint */}
      {strategyCard?.metric && (
        <div
          className="rounded-xl px-3 py-2.5 border"
          style={{ background: `${CYAN}08`, borderColor: `${CYAN}25` }}
        >
          <p className="text-[10px] font-medium leading-snug" style={{ color: CYAN }}>
            {strategyCard.metric}
          </p>
        </div>
      )}
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
      <FormSection title="Test Details" accent={ACCENT}>
        <div className="space-y-4">
          <FormField label="Test name" required hint="A clear, descriptive name for your experiment">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="input-base w-full"
              placeholder="Free Shipping Threshold Test"
            />
          </FormField>

          <FormField
            label="Hypothesis"
            hint="What do you expect will happen and why?"
          >
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className="input-base w-full resize-none"
              placeholder="Lowering the free shipping threshold from $75 to $50 will increase checkout completion without reducing profit per visitor."
            />
          </FormField>

          <FormField
            label="Traffic allocation (%)"
            hint="Percentage of visitors included in this test. The rest see the default experience."
          >
            <input
              type="number"
              min={1}
              max={100}
              value={state.trafficAllocation}
              onChange={(e) =>
                onChange({ trafficAllocation: Math.min(100, Math.max(1, parseFloat(e.target.value) || 1)) })
              }
              className="input-base w-28"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Shipping Strategy
// ---------------------------------------------------------------------------

function StepShippingStrategy({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const selectedCard = STRATEGY_CARDS.find((c) => c.id === state.strategy);
  const showPlusWarning = selectedCard?.requiresPlus ?? false;

  return (
    <div className="space-y-6">
      <FormSection
        title="Select a Shipping Strategy"
        description="Choose how you want to experiment with your shipping experience."
        accent={ACCENT}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {STRATEGY_CARDS.map((card) => {
            const isSelected = state.strategy === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() =>
                  onChange({
                    strategy: card.id,
                    useDeliveryCustomization:
                      card.requiresPlus ? true : state.useDeliveryCustomization,
                  })
                }
                className="text-left rounded-xl border-2 px-4 py-4 transition-all focus:outline-none"
                style={
                  isSelected
                    ? {
                        borderColor: ACCENT,
                        background: `${ACCENT}10`,
                        boxShadow: `0 0 0 3px ${ACCENT}28`,
                      }
                    : {
                        borderColor: "#e5e7eb",
                        background: "#fff",
                      }
                }
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl leading-none">{card.icon}</span>
                    {card.requiresPlus && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${ACCENT}18`, color: ACCENT }}
                      >
                        Plus
                      </span>
                    )}
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{ color: isSelected ? ACCENT : "#1f2937" }}
                    >
                      {card.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                  <div
                    className="rounded-lg px-2.5 py-1.5 mt-0.5"
                    style={{
                      background: isSelected ? `${ACCENT}10` : "#f9fafb",
                      border: `1px solid ${isSelected ? `${ACCENT}25` : "#f3f4f6"}`,
                    }}
                  >
                    <p
                      className="text-[10px] font-medium leading-snug"
                      style={{ color: isSelected ? ACCENT : "#6b7280" }}
                    >
                      {card.metric}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </FormSection>

      {showPlusWarning && (
        <InlineAlert variant="warning">
          Delivery Customization requires a Shopify Plus plan or higher. Ensure your store has it
          before launching.
        </InlineAlert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Variant Config
// ---------------------------------------------------------------------------

function FreeThresholdEditor({
  variant,
  onChange,
}: {
  variant: VariantConfig;
  onChange: (p: Partial<VariantConfig>) => void;
}) {
  const threshold = variant.freeShippingThreshold;
  const isZeroThreshold = threshold === 0;

  return (
    <div className="space-y-3">
      <FormField
        label="Free shipping threshold ($)"
        hint="Cart value required to qualify for free shipping"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 font-medium">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={variant.freeShippingThreshold ?? ""}
            onChange={(e) =>
              onChange({
                freeShippingThreshold:
                  e.target.value === "" ? null : parseFloat(e.target.value),
              })
            }
            className="input-base w-32"
            placeholder="50.00"
          />
        </div>
        {isZeroThreshold && (
          <p className="text-xs text-amber-600 mt-1">&#9888; A threshold of $0 means free shipping for all orders regardless of cart value</p>
        )}
      </FormField>
      <FormField label="Compare-at text (optional)" hint="Shown near the threshold, e.g. 'Was $75'">
        <input
          type="text"
          className="input-base w-full"
          placeholder="e.g. Reduced from $75 threshold"
          value={variant.progressBarMessage}
          onChange={(e) => onChange({ progressBarMessage: e.target.value })}
        />
      </FormField>
    </div>
  );
}

function MethodVisibilityEditor({
  variant,
  onChange,
}: {
  variant: VariantConfig;
  onChange: (p: Partial<VariantConfig>) => void;
}) {
  function addOp() {
    onChange({
      methodOperations: [
        ...variant.methodOperations,
        { type: "hide", titleContains: "" },
      ],
    });
  }

  function removeOp(i: number) {
    onChange({
      methodOperations: variant.methodOperations.filter((_, idx) => idx !== i),
    });
  }

  function updateOp(i: number, patch: Partial<MethodOp>) {
    const ops = variant.methodOperations.map((op, idx) =>
      idx === i ? ({ ...op, ...patch } as MethodOp) : op
    );
    onChange({ methodOperations: ops });
  }

  const hideOps = variant.methodOperations.filter((op) => op.type === "hide") as Array<{
    type: "hide";
    titleContains: string;
  }>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-600">
          Method title patterns to hide
        </span>
        <button
          type="button"
          onClick={addOp}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: ACCENT }}
        >
          <Plus className="w-3 h-3" /> Add pattern
        </button>
      </div>
      {hideOps.length === 0 && (
        <p className="text-xs text-neutral-400">No patterns yet — add at least one.</p>
      )}
      {variant.methodOperations.map((op, i) =>
        op.type === "hide" ? (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={op.titleContains}
              onChange={(e) => updateOp(i, { titleContains: e.target.value })}
              className="input-base flex-1"
              placeholder="e.g. Express, DHL"
            />
            <button
              type="button"
              onClick={() => removeOp(i)}
              className="text-neutral-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null
      )}
    </div>
  );
}

function MethodRenameEditor({
  variant,
  onChange,
}: {
  variant: VariantConfig;
  onChange: (p: Partial<VariantConfig>) => void;
}) {
  function addOp() {
    onChange({
      methodOperations: [
        ...variant.methodOperations,
        { type: "rename", titleFrom: "", titleTo: "" },
      ],
    });
  }

  function removeOp(i: number) {
    onChange({
      methodOperations: variant.methodOperations.filter((_, idx) => idx !== i),
    });
  }

  function updateOp(i: number, patch: Partial<MethodOp>) {
    const ops = variant.methodOperations.map((op, idx) =>
      idx === i ? ({ ...op, ...patch } as MethodOp) : op
    );
    onChange({ methodOperations: ops });
  }

  const renameOps = variant.methodOperations.filter((op) => op.type === "rename") as Array<{
    type: "rename";
    titleFrom: string;
    titleTo: string;
  }>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-600">Method rename pairs</span>
        <button
          type="button"
          onClick={addOp}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: ACCENT }}
        >
          <Plus className="w-3 h-3" /> Add rename
        </button>
      </div>
      {renameOps.length === 0 && (
        <p className="text-xs text-neutral-400">No renames yet — add at least one pair.</p>
      )}
      {variant.methodOperations.map((op, i) =>
        op.type === "rename" ? (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={op.titleFrom}
              onChange={(e) => updateOp(i, { titleFrom: e.target.value })}
              className="input-base flex-1"
              placeholder="From (e.g. Standard Shipping)"
            />
            <span className="text-neutral-400 text-sm shrink-0">→</span>
            <input
              type="text"
              value={op.titleTo}
              onChange={(e) => updateOp(i, { titleTo: e.target.value })}
              className="input-base flex-1"
              placeholder="To (e.g. Free Delivery)"
            />
            <button
              type="button"
              onClick={() => removeOp(i)}
              className="text-neutral-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null
      )}
    </div>
  );
}

function ProgressBarVariantEditor({
  variant,
  onChange,
}: {
  variant: VariantConfig;
  onChange: (p: Partial<VariantConfig>) => void;
}) {
  return (
    <div className="space-y-3">
      <FormField
        label="Message template"
        hint='Use {remaining} for the dynamic cart amount'
      >
        <input
          type="text"
          value={variant.progressBarMessage}
          onChange={(e) => onChange({ progressBarMessage: e.target.value })}
          className="input-base w-full"
          placeholder="Add {remaining} more for free shipping!"
        />
      </FormField>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          type="button"
          onClick={() =>
            onChange({ freeShippingThreshold: variant.freeShippingThreshold === null ? 75 : null })
          }
          className="transition-colors"
          style={{ color: variant.freeShippingThreshold !== null ? ACCENT : "#9ca3af" }}
        >
          {variant.freeShippingThreshold !== null ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
        <span className="text-xs text-neutral-700">Enable progress bar for this variant</span>
      </label>
    </div>
  );
}

function StepVariantConfig({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function updateVariant(i: number, patch: Partial<VariantConfig>) {
    onChange({
      variants: state.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    });
  }

  function addVariant() {
    const nonControl = state.variants.filter((v) => !v.isControl).length;
    const letter = String.fromCharCode(97 + nonControl);
    const newV: VariantConfig = {
      key: `variant_${letter}`,
      name: `Variant ${letter.toUpperCase()}`,
      isControl: false,
      allocationPercent: 0,
      freeShippingThreshold: 50,
      progressBarMessage: "Add {remaining} more for free shipping!",
      methodOperations: [],
    };
    onChange({ variants: [...state.variants, newV] });
  }

  function removeVariant(i: number) {
    if (state.variants.length <= 2) return;
    onChange({ variants: state.variants.filter((_, idx) => idx !== i) });
  }

  const allocVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));

  function handleAllocChange(updated: AllocationVariant[]) {
    onChange({
      variants: state.variants.map((v) => {
        const found = updated.find((u) => u.key === v.key);
        return found ? { ...v, allocationPercent: found.allocationPercent } : v;
      }),
    });
  }

  return (
    <div className="space-y-6">
      <FormSection title="Traffic Allocation" accent={ACCENT}>
        <VariantAllocationEditor
          variants={allocVariants}
          onChange={handleAllocChange}
          accentHex={ACCENT}
        />
      </FormSection>

      <FormSection
        title="Variant Settings"
        description="Configure each variant based on the selected strategy."
        accent={ACCENT}
      >
        <div className="space-y-4 mt-2">
          {state.variants.map((v, i) => (
            <div
              key={v.key}
              className="rounded-xl border border-neutral-200 bg-white overflow-hidden"
            >
              {/* Variant header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b border-neutral-100"
                style={
                  v.isControl
                    ? { background: "#f9fafb" }
                    : { background: `${ACCENT}08` }
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: v.isControl ? "#9ca3af" : ACCENT }}
                  />
                  <span className="text-sm font-semibold text-neutral-800">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                      Control
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400">{v.allocationPercent}%</span>
                  {!v.isControl && state.variants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Variant body */}
              <div className="px-4 py-4">
                {v.isControl ? (
                  <p className="text-xs text-neutral-400 italic">
                    Default shipping behavior (no changes)
                  </p>
                ) : (
                  <>
                    {state.strategy === "FREE_THRESHOLD" && (
                      <FreeThresholdEditor
                        variant={v}
                        onChange={(p) => updateVariant(i, p)}
                      />
                    )}
                    {state.strategy === "METHOD_VISIBILITY" && (
                      <MethodVisibilityEditor
                        variant={v}
                        onChange={(p) => updateVariant(i, p)}
                      />
                    )}
                    {state.strategy === "METHOD_RENAME" && (
                      <MethodRenameEditor
                        variant={v}
                        onChange={(p) => updateVariant(i, p)}
                      />
                    )}
                    {state.strategy === "PROGRESS_BAR" && (
                      <ProgressBarVariantEditor
                        variant={v}
                        onChange={(p) => updateVariant(i, p)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-neutral-200 text-sm text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Display
// ---------------------------------------------------------------------------

function StepDisplay({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const isProgressBarStrategy = state.strategy === "PROGRESS_BAR";

  const previewRemaining = 25.0;
  const controlThreshold =
    state.variants.find((v) => v.isControl)?.freeShippingThreshold ?? 75;
  const threshold = controlThreshold ?? 75;
  const sampleCart = threshold * 0.67;
  const progressPct = Math.min(100, Math.round((sampleCart / threshold) * 100));
  const previewMsg = (
    state.progressBarMessageTemplate || "Add {remaining} more for free shipping!"
  ).replace("{remaining}", `$${previewRemaining.toFixed(2)}`);

  return (
    <div className="space-y-6">
      {!isProgressBarStrategy && (
        <FormSection title="Shipping Progress Bar" accent={ACCENT}>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <button
                type="button"
                onClick={() => onChange({ progressBarEnabled: !state.progressBarEnabled })}
                className="transition-colors"
                style={{ color: state.progressBarEnabled ? ACCENT : "#9ca3af" }}
              >
                {state.progressBarEnabled ? (
                  <ToggleRight className="w-6 h-6" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
              <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 transition-colors">
                Show free shipping progress bar
              </span>
            </label>
          </div>
        </FormSection>
      )}

      {(state.progressBarEnabled || isProgressBarStrategy) && (
        <FormSection
          title="Progress Bar Message"
          description="Customise the message shown in the progress bar widget."
          accent={ACCENT}
        >
          <div className="space-y-4">
            <FormField
              label="Message template"
              hint="Use {remaining} for the dynamic dollar amount remaining"
            >
              <input
                type="text"
                value={state.progressBarMessageTemplate}
                onChange={(e) => onChange({ progressBarMessageTemplate: e.target.value })}
                className="input-base w-full"
                placeholder="Add {remaining} more for free shipping!"
              />
            </FormField>

            {/* Preview widget */}
            <div>
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Live Preview
              </p>
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: ACCENT_GRADIENT }}
                  >
                    <Truck className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm text-neutral-700 leading-snug">{previewMsg}</p>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, background: ACCENT_GRADIENT }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-neutral-400">$0</span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: ACCENT }}
                  >
                    ${threshold} free shipping
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FormSection>
      )}

      <FormSection title="Delivery Customization" accent={ACCENT}>
        <InlineAlert variant="info">
          If your strategy requires hiding or renaming delivery methods, a Shopify Delivery
          Customization Function must be deployed. Ensure the function is active in your Shopify
          admin before launching.
        </InlineAlert>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Review
// ---------------------------------------------------------------------------

function buildReadinessChecks(state: WizardState): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const totalAlloc = state.variants.reduce((s, v) => s + v.allocationPercent, 0);
  const nonControl = state.variants.filter((v) => !v.isControl);

  // BLOCK checks
  checks.push({
    id: "name",
    label: "Test name is set",
    status: state.name.trim().length > 0 ? "pass" : "block",
    detail: state.name.trim().length === 0 ? "A name is required to create the test." : undefined,
  });

  checks.push({
    id: "allocation",
    label: "Traffic allocation totals 100%",
    status: Math.abs(totalAlloc - 100) < 0.1 ? "pass" : "block",
    detail:
      Math.abs(totalAlloc - 100) >= 0.1
        ? `Currently at ${totalAlloc.toFixed(1)}%.`
        : undefined,
  });

  if (state.strategy === "FREE_THRESHOLD") {
    const badVariants = nonControl.filter(
      (v) => v.freeShippingThreshold !== null && v.freeShippingThreshold <= 0
    );
    checks.push({
      id: "threshold",
      label: "All variant thresholds are positive",
      status: badVariants.length === 0 ? "pass" : "block",
      detail:
        badVariants.length > 0
          ? `${badVariants.map((v) => v.name).join(", ")} ${badVariants.length === 1 ? "has" : "have"} a threshold ≤ $0.`
          : undefined,
    });
  }

  if (state.strategy === "METHOD_VISIBILITY" || state.strategy === "METHOD_RENAME") {
    const noOps = nonControl.filter((v) => v.methodOperations.length === 0);
    checks.push({
      id: "method_ops",
      label: "All variants have method operations configured",
      status: noOps.length === 0 ? "pass" : "block",
      detail:
        noOps.length > 0
          ? `${noOps.map((v) => v.name).join(", ")} ${noOps.length === 1 ? "has" : "have"} no method operations.`
          : undefined,
    });
  }

  // WARN checks
  if (state.strategy === "METHOD_VISIBILITY" || state.strategy === "METHOD_RENAME") {
    checks.push({
      id: "plus_plan",
      label: "Shopify Plus plan confirmed",
      status: "warn",
      detail: "Delivery Customization requires Shopify Plus or higher.",
    });
  }

  const progressBarActive = state.progressBarEnabled || state.strategy === "PROGRESS_BAR";
  if (progressBarActive && !state.progressBarMessageTemplate.trim()) {
    checks.push({
      id: "pb_message",
      label: "Progress bar message template is set",
      status: "warn",
      detail: "No message template — visitors will see an empty progress bar.",
    });
  } else if (progressBarActive) {
    checks.push({
      id: "pb_message",
      label: "Progress bar message template is set",
      status: "pass",
    });
  }

  // PASS items
  checks.push({
    id: "variants_count",
    label: `${state.variants.length} variants configured`,
    status: "pass",
  });

  checks.push({
    id: "strategy",
    label: `Strategy: ${STRATEGY_CARDS.find((c) => c.id === state.strategy)?.title ?? state.strategy}`,
    status: "pass",
  });

  return checks;
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-neutral-50 last:border-0">
      <span className="w-40 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function StepReview({ state }: { state: WizardState }) {
  const checks = buildReadinessChecks(state);
  const selectedCard = STRATEGY_CARDS.find((c) => c.id === state.strategy);

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />

      <FormSection title="Test Summary" accent={ACCENT}>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-2">
          <ReviewRow label="Name" value={state.name || <span className="text-neutral-400 italic">Not set</span>} />
          <ReviewRow label="Strategy" value={`${selectedCard?.icon ?? ""} ${selectedCard?.title ?? state.strategy}`} />
          <ReviewRow label="Traffic allocation" value={`${state.trafficAllocation}% of visitors`} />
          <ReviewRow label="Variant count" value={`${state.variants.length} (${state.variants.filter((v) => !v.isControl).length} test, 1 control)`} />
          {state.strategy === "FREE_THRESHOLD" && (
            <ReviewRow
              label="Thresholds"
              value={state.variants.map((v) =>
                v.isControl
                  ? `Control: $${v.freeShippingThreshold ?? "—"}`
                  : `${v.name}: $${v.freeShippingThreshold ?? "free"}`
              ).join(" · ")}
            />
          )}
          {(state.strategy === "METHOD_VISIBILITY" || state.strategy === "METHOD_RENAME") && (
            <ReviewRow
              label="Method operations"
              value={state.variants
                .filter((v) => !v.isControl)
                .map((v) => `${v.name}: ${v.methodOperations.length} op(s)`)
                .join(" · ")}
            />
          )}
          <ReviewRow
            label="Progress bar"
            value={
              state.progressBarEnabled || state.strategy === "PROGRESS_BAR"
                ? "Enabled"
                : "Disabled"
            }
          />
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          Saved as DRAFT — activate from the test detail page when ready.
        </p>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export function ShippingTestWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Per-step advance guard
  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 2) {
      const total = state.variants.reduce((s, v) => s + v.allocationPercent, 0);
      return Math.abs(total - 100) < 0.1;
    }
    if (step === 4) {
      const checks = buildReadinessChecks(state);
      return !checks.some((c) => c.status === "block");
    }
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 2) {
      const total = state.variants.reduce((s, v) => s + v.allocationPercent, 0);
      if (Math.abs(total - 100) >= 0.1) return `Allocation is ${total.toFixed(1)}% — must be 100%`;
    }
    if (step === 4) {
      const checks = buildReadinessChecks(state);
      const blocker = checks.find((c) => c.status === "block");
      if (blocker) return blocker.label;
    }
    return undefined;
  }

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: state.name,
        hypothesis: state.hypothesis || undefined,
        trafficAllocation: state.trafficAllocation,
        progressBarEnabled: state.progressBarEnabled || state.strategy === "PROGRESS_BAR",
        progressBarMessageTemplate: state.progressBarMessageTemplate || undefined,
        useDeliveryCustomization:
          state.strategy === "METHOD_VISIBILITY" || state.strategy === "METHOD_RENAME",
        variants: state.variants.map((v) => ({
          key: v.key,
          name: v.name,
          isControl: v.isControl,
          allocationPercent: v.allocationPercent,
          freeShippingThreshold: v.freeShippingThreshold,
          progressBarMessage: v.progressBarMessage,
          methodOperations: v.methodOperations,
        })),
      };

      const res = await fetch("/api/shipping-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 402) { setShowUpgradeModal(true); setSaving(false); return; }
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create shipping test");
      }

      showSuccess(`Shipping test "${state.name}" created — activate it from the test detail page.`);
      router.push("/shipping-tests");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create test. Check your connection and try again.");
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      void handleSubmit();
    }
  }, [step, handleSubmit]);

  const wizardSteps = STEPS.map((s, i) => ({
    label: s.label,
    sublabel: s.sublabel,
    status: (i < step ? "complete" : i === step ? "active" : "pending") as
      | "complete"
      | "active"
      | "pending",
  }));

  const stepContent = [
    <StepSetup key="setup" state={state} onChange={patch} />,
    <StepShippingStrategy key="strategy" state={state} onChange={patch} />,
    <StepVariantConfig key="variants" state={state} onChange={patch} />,
    <StepDisplay key="display" state={state} onChange={patch} />,
    <StepReview key="review" state={state} />,
  ];

  const isLastStep = step === STEPS.length - 1;
  const checks = isLastStep ? buildReadinessChecks(state) : [];
  const hasBlockers = checks.some((c) => c.status === "block");

  return (
    <>
    <UpgradePlanModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} limitType="running experiments" />
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: `${CYAN}0a` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${CYAN}18` }}
          >
            <span className="text-base" style={{ color: CYAN }}>◷</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Shipping Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            Test free shipping thresholds, delivery methods, and progress bars to increase AOV.
          </p>
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={wizardSteps}
            currentStep={step}
            accentHex={CYAN}
            onStepClick={(i) => { if (i < step) setStep(i as StepIndex); }}
          />
        </div>
        <div className="p-3 border-t border-neutral-50">
          <div className="px-2 py-1.5 rounded-lg bg-cyan-50 border border-cyan-100">
            <p className="text-[9px] text-cyan-700 font-medium">
              Shopify Function may be required for shipping method changes.
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
            style={{ color: CYAN }}
          >
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Two-column content area */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Left: step content */}
            <div className="flex-1 min-w-0 space-y-5">
              {stepContent[step]}

              {error && (
                <div className="mt-4">
                  <InlineAlert variant="danger">{error}</InlineAlert>
                </div>
              )}
            </div>

            {/* Right: live preview panel */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <ShippingPreviewPanel
                step={step}
                strategy={state.strategy}
                variants={state.variants}
                progressBarMessageTemplate={state.progressBarMessageTemplate}
                progressBarEnabled={state.progressBarEnabled}
                name={state.name}
                trafficAllocation={state.trafficAllocation}
              />
            </aside>
          </div>
        </div>

        {/* Sticky actions */}
        <StickyFormActions
          step={step}
          totalSteps={STEPS.length}
          onBack={handleBack}
          onNext={handleNext}
          canContinue={canAdvance() && !saving}
          isLastStep={isLastStep}
          isSubmitting={saving}
          submitLabel="Create Shipping Test"
          continueLabel={CONTINUE_LABELS[step]}
          accentHex={ACCENT}
          blockingIssue={blockingIssue()}
        />
      </div>
    </div>
    </>
  );
}
