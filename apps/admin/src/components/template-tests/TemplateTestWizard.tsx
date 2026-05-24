"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, LayoutGrid, FileText, BookOpen, Home, ShoppingCart,
  RefreshCw, ExternalLink, CheckCircle2, Plus, AlertTriangle,
  ChevronRight, Layers, Eye, Zap,
} from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { UpgradePlanModal } from "@/components/ui/UpgradePlanModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#ea580c";
const GRADIENT = "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)";
const SOFT_BG = "rgba(234,88,12,0.06)";

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Page type" },
  { label: "Templates" },
  { label: "Traffic" },
  { label: "Review" },
];

const STEP_TITLES = [
  "Name your experiment",
  "Which page do you want to test?",
  "Pick the templates to compare",
  "Set traffic allocation",
  "Review and create",
];

const STEP_DESCS = [
  "Give your test a clear name so your team knows what you're testing and why.",
  "Template tests let you try two different page layouts side by side. Choose the page type first.",
  "Select the current template (control) and the alternate template you want to test against it.",
  "Set how much of your traffic participates, and how it splits between the two templates.",
  "Review the complete setup before saving the test as a draft.",
];

const TOTAL_STEPS = STEP_DEFS.length;

// ─── Page types ───────────────────────────────────────────────────────────────

const PAGE_TYPES = [
  {
    value: "product",
    label: "Product Page",
    description: "Test different layouts for your product detail pages",
    icon: ShoppingBag,
    example: "e.g. compare a 2-column vs 3-column product layout",
  },
  {
    value: "collection",
    label: "Collection Page",
    description: "Test different layouts for your product listing pages",
    icon: LayoutGrid,
    example: "e.g. grid view vs list view for collections",
  },
  {
    value: "page",
    label: "Custom Page",
    description: "Test different layouts for pages like About, FAQ, or Landing pages",
    icon: FileText,
    example: "e.g. long-form vs short-form landing page",
  },
  {
    value: "article",
    label: "Blog Article",
    description: "Test different layouts for individual blog posts",
    icon: BookOpen,
    example: "e.g. sidebar vs no-sidebar article layout",
  },
  {
    value: "index",
    label: "Home Page",
    description: "Test different home page designs",
    icon: Home,
    example: "e.g. hero-first vs product-first home layout",
  },
  {
    value: "cart",
    label: "Cart Page",
    description: "Test different cart page layouts",
    icon: ShoppingCart,
    example: "e.g. compact vs expanded cart design",
  },
] as const;

type PageTypeValue = (typeof PAGE_TYPES)[number]["value"];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageTemplate {
  handle: string;
  name: string;
  isDefault: boolean;
  key: string;
  updatedAt: string;
}

interface ActiveTheme {
  id: number;
  name: string;
}

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocation: number;
  templateHandle: string;
  templateName: string;
}

interface WizardState {
  name: string;
  hypothesis: string;
  pageType: PageTypeValue | "";
  trafficAllocation: number;
  variants: VariantConfig[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 bg-white placeholder:text-neutral-400";
const inputFocusCls = "focus:ring-orange-400";
const textareaCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-none placeholder:text-neutral-400";

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  pageType: "",
  trafficAllocation: 50,
  variants: [
    { key: "control",   name: "Control",   isControl: true,  allocation: 50, templateHandle: "", templateName: "" },
    { key: "variant_a", name: "Variant A", isControl: false, allocation: 50, templateHandle: "", templateName: "" },
  ],
};

// ─── Step 1 — Setup ───────────────────────────────────────────────────────────

function StepSetup({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ background: SOFT_BG, border: `1px solid ${ACCENT}20` }}
      >
        <Layers className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ACCENT }} />
        <div>
          <p className="text-sm font-medium text-neutral-800">What is a template test?</p>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Shopify themes can have multiple page designs — for example, two different product page layouts.
            A template test shows each design to a different group of visitors and measures which one generates more sales.
            No developer skills required — just pick two templates and set your traffic split.
          </p>
        </div>
      </div>

      <FormSection
        title="Test details"
        description="Give your test a clear name and describe what you expect to happen."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required hint="Be specific — e.g. 'Product Page: Compact vs Detailed Layout'">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={`${inputCls} ${inputFocusCls}`}
              placeholder="Product Page Template A/B Test"
              autoFocus
            />
          </FormField>

          <FormField
            label="Hypothesis"
            hint="What do you expect to happen and why? A good hypothesis makes results easier to act on."
          >
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className={textareaCls}
              placeholder="e.g. The compact product layout will increase add-to-cart rate by reducing distractions above the fold."
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ─── Step 2 — Page type ───────────────────────────────────────────────────────

