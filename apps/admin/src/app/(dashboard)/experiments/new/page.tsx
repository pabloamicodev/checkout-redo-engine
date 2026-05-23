"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  Tag,
  Percent,
  Truck,
  Gift,
  FileText,
  ShoppingCart,
  FlaskConical,
  Link2,
  Layers,
  Palette,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

// --- Types ---
interface VariantDraft {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  modifications: unknown[];
}

interface WizardState {
  type: string;
  name: string;
  hypothesis: string;
  primaryMetric: string;
  trafficAllocation: number;
  variants: VariantDraft[];
}

// --- Step definitions ---
const STEPS = [
  { id: 1, label: "Test Type" },
  { id: 2, label: "Name & Goal" },
  { id: 3, label: "Variants" },
  { id: 4, label: "Targeting" },
  { id: 5, label: "Review" },
];

const TEST_TYPES = [
  {
    type: "CONTENT_TEST",
    label: "Content Test",
    description: "Modify text, images, layout, or CSS on your storefront",
    icon: FileText,
    color: "bg-brand-50 text-brand-600",
  },
  {
    type: "PRICE_TEST",
    label: "Price Test",
    description: "Test different price points on products or variants",
    icon: Tag,
    color: "bg-green-50 text-green-600",
  },
  {
    type: "DISCOUNT_TEST",
    label: "Discount Test",
    description: "Test discount amounts, types, and eligibility rules",
    icon: Percent,
    color: "bg-purple-50 text-purple-600",
  },
  {
    type: "SHIPPING_TEST",
    label: "Shipping Test",
    description: "Test free shipping thresholds and shipping messaging",
    icon: Truck,
    color: "bg-orange-50 text-orange-600",
  },
  {
    type: "OFFER_TEST",
    label: "Offer Test",
    description: "Test offers, upsells, volume discounts, and free gifts",
    icon: Gift,
    color: "bg-pink-50 text-pink-600",
  },
  {
    type: "CHECKOUT_TEST",
    label: "Checkout Test",
    description: "Test checkout blocks, trust badges, and checkout content",
    icon: ShoppingCart,
    color: "bg-red-50 text-red-600",
  },
  {
    type: "SPLIT_URL_TEST",
    label: "Split URL Test",
    description: "Route visitors to different page URLs",
    icon: Link2,
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    type: "COMBINATION_TEST",
    label: "Combination Test",
    description: "Combine multiple test types in one experiment",
    icon: Layers,
    color: "bg-amber-50 text-amber-600",
  },
];

const METRICS = [
  { value: "conversion_rate", label: "Conversion Rate" },
  { value: "revenue_per_visitor", label: "Revenue per Visitor" },
  { value: "profit_per_visitor", label: "Profit per Visitor" },
  { value: "aov", label: "Average Order Value" },
  { value: "add_to_cart_rate", label: "Add-to-Cart Rate" },
];

