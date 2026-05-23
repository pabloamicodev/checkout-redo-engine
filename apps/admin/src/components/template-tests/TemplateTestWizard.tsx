"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { UpgradePlanModal } from "@/components/ui/UpgradePlanModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#64748b";
const GRADIENT = "linear-gradient(135deg, #64748b 0%, #475569 100%)";

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Template Selection" },
  { label: "Variant Config" },
  { label: "Traffic" },
  { label: "Review" },
];

const STEP_TITLES = [
  "Define your experiment",
  "Choose a template to test",
  "Configure variants",
  "Set traffic allocation",
  "Review and create",
];

const STEP_DESCS = [
  "Name the experiment and write a hypothesis about what template change will improve your conversion rate.",
  "Select the page template you want to test. The control will use the current template.",
  "Define your control and variant groups, naming each variant clearly.",
  "Set how much traffic participates in this experiment.",
  "Review the complete configuration before creating the test.",
];

const TOTAL_STEPS = STEP_DEFS.length;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShopifyTheme {
  id: number;
  name: string;
  role: string;
  isPublished: boolean;
}

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocation: number;
  settings: Record<string, unknown>;
}

interface WizardState {
  name: string;
  hypothesis: string;
  templateId: string;
  selectedTemplateName: string;
  trafficAllocation: number;
  variants: VariantConfig[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 bg-white placeholder:text-neutral-400";
const inputFocusCls = "focus:ring-slate-400";

const textareaCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white resize-none placeholder:text-neutral-400";

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  templateId: "",
  selectedTemplateName: "",
  trafficAllocation: 100,
  variants: [
    { key: "control",   name: "Control (current template)", isControl: true,  allocation: 50, settings: {} },
    { key: "variant_a", name: "Variant A",                  isControl: false, allocation: 50, settings: {} },
  ],
};

// ---------------------------------------------------------------------------
// Step 1 — Setup
// ---------------------------------------------------------------------------

function StepSetup({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-6">
      <FormSection
        title="Test details"
        description="Give your test a clear name and hypothesis so your team understands its purpose at a glance."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required hint="Use a descriptive name that identifies the template and goal.">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={`${inputCls} ${inputFocusCls}`}
              placeholder="Template A/B Test"
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
              className={textareaCls}
              placeholder="e.g. A new page template will improve CVR by testing a different layout structure"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Template Selection
// ---------------------------------------------------------------------------

function StepTemplateSelection({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const [themes, setThemes] = useState<ShopifyTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch("/api/shopify/themes")
      .then((r) => r.json())
      .then((data: { themes?: ShopifyTheme[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setThemes(data.themes ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Failed to load themes");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <FormSection
        title="Theme gallery"
        description="Select the theme you want to test against. The control will use the currently published theme."
        accent={ACCENT}
      >
        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center text-neutral-400">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            <span className="text-sm">Loading themes…</span>
          </div>
        )}

        {fetchError && (
          <InlineAlert variant="danger" title="Could not load themes">
            {fetchError}
          </InlineAlert>
        )}

        {!loading && !fetchError && themes.length === 0 && (
          <InlineAlert variant="info">No themes found in this store.</InlineAlert>
        )}

        {!loading && !fetchError && themes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {themes.map((theme) => {
              const isSelected = state.templateId === String(theme.id);
              return (
                <div
                  key={theme.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer"
                  style={{
                    borderColor: isSelected ? ACCENT : "#e5e7eb",
                    background: isSelected ? `${ACCENT}0a` : "#ffffff",
                  }}
                  onClick={() => onChange({ templateId: String(theme.id), selectedTemplateName: theme.name })}
                >
                  {/* Thumbnail placeholder */}
                  <div className="w-12 h-16 rounded-lg flex items-center justify-center text-[10px] font-bold border bg-neutral-100 text-neutral-500 border-neutral-200 relative">
                    {theme.name.slice(0, 2).toUpperCase()}
                    {theme.isPublished && (
                      <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-green-500 text-white rounded-full px-1 py-0.5 leading-none">
                        LIVE
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-neutral-700 text-center leading-tight">{theme.name}</span>
                  <button
                    type="button"
                    className="text-[11px] px-3 py-1 rounded-md font-medium transition-colors"
                    style={{
                      background: isSelected ? ACCENT : "#f3f4f6",
                      color: isSelected ? "#fff" : "#6b7280",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({ templateId: String(theme.id), selectedTemplateName: theme.name });
                    }}
                  >
                    {isSelected ? "Selected" : "Select"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!state.templateId && !loading && (
          <InlineAlert variant="info">
            Select a theme to test against your current published layout.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Variant Config
// ---------------------------------------------------------------------------

function StepVariantConfig({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  function updateVariant(index: number, patch: Partial<VariantConfig>) {
    onChange({ variants: state.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  }

  function addVariant() {
    const letter = String.fromCharCode(64 + state.variants.filter(v => !v.isControl).length + 1);
    const even = parseFloat((100 / (state.variants.length + 1)).toFixed(1));
    const rem = parseFloat((100 - even * state.variants.length).toFixed(1));
    onChange({
      variants: [
        ...state.variants.map((v, i) => ({ ...v, allocation: i === state.variants.length - 1 ? rem : even })),
        {
          key: `variant_${letter.toLowerCase()}`,
          name: `Variant ${letter}`,
          isControl: false,
          allocation: even,
          settings: {},
        },
      ],
    });
  }

  function removeVariant(index: number) {
    if (state.variants.length <= 2) return;
    onChange({ variants: state.variants.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">
      <FormSection
        title="Variants"
        description="Each variant can be named and optionally include settings that get passed to the runtime."
        accent={ACCENT}
      >
        <div className="space-y-3">
          {state.variants.map((v, vi) => (
            <div
              key={v.key}
              className="border border-neutral-200 rounded-xl overflow-hidden bg-white"
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                {v.isControl ? (
                  <span className="text-[10px] font-bold tracking-wide uppercase bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full shrink-0">
                    Control
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full text-white shrink-0"
                    style={{ background: ACCENT }}
                  >
                    Variant
                  </span>
                )}
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(vi, { name: e.target.value })}
                  className="flex-1 text-sm font-medium border-0 focus:outline-none bg-transparent placeholder:text-neutral-400"
                  placeholder={v.isControl ? "Control" : "Variant name"}
                />
                {!v.isControl && state.variants.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(vi)}
                    className="shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="px-4 py-3">
                <FormField
                  label="Settings (JSON, optional)"
                  hint="Override settings that will be passed to this variant's template."
                >
                  <textarea
                    rows={3}
                    value={Object.keys(v.settings).length > 0 ? JSON.stringify(v.settings, null, 2) : ""}
                    onChange={(e) => {
                      try {
                        const parsed = e.target.value.trim() ? JSON.parse(e.target.value) as Record<string, unknown> : {};
                        updateVariant(vi, { settings: parsed });
                      } catch {
                        // ignore parse errors while typing
                      }
                    }}
                    className="w-full text-xs font-mono border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-neutral-950 text-emerald-300 resize-y"
                    placeholder={`{\n  "templateHandle": "my-template"\n}`}
                  />
                </FormField>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-slate-300 hover:text-slate-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Traffic Allocation
// ---------------------------------------------------------------------------

function StepTraffic({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const allocVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocation,
  }));

  function handleAllocChange(updated: AllocationVariant[]) {
    onChange({
      variants: state.variants.map((v, i) => ({
        ...v,
        allocation: updated[i]?.allocationPercent ?? v.allocation,
      })),
    });
  }

  const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  return (
    <div className="space-y-6">
      <FormSection
        title="Overall traffic"
        description="Set the percentage of all visitors who will be enrolled in this test."
        accent={ACCENT}
      >
        <FormField
          label="Traffic allocation (%)"
          hint="Visitors outside this percentage see the original template unchanged."
        >
          <input
            type="number"
            min={1}
            max={100}
            value={state.trafficAllocation}
            onChange={(e) =>
              onChange({ trafficAllocation: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)) })
            }
            className="w-28 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Variant split"
        description="Distribute traffic between your variants. Must total exactly 100%."
        accent={ACCENT}
      >
        <VariantAllocationEditor
          variants={allocVariants}
          onChange={handleAllocChange}
          accentHex={ACCENT}
        />
        {!allocOk && (
          <InlineAlert variant="danger" className="mt-3">
            Total allocation is {total.toFixed(1)}% — must equal 100% before continuing.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Review
// ---------------------------------------------------------------------------

function StepReview({
  state,
  onSubmit,
  saving,
}: {
  state: WizardState;
  onSubmit: () => void;
  saving: boolean;
}) {
  const hasBlockers = !state.name.trim();

  const checks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Test has a name",
      status: state.name.trim() ? "pass" : "block",
      detail: state.name.trim() ? undefined : "Go back to Setup and add a test name.",
    },
    {
      id: "template",
      label: "Template selected",
      status: state.templateId ? "pass" : "warn",
      detail: state.templateId
        ? `Testing theme: ${state.selectedTemplateName}`
        : "No theme selected — test will only measure traffic allocation without a template change.",
    },
    {
      id: "variants",
      label: "At least 2 variants configured",
      status: state.variants.length >= 2 ? "pass" : "block",
    },
    {
      id: "allocation",
      label: "Variant allocation totals 100%",
      status: Math.abs(state.variants.reduce((s, v) => s + v.allocation, 0) - 100) < 0.1 ? "pass" : "block",
      detail: "Adjust allocations in the Traffic step.",
    },
    {
      id: "info-draft",
      label: "Test will be saved as DRAFT",
      status: "info",
      detail: "Activate it from the test detail page when you are ready to start collecting data.",
    },
    {
      id: "info-theme",
      label: "Template tests affect all pages",
      status: "info",
      detail: "The variant theme renders on all pages for enrolled visitors. Test thoroughly in preview before activating.",
    },
  ];

  return (
    <div className="space-y-6">
      <FormSection
        title="Test summary"
        description="Review all configuration before creating the test."
        accent={ACCENT}
      >
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
          {[
            { label: "Name",          value: state.name || "—" },
            { label: "Hypothesis",    value: state.hypothesis || "—" },
            { label: "Template",      value: state.selectedTemplateName || "None selected" },
            { label: "Variants",      value: `${state.variants.length} (${state.variants.filter(v => !v.isControl).length} treatment${state.variants.filter(v => !v.isControl).length !== 1 ? "s" : ""})` },
            { label: "Traffic",       value: `${state.trafficAllocation}% of visitors` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-4 px-4 py-2.5 bg-white">
              <span className="w-28 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
              <span className="text-sm text-neutral-900 flex-1">{value}</span>
            </div>
          ))}
        </div>
      </FormSection>

      <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={hasBlockers || saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          style={{
            background: hasBlockers || saving ? "#e5e7eb" : GRADIENT,
            boxShadow: hasBlockers || saving ? "none" : "0 4px 14px #64748b33",
          }}
        >
          {saving ? "Creating…" : "Create Template Test"}
        </button>
      </div>

      <p className="text-xs text-center text-neutral-400">
        The test will be saved as <strong>DRAFT</strong> — activate it from the test detail page when ready.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export function TemplateTestWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  function patch(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  const navSteps: WizardStep[] = STEP_DEFS.map((s, i) => ({
    label: s.label,
    status: i < step ? "complete" : i === step ? "active" : "pending",
  }));

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
      return Math.abs(total - 100) < 0.1;
    }
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
      if (Math.abs(total - 100) >= 0.1) return `Allocation totals ${total.toFixed(1)}%`;
    }
    return undefined;
  }

  function handleBack() {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  function handleNext() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/template-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          templateId: state.templateId || undefined,
          trafficAllocation: state.trafficAllocation,
          variants: state.variants.map((v) => ({
            name: v.name,
            isControl: v.isControl,
            allocation: v.allocation,
            settings: Object.keys(v.settings).length > 0 ? v.settings : undefined,
          })),
        }),
      });

      if (!res.ok) {
        if (res.status === 402) { setShowUpgradeModal(true); setSaving(false); return; }
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create test");
      }

      const created = (await res.json()) as { id: string };
      router.push(`/template-tests/${created.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <>
    <UpgradePlanModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} limitType="running experiments" />
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: `${ACCENT}0a` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${ACCENT}18` }}
          >
            <span className="text-base" style={{ color: ACCENT }}>&#9647;</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Template Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test different page templates to find the layout that converts best.
          </p>
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={navSteps}
            currentStep={step}
            accentHex={ACCENT}
            onStepClick={(i) => {
              if (i < step) setStep(i);
            }}
          />
        </div>
        <div className="p-3 border-t border-neutral-50">
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Template variants are served at the page level — no DOM manipulation required.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: ACCENT }}
          >
            Step {step + 1} of {TOTAL_STEPS}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-2xl">
            {step === 0 && <StepSetup state={state} onChange={patch} />}
            {step === 1 && <StepTemplateSelection state={state} onChange={patch} />}
            {step === 2 && <StepVariantConfig state={state} onChange={patch} />}
            {step === 3 && <StepTraffic state={state} onChange={patch} />}
            {step === 4 && (
              <StepReview state={state} onSubmit={handleSubmit} saving={saving} />
            )}

            {submitError && (
              <div className="mt-6">
                <InlineAlert variant="danger" title="Failed to create test">
                  {submitError}
                </InlineAlert>
              </div>
            )}
          </div>
        </div>

        {/* Sticky bottom actions */}
        {!isLastStep && (
          <StickyFormActions
            step={step}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onNext={handleNext}
            canContinue={canAdvance()}
            isLastStep={false}
            isSubmitting={saving}
            accentHex={ACCENT}
            blockingIssue={blockingIssue()}
          />
        )}
      </div>
    </div>
    </>
  );
}