function StepPageType({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-6">
      <FormSection
        title="Choose the page type"
        description="Template tests run on a specific type of page. Pick the page you want to improve first."
        accent={ACCENT}
      >
        <div className="grid grid-cols-2 gap-3">
          {PAGE_TYPES.map(({ value, label, description, icon: Icon, example }) => {
            const isSelected = state.pageType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  onChange({
                    pageType: value,
                    // Reset template selections when page type changes
                    variants: DEFAULT_STATE.variants.map((v) => ({ ...v })),
                  })
                }
                className="text-left p-4 rounded-xl border-2 transition-all hover:border-orange-200 group"
                style={{
                  borderColor: isSelected ? ACCENT : "#e5e7eb",
                  background: isSelected ? `${ACCENT}08` : "#fff",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                    style={{
                      background: isSelected ? `${ACCENT}18` : "#f3f4f6",
                      color: isSelected ? ACCENT : "#9ca3af",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{label}</p>
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{description}</p>
                    <p className="text-[10px] text-neutral-400 mt-1 italic">{example}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!state.pageType && (
          <InlineAlert variant="info">
            Select a page type to continue. The templates available will be fetched from your active Shopify theme.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ─── Step 3 — Template selection ──────────────────────────────────────────────

function StepTemplates({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTemplates = useCallback(() => {
    if (!state.pageType) return;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/shopify/page-templates?pageType=${state.pageType}`)
      .then((r) => r.json())
      .then((data: { templates?: PageTemplate[]; activeTheme?: ActiveTheme; error?: string }) => {
        if (data.error) throw new Error(data.error);
        const tpl = data.templates ?? [];
        setTemplates(tpl);
        setActiveTheme(data.activeTheme ?? null);

        // Auto-select default template as control if not yet selected
        const defaultTpl = tpl.find((t) => t.isDefault);
        if (defaultTpl && !state.variants[0]?.templateHandle) {
          onChange({
            variants: state.variants.map((v, i) =>
              i === 0
                ? { ...v, name: "Control (current)", templateHandle: defaultTpl.handle, templateName: defaultTpl.name }
                : v
            ),
          });
        }
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Could not load templates");
      })
      .finally(() => setLoading(false));
  }, [state.pageType, state.variants, onChange]);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pageType]);

  const pageTypeLabel = PAGE_TYPES.find((p) => p.value === state.pageType)?.label ?? state.pageType;
  const controlVariant = state.variants.find((v) => v.isControl)!;
  const treatmentVariant = state.variants.find((v) => !v.isControl)!;

  function setVariantTemplate(isControl: boolean, tpl: PageTemplate) {
    onChange({
      variants: state.variants.map((v) =>
        v.isControl === isControl
          ? { ...v, templateHandle: tpl.handle, templateName: tpl.name }
          : v
      ),
    });
  }

  function addVariant() {
    if (state.variants.length >= 4) return;
    const letter = String.fromCharCode(65 + state.variants.filter((v) => !v.isControl).length);
    onChange({
      variants: [
        ...state.variants,
        { key: `variant_${letter.toLowerCase()}`, name: `Variant ${letter}`, isControl: false, allocation: 0, templateHandle: "", templateName: "" },
      ],
    });
  }

  const hasMultipleTemplates = templates.length >= 2;

  return (
    <div className="space-y-6">
      {/* Active theme indicator */}
      {activeTheme && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Fetching {pageTypeLabel} templates from <strong className="text-neutral-700">{activeTheme.name}</strong>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 justify-center text-neutral-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading templates from your active theme…</span>
        </div>
      )}

      {fetchError && (
        <div className="space-y-3">
          <InlineAlert variant="danger" title="Could not load templates">
            {fetchError}
          </InlineAlert>
          <button
            type="button"
            onClick={fetchTemplates}
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !fetchError && templates.length === 0 && state.pageType && (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 px-6 py-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto">
            <Layers className="w-5 h-5 text-neutral-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-700">
              Only one {pageTypeLabel} template found
            </p>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
              To run a template test, you need at least two templates for this page type. Create an alternate template in your Shopify theme editor.
            </p>
          </div>
          <a
            href="https://help.shopify.com/en/manual/online-store/themes/theme-structure/templates"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            Learn how to create an alternate template <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {!loading && !fetchError && hasMultipleTemplates && (
        <>
          {/* Control */}
          <FormSection
            title="Control — your current layout"
            description="The control is what visitors see today. This is your baseline for comparison."
            accent="#6b7280"
          >
            <TemplatePickerCard
              description="Visitors in the control group will see this template — usually your default layout."
              templates={templates}
              selectedHandle={controlVariant.templateHandle}
              onSelect={(tpl) => setVariantTemplate(true, tpl)}
              accentColor="#6b7280"
              badgeLabel="Control"
              excludeHandle={treatmentVariant.templateHandle}
            />
          </FormSection>

          {/* Variant(s) */}
          {state.variants.filter((v) => !v.isControl).map((v, vi) => {
            const variantIndex = state.variants.indexOf(v);
            return (
              <FormSection
                key={v.key}
                title={`Variant ${String.fromCharCode(65 + vi)} — your challenger`}
                description="Visitors in the variant group will see this template instead of the control."
                accent={ACCENT}
              >
                <TemplatePickerCard
                  description="Choose the alternate template you want to test. It should be meaningfully different from the control."
                  templates={templates}
                  selectedHandle={v.templateHandle}
                  onSelect={(tpl) => {
                    onChange({
                      variants: state.variants.map((sv, si) =>
                        si === variantIndex
                          ? { ...sv, templateHandle: tpl.handle, templateName: tpl.name }
                          : sv
                      ),
                    });
                  }}
                  accentColor={ACCENT}
                  badgeLabel={`Variant ${String.fromCharCode(65 + vi)}`}
                  excludeHandle={controlVariant.templateHandle}
                />
              </FormSection>
            );
          })}

          {state.variants.length < 4 && templates.length > 2 && (
            <button
              type="button"
              onClick={addVariant}
              className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-orange-300 hover:text-orange-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add another variant
            </button>
          )}

          <InlineAlert variant="info">
            <strong>How it works:</strong> When a visitor lands on a {pageTypeLabel.toLowerCase()} page,
            MarginLab assigns them to a group and serves the template for that group for the rest of their session.
            The same visitor always sees the same template.
          </InlineAlert>
        </>
      )}
    </div>
  );
}

// ─── Template picker card ─────────────────────────────────────────────────────

function TemplatePickerCard({
  description,
  templates,
  selectedHandle,
  onSelect,
  accentColor,
  badgeLabel,
  excludeHandle,
}: {
  description: string;
  templates: PageTemplate[];
  selectedHandle: string;
  onSelect: (tpl: PageTemplate) => void;
  accentColor: string;
  badgeLabel: string;
  excludeHandle?: string;
}) {
  const available = templates.filter((t) => t.handle !== excludeHandle);

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">{description}</p>
      <div className="space-y-2">
        {available.map((tpl) => {
          const isSelected = selectedHandle === tpl.handle;
          return (
            <button
              key={tpl.handle}
              type="button"
              onClick={() => onSelect(tpl)}
              className="w-full text-left p-3.5 rounded-xl border-2 transition-all"
              style={{
                borderColor: isSelected ? accentColor : "#e5e7eb",
                background: isSelected ? `${accentColor}0a` : "#fff",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                  style={{
                    background: isSelected ? `${accentColor}15` : "#f9fafb",
                    borderColor: isSelected ? `${accentColor}30` : "#e5e7eb",
                  }}
                >
                  <Layers
                    className="w-3.5 h-3.5"
                    style={{ color: isSelected ? accentColor : "#9ca3af" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-neutral-900">{tpl.name}</p>
                    {tpl.isDefault && (
                      <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        Default
                      </span>
                    )}
                    {isSelected && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-white"
                        style={{ background: accentColor }}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{tpl.key}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 4 — Traffic ─────────────────────────────────────────────────────────

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
        title="Overall traffic participation"
        description="What percentage of your store visitors will be enrolled in this test?"
        accent={ACCENT}
      >
        <FormField
          label="Traffic participation (%)"
          hint="Visitors not enrolled see your current template as usual. Start with 50–100% for faster results."
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              value={state.trafficAllocation}
              onChange={(e) =>
                onChange({ trafficAllocation: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)) })
              }
              className="w-24 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <span className="text-sm text-neutral-500">% of visitors</span>
          </div>
        </FormField>

        {state.trafficAllocation < 20 && (
          <InlineAlert variant="warning">
            Low traffic allocation means slower results. We recommend at least 50% for template tests to get statistically significant data within a reasonable time.
          </InlineAlert>
        )}
      </FormSection>

      <FormSection
        title="Split between templates"
        description="How should traffic be divided between the control and variant templates?"
        accent={ACCENT}
      >
        <VariantAllocationEditor
          variants={allocVariants}
          onChange={handleAllocChange}
          accentHex={ACCENT}
        />
        {!allocOk && (
          <InlineAlert variant="danger" className="mt-3">
            The split must total exactly 100% — currently {total.toFixed(1)}%.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ─── Step 5 — Review ──────────────────────────────────────────────────────────

function StepReview({
  state,
  onSubmit,
  saving,
}: {
  state: WizardState;
  onSubmit: () => void;
  saving: boolean;
}) {
  const pageTypeLabel = PAGE_TYPES.find((p) => p.value === state.pageType)?.label ?? state.pageType;
  const controlVariant = state.variants.find((v) => v.isControl)!;
  const treatmentVariants = state.variants.filter((v) => !v.isControl);
  const total = state.variants.reduce((s, v) => s + v.allocation, 0);

  const checks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Test has a name",
      status: state.name.trim() ? "pass" : "block",
      detail: state.name.trim() ? undefined : "Add a test name in the Setup step.",
    },
    {
      id: "pageType",
      label: "Page type selected",
      status: state.pageType ? "pass" : "block",
      detail: state.pageType ? `Testing ${pageTypeLabel} templates` : "Select a page type.",
    },
    {
      id: "controlTemplate",
      label: "Control template selected",
      status: controlVariant.templateHandle ? "pass" : "block",
      detail: controlVariant.templateHandle ? `Control: ${controlVariant.templateName}` : "Select a control template in the Templates step.",
    },
    {
      id: "variantTemplate",
      label: "Variant template selected",
      status: treatmentVariants.every((v) => v.templateHandle) ? "pass" : "block",
      detail: treatmentVariants.every((v) => v.templateHandle)
        ? treatmentVariants.map((v) => `Variant: ${v.templateName}`).join(", ")
        : "Select a template for each variant in the Templates step.",
    },
    {
      id: "allocation",
      label: "Traffic split totals 100%",
      status: Math.abs(total - 100) < 0.1 ? "pass" : "block",
      detail: "Adjust the split in the Traffic step.",
    },
    {
      id: "draft-info",
      label: "Test saves as Draft — activate when ready",
      status: "info",
      detail: "You can activate this test from the test detail page whenever you're ready to start collecting data.",
    },
  ];

  const hasBlockers = checks.some((c) => c.status === "block");

  return (
    <div className="space-y-6">
      {/* Summary table */}
      <FormSection
        title="Test summary"
        description="Everything looks good? Create the test as a draft, then activate it when you're ready."
        accent={ACCENT}
      >
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
          {[
            { label: "Test name", value: state.name || "—" },
            { label: "Hypothesis", value: state.hypothesis || "—" },
            { label: "Page type", value: pageTypeLabel || "—" },
            { label: "Control", value: controlVariant.templateHandle ? `${controlVariant.templateName} (${controlVariant.templateHandle})` : "—" },
            ...treatmentVariants.map((v, i) => ({
              label: `Variant ${String.fromCharCode(65 + i)}`,
              value: v.templateHandle ? `${v.templateName} (${v.templateHandle})` : "—",
            })),
            { label: "Traffic", value: `${state.trafficAllocation}% of visitors` },
            { label: "Split", value: state.variants.map((v) => `${v.allocation}% ${v.isControl ? "Control" : v.name}`).join(", ") },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-4 px-4 py-2.5 bg-white">
              <span className="w-28 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
              <span className="text-sm text-neutral-800 flex-1 break-words">{value}</span>
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
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: hasBlockers || saving ? "#e5e7eb" : GRADIENT,
            boxShadow: hasBlockers || saving ? "none" : `0 4px 14px ${ACCENT}40`,
            color: hasBlockers || saving ? "#9ca3af" : "#fff",
          }}
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" /> Create Template Test
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

function TemplatePreviewPanel({ state, step }: { state: WizardState; step: number }) {
  const pageTypeLabel = PAGE_TYPES.find((p) => p.value === state.pageType)?.label;
  const controlVariant = state.variants.find((v) => v.isControl)!;
  const treatmentVariants = state.variants.filter((v) => !v.isControl);
  const total = state.variants.reduce((s, v) => s + v.allocation, 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  const completedSteps = [
    step > 0 && state.name.trim().length > 0,
    step > 1 && !!state.pageType,
    step > 2 && !!controlVariant.templateHandle && treatmentVariants.every((v) => v.templateHandle),
    step > 3 && allocOk,
  ];

  return (
    <aside
      className="hidden xl:flex w-64 shrink-0 flex-col border-l border-neutral-100 bg-white overflow-y-auto"
    >
      <div className="px-4 pt-5 pb-3 border-b border-neutral-50" style={{ background: SOFT_BG }}>
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `${ACCENT}20` }}
          >
            <Layers className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          </div>
          <p className="text-xs font-bold text-neutral-800">Template Test Preview</p>
        </div>
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Configuration summary updates as you fill in each step.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Setup progress</p>
            <p className="text-[10px] font-bold" style={{ color: ACCENT }}>
              {completedSteps.filter(Boolean).length}/{completedSteps.length}
            </p>
          </div>
          <div className="flex gap-1">
            {completedSteps.map((done, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: done ? ACCENT : "#e5e7eb" }}
              />
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Test name</p>
          <p className="text-xs text-neutral-700 font-medium">
            {state.name.trim() || <span className="text-neutral-300 italic">Not set yet</span>}
          </p>
        </div>

        {/* Page type */}
        {state.pageType && (
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Page type</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-neutral-800">{pageTypeLabel}</p>
            </div>
          </div>
        )}

        {/* Template comparison */}
        {(controlVariant.templateHandle || treatmentVariants.some((v) => v.templateHandle)) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Templates</p>
            {/* Control */}
            <div className="p-2.5 rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded uppercase">
                  Control
                </span>
              </div>
              <p className="text-xs font-medium text-neutral-700">
                {controlVariant.templateName || <span className="text-neutral-300 italic">Not selected</span>}
              </p>
              {controlVariant.templateHandle && (
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{controlVariant.templateHandle}</p>
              )}
            </div>

            {/* Variants */}
            {treatmentVariants.map((v, vi) => (
              <div key={v.key} className="p-2.5 rounded-lg border overflow-hidden" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}04` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase text-white"
                    style={{ background: ACCENT }}
                  >
                    Variant {String.fromCharCode(65 + vi)}
                  </span>
                </div>
                <p className="text-xs font-medium text-neutral-700">
                  {v.templateName || <span className="text-neutral-300 italic">Not selected</span>}
                </p>
                {v.templateHandle && (
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{v.templateHandle}</p>
                )}
              </div>
            ))}

            {/* VS divider */}
            {controlVariant.templateHandle && treatmentVariants.some((v) => v.templateHandle) && (
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-px w-8 bg-neutral-200" />
                  <span className="text-[10px] font-bold text-neutral-400">VS</span>
                  <div className="h-px w-8 bg-neutral-200" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Traffic */}
        {step >= 3 && allocOk && (
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Traffic split</p>
            <div className="space-y-1.5">
              {state.variants.map((v) => (
                <div key={v.key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[10px] font-medium text-neutral-600">{v.isControl ? "Control" : v.name}</p>
                      <p className="text-[10px] font-bold" style={{ color: v.isControl ? "#6b7280" : ACCENT }}>
                        {v.allocation}%
                      </p>
                    </div>
                    <div className="h-1 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${v.allocation}%`,
                          background: v.isControl ? "#9ca3af" : GRADIENT,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="p-3 rounded-lg" style={{ background: SOFT_BG, border: `1px solid ${ACCENT}15` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Eye className="w-3 h-3" style={{ color: ACCENT }} />
            <p className="text-[10px] font-semibold" style={{ color: ACCENT }}>How it works</p>
          </div>
          <ul className="space-y-1">
            {[
              "Visitor lands on a page",
              "MarginLab assigns them to a template group",
              "They always see the same template",
              "You measure which converts better",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-neutral-400" />
                <p className="text-[10px] text-neutral-500 leading-relaxed">{step}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

export function TemplateTestWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const navSteps: WizardStep[] = STEP_DEFS.map((s, i) => ({
    label: s.label,
    status: i < step ? "complete" : i === step ? "active" : "pending",
  }));

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 1) return !!state.pageType;
    if (step === 2) {
      const control = state.variants.find((v) => v.isControl);
      const treatment = state.variants.find((v) => !v.isControl);
      return !!control?.templateHandle && !!treatment?.templateHandle;
    }
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
      return Math.abs(total - 100) < 0.1;
    }
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 1 && !state.pageType) return "Select a page type to continue";
    if (step === 2) {
      const control = state.variants.find((v) => v.isControl);
      const treatment = state.variants.find((v) => !v.isControl);
      if (!control?.templateHandle) return "Select a control template";
      if (!treatment?.templateHandle) return "Select a variant template";
    }
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
      if (Math.abs(total - 100) >= 0.1) return `Split totals ${total.toFixed(1)}% — must be 100%`;
    }
    return undefined;
  }

  const handleBack = useCallback(() => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }, [step, router]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const controlVariant = state.variants.find((v) => v.isControl)!;
      const res = await fetch("/api/template-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          templateId: controlVariant.templateHandle || undefined,
          trafficAllocation: state.trafficAllocation,
          variants: state.variants.map((v) => ({
            name: v.name,
            isControl: v.isControl,
            allocation: v.allocation,
            settings: v.templateHandle
              ? {
                  templateHandle: v.templateHandle,
                  templateName: v.templateName,
                  pageType: state.pageType,
                }
              : undefined,
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
  }, [state, router]);

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <>
      <UpgradePlanModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} limitType="running experiments" />
      <div className="flex h-full overflow-hidden bg-neutral-50">

        {/* LEFT SIDEBAR — step nav */}
        <aside className="hidden lg:flex w-52 shrink-0 bg-white border-r border-neutral-100 flex-col">
          <div className="px-4 pt-5 pb-4 border-b border-neutral-50" style={{ background: SOFT_BG }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${ACCENT}20` }}
            >
              <Layers className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <p className="text-xs font-bold text-neutral-800">Template Test</p>
            <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
              Test two different page layouts side by side. No code required.
            </p>
          </div>
          <div className="flex-1 p-3 overflow-auto">
            <WizardStepNav
              orientation="vertical"
              steps={navSteps}
              currentStep={step}
              accentHex={ACCENT}
              onStepClick={(i) => { if (i < step) setStep(i); }}
            />
          </div>
          <div className="p-3 border-t border-neutral-50">
            <div className="flex items-start gap-1.5 p-2 rounded-lg" style={{ background: SOFT_BG }}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: ACCENT }} />
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                Requires alternate templates to exist in your active Shopify theme.
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 max-w-2xl">
              {step === 0 && <StepSetup state={state} onChange={patch} />}
              {step === 1 && <StepPageType state={state} onChange={patch} />}
              {step === 2 && <StepTemplates state={state} onChange={patch} />}
              {step === 3 && <StepTraffic state={state} onChange={patch} />}
              {step === 4 && <StepReview state={state} onSubmit={handleSubmit} saving={saving} />}

              {submitError && (
                <div className="mt-6">
                  <InlineAlert variant="danger" title="Failed to create test">
                    {submitError}
                  </InlineAlert>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
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

        {/* RIGHT PREVIEW PANEL */}
        <TemplatePreviewPanel state={state} step={step} />
      </div>
    </>
  );
}