// --- Wizard Component ---
export default function NewExperimentPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [state, setState] = useState<WizardState>({
    type: "",
    name: "",
    hypothesis: "",
    primaryMetric: "conversion_rate",
    trafficAllocation: 100,
    variants: [
      { key: "control", name: "Control", isControl: true, allocationPercent: 50, modifications: [] },
      { key: "variant_a", name: "Variant A", isControl: false, allocationPercent: 50, modifications: [] },
    ],
  });

  const canProceed = (): boolean => {
    if (step === 1) return !!state.type;
    if (step === 2) return state.name.trim().length > 0;
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + v.allocationPercent, 0);
      return Math.abs(total - 100) < 0.01 && state.variants.length >= 2;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const shop = process.env.NEXT_PUBLIC_DEMO_SHOP ?? "demo.myshopify.com";

      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shop-Domain": shop,
        },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis,
          type: state.type,
          primaryMetric: state.primaryMetric,
          trafficAllocation: state.trafficAllocation,
          assignmentStrategy: "visitor",
          targetingRules: [],
          goals: [],
          settings: {},
          variants: state.variants,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to create experiment");
      }

      const { experiment } = await res.json() as { experiment: { id: string } };
      toast.success("Experiment created successfully");
      router.push(`/experiments/${experiment.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create experiment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6"> 
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">New Experiment</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Create a new A/B test</p>
        </div>

        <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  step === s.id
                    ? "bg-brand-600 text-white"
                    : step > s.id
                    ? "bg-brand-50 text-brand-600 cursor-pointer hover:bg-brand-100"
                    : "bg-neutral-100 text-neutral-400 cursor-default"
                )}
              >
                {step > s.id ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span>{s.id}</span>
                )}
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-neutral-300" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 1 && (
          <StepTestType
            selected={state.type}
            onSelect={(type) => setState((s) => ({ ...s, type }))}
          />
        )}
        {step === 2 && (
          <StepNameGoal
            state={state}
            onChange={(updates) => setState((s) => ({ ...s, ...updates }))}
          />
        )}
        {step === 3 && (
          <StepVariants
            variants={state.variants}
            onChange={(variants) => setState((s) => ({ ...s, variants }))}
          />
        )}
        {step === 4 && (
          <StepTargeting />
        )}
        {step === 5 && (
          <StepReview state={state} />
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="secondary"
            onClick={() => (step === 1 ? router.push("/experiments") : setStep((s) => s - 1))}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < STEPS.length ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={!canProceed()}
              icon={<FlaskConical className="w-3.5 h-3.5" />}
            >
              Create Experiment
            </Button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Test Type ---
function StepTestType({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (type: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-neutral-900">
        What do you want to test?
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {TEST_TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => onSelect(t.type)}
            className={cn(
              "card px-4 py-3.5 flex items-start gap-3 text-left transition-all",
              selected === t.type
                ? "border-brand-400 ring-1 ring-brand-400 bg-brand-50"
                : "hover:border-neutral-300"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                t.color
              )}
            >
              <t.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 mb-0.5">
                {t.label}
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {t.description}
              </p>
            </div>
            {selected === t.type && (
              <Check className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Step 2: Name & Goal ---
function StepNameGoal({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-neutral-900">
        Name your experiment
      </h2>
      <Card className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Experiment Name <span className="text-danger-500">*</span>
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Homepage Hero Image Test"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Hypothesis
          </label>
          <textarea
            value={state.hypothesis}
            onChange={(e) => onChange({ hypothesis: e.target.value })}
            placeholder="We believe that [change] will cause [metric] to improve because [reason]..."
            rows={3}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Primary Metric
          </label>
          <select
            value={state.primaryMetric}
            onChange={(e) => onChange({ primaryMetric: e.target.value })}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Traffic Allocation: {state.trafficAllocation}%
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={state.trafficAllocation}
            onChange={(e) =>
              onChange({ trafficAllocation: parseInt(e.target.value) })
            }
            className="w-full accent-brand-600"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Only {state.trafficAllocation}% of eligible visitors will be included
          </p>
        </div>
      </Card>
    </div>
  );
}

// --- Step 3: Variants ---
function StepVariants({
  variants,
  onChange,
}: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}) {
  const total = variants.reduce((s, v) => s + v.allocationPercent, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  const addVariant = () => {
    const idx = variants.length;
    const newVariant: VariantDraft = {
      key: `variant_${String.fromCharCode(96 + idx)}`,
      name: `Variant ${String.fromCharCode(64 + idx)}`,
      isControl: false,
      allocationPercent: 0,
      modifications: [],
    };
    // Redistribute allocations evenly
    const even = Math.floor(100 / (variants.length + 1));
    const updated = variants.map((v) => ({ ...v, allocationPercent: even }));
    const remainder = 100 - even * (variants.length + 1);
    if (updated[0]) updated[0].allocationPercent += remainder;
    onChange([...updated, { ...newVariant, allocationPercent: even }]);
  };

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    // Redistribute to remaining
    const even = Math.floor(100 / updated.length);
    const remainder = 100 - even * updated.length;
    const redistributed = updated.map((v, i) => ({
      ...v,
      allocationPercent: even + (i === 0 ? remainder : 0),
    }));
    onChange(redistributed);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">
          Configure Variants
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={addVariant}
          icon={<Plus className="w-3 h-3" />}
        >
          Add Variant
        </Button>
      </div>

      <div className="space-y-2">
        {variants.map((variant, index) => (
          <Card key={index} className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={variant.name}
                  onChange={(e) => {
                    const updated = [...variants];
                    if (updated[index]) updated[index].name = e.target.value;
                    onChange(updated);
                  }}
                  className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 flex-1"
                />
                {variant.isControl && (
                  <span className="text-xs bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                    Control
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-500 shrink-0">
                  Traffic:
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={variant.allocationPercent}
                  onChange={(e) => {
                    const updated = [...variants];
                    if (updated[index])
                      updated[index].allocationPercent = parseFloat(e.target.value) || 0;
                    onChange(updated);
                  }}
                  className="border border-neutral-200 rounded px-2 py-1 text-xs w-16 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-xs text-neutral-500">%</span>
              </div>
            </div>
            {!variant.isControl && (
              <button
                onClick={() => removeVariant(index)}
                className="p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </Card>
        ))}
      </div>

      {!isValid && (
        <p className="text-xs text-danger-600 font-medium">
          Traffic allocations must sum to 100% (currently {total.toFixed(0)}%)
        </p>
      )}
    </div>
  );
}

// --- Step 4: Targeting ---
function StepTargeting() {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-neutral-900">
        Targeting (Optional)
      </h2>
      <Card>
        <p className="text-sm text-neutral-500">
          By default, the experiment targets all visitors. You can add targeting
          rules to restrict to specific devices, countries, UTM sources, or cart
          conditions.
        </p>
        <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
          <p className="text-xs text-neutral-500">
            Advanced targeting rule builder — coming in the next phase. For now,
            all eligible visitors will be included.
          </p>
        </div>
      </Card>
    </div>
  );
}

// --- Step 5: Review ---
function StepReview({ state }: { state: WizardState }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-neutral-900">
        Review & Launch
      </h2>
      <Card>
        <dl className="space-y-3 text-sm">
          <ReviewItem label="Test Type" value={state.type.replace(/_/g, " ")} />
          <ReviewItem label="Name" value={state.name} />
          {state.hypothesis && (
            <ReviewItem label="Hypothesis" value={state.hypothesis} />
          )}
          <ReviewItem label="Primary Metric" value={state.primaryMetric.replace(/_/g, " ")} />
          <ReviewItem label="Traffic Allocation" value={`${state.trafficAllocation}%`} />
          <div>
            <dt className="text-neutral-500 mb-2">Variants</dt>
            <dd>
              <div className="space-y-1">
                {state.variants.map((v) => (
                  <div
                    key={v.key}
                    className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium text-neutral-900">
                      {v.name}
                      {v.isControl && (
                        <span className="ml-1.5 text-xs text-neutral-400">
                          (control)
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-500">{v.allocationPercent}%</span>
                  </div>
                ))}
              </div>
            </dd>
          </div>
        </dl>
      </Card>
      <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg">
        <p className="text-xs text-brand-700">
          The experiment will be created in <strong>DRAFT</strong> status. You
          can configure variant modifications and targeting before launching.
        </p>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900 text-right max-w-xs truncate">
        {value}
      </dd>
    </div>
  );
}
