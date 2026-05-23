"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, Palette } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKY = "#0ea5e9";
const ACCENT = SKY;
const GRADIENT = "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)";

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Theme Selection" },
  { label: "Variant Themes" },
  { label: "Traffic" },
  { label: "Risk Review" },
  { label: "Review" },
];

const STEP_TITLES = [
  "Define your experiment",
  "Select the control theme",
  "Configure variant themes",
  "Set traffic allocation",
  "Risk review — required",
  "Review and create",
];

const STEP_DESCS = [
  "Name the experiment and write a hypothesis about how a theme change will affect your conversion rate.",
  "The theme currently published will be used as control. Confirm the live theme below.",
  "Assign an unpublished Shopify theme to each treatment variant. MarginLab serves the correct theme per-visitor.",
  "Set the percentage of traffic that enters the experiment.",
  "Theme tests have global impact on every visitor's experience. Read each risk carefully before continuing.",
  "Review the complete configuration before creating the draft test.",
];

const TOTAL_STEPS = STEP_DEFS.length;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShopifyThemeOption {
  id: number;
  name: string;
  role: "main" | "unpublished" | "demo";
  isPublished: boolean;
  previewable: boolean;
  processing: boolean;
  updatedAt: string;
}

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocation: number;
  themeId: number | null;
  themeName: string;
}

interface WizardState {
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  variants: VariantConfig[];
  riskConfirmed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white placeholder:text-neutral-400";
const textareaCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white resize-none placeholder:text-neutral-400";

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  variants: [
    { key: "control",   name: "Control (live theme)", isControl: true,  allocation: 50, themeId: null, themeName: "" },
    { key: "variant_a", name: "Variant A",             isControl: false, allocation: 50, themeId: null, themeName: "" },
  ],
  riskConfirmed: false,
};

// ---------------------------------------------------------------------------
// Theme picker card
// ---------------------------------------------------------------------------

function ThemeCard({
  theme,
  selected,
  onSelect,
  disabled,
  badgeLabel,
}: {
  theme: ShopifyThemeOption;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  badgeLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={`text-left p-3.5 rounded-xl border-2 transition-all w-full ${
        disabled
          ? "opacity-50 cursor-not-allowed border-neutral-100 bg-neutral-50"
          : selected
            ? "border-sky-400 bg-sky-50"
            : "border-neutral-200 hover:border-neutral-300 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{theme.name}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Updated {new Date(theme.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {theme.isPublished && (
            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              LIVE
            </span>
          )}
          {badgeLabel && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-white"
              style={{ background: ACCENT }}
            >
              {badgeLabel}
            </span>
          )}
        </div>
      </div>
      {theme.processing && (
        <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" /> Theme is processing…
        </p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Setup
// ---------------------------------------------------------------------------

function StepSetup({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-6">
      <FormSection
        title="Test details"
        description="Give the test a clear name and a falsifiable hypothesis."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required hint="Describe what you are testing, e.g. 'Redesign vs Current Theme'.">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputCls}
              placeholder="Theme Redesign A/B Test"
            />
          </FormField>

          <FormField label="Hypothesis" hint="What do you expect to happen and why?">
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className={textareaCls}
              placeholder="e.g. The new minimalist theme will increase conversion rate by reducing visual noise on the product page."
            />
          </FormField>
        </div>
      </FormSection>

      <InlineAlert variant="warning">
        Theme tests impact every page of your store simultaneously. They require more careful planning than
        element-level content tests. Proceed only if you have a clear hypothesis.
      </InlineAlert>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Theme Selection (control — live theme)
// ---------------------------------------------------------------------------

function StepThemeSelection({
  themes,
  loadingThemes,
  themeError,
  state,
  onChange,
  onRefresh,
}: {
  themes: ShopifyThemeOption[];
  loadingThemes: boolean;
  themeError: string | null;
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
  onRefresh: () => void;
}) {
  const publishedTheme = themes.find((t) => t.isPublished);

  // Auto-select published theme as control on load
  useEffect(() => {
    if (publishedTheme && (state.variants[0]?.themeId ?? null) === null) {
      onChange({
        variants: state.variants.map((v, i) =>
          i === 0 ? { ...v, themeId: publishedTheme.id, themeName: publishedTheme.name } : v
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedTheme?.id]);

  return (
    <div className="space-y-6">
      <FormSection
        title="Control theme — the live theme"
        description="The control is always the theme currently published to your store. It cannot be changed here."
        accent={ACCENT}
      >
        {loadingThemes && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 py-6 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading themes from Shopify…
          </div>
        )}

        {themeError && (
          <div className="space-y-3">
            <InlineAlert variant="danger" title="Could not load themes">
              {themeError}
            </InlineAlert>
            <button
              type="button"
              onClick={onRefresh}
              className="text-sm text-zinc-600 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loadingThemes && !themeError && (
          <>
            {publishedTheme ? (
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{publishedTheme.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Currently published · Updated {new Date(publishedTheme.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`https://${typeof window !== "undefined" ? window.location.hostname.replace("admin.", "") : "your-store.myshopify.com"}/admin/themes/${publishedTheme.id}/editor`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                  >
                    Edit <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <InlineAlert variant="warning">No published theme found. Ensure your store has an active theme.</InlineAlert>
            )}

            <div className="mt-4">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                All themes ({themes.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {themes.map((t) => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    selected={state.variants[0]?.themeId === t.id}
                    onSelect={() => {}}
                    disabled={!t.isPublished}
                    badgeLabel={state.variants[0]?.themeId === t.id ? "Control" : undefined}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh theme list
            </button>
          </>
        )}
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Variant Themes
// ---------------------------------------------------------------------------

function StepVariantThemes({
  themes,
  loadingThemes,
  state,
  onChange,
}: {
  themes: ShopifyThemeOption[];
  loadingThemes: boolean;
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const treatmentVariants = state.variants.filter((v) => !v.isControl);
  const usedThemeIds = new Set(
    state.variants.filter((v) => !v.isControl && v.themeId !== null).map((v) => v.themeId)
  );
  const controlThemeId = state.variants.find((v) => v.isControl)?.themeId;
  const availableThemes = themes.filter(
    (t) => !t.isPublished && !t.processing
  );

  function setVariantTheme(variantKey: string, theme: ShopifyThemeOption | null) {
    onChange({
      variants: state.variants.map((v) =>
        v.key === variantKey
          ? { ...v, themeId: theme?.id ?? null, themeName: theme?.name ?? "" }
          : v
      ),
    });
  }

  return (
    <div className="space-y-6">
      <InlineAlert variant="info">
        Assign an <strong>unpublished</strong> Shopify theme to each variant. MarginLab will inject a
        per-visitor script that loads the correct theme's CSS and JS assets without changing which theme
        is published. The live theme is never touched during the experiment.
      </InlineAlert>

      {treatmentVariants.map((variant) => (
        <FormSection
          key={variant.key}
          title={variant.name}
          description={`Select which unpublished theme to serve for "${variant.name}".`}
          accent={ACCENT}
        >
          <FormField label="Variant name">
            <input
              type="text"
              value={variant.name}
              onChange={(e) =>
                onChange({
                  variants: state.variants.map((v) =>
                    v.key === variant.key ? { ...v, name: e.target.value } : v
                  ),
                })
              }
              className={inputCls}
            />
          </FormField>

          {loadingThemes ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading themes…
            </div>
          ) : availableThemes.length === 0 ? (
            <InlineAlert variant="warning">
              No unpublished themes found. Duplicate your live theme in Shopify and make edits before
              assigning it as a variant.
            </InlineAlert>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mt-3">
              {availableThemes.map((t) => {
                const alreadyUsed = usedThemeIds.has(t.id) && variant.themeId !== t.id;
                return (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    selected={variant.themeId === t.id}
                    onSelect={() => setVariantTheme(variant.key, t)}
                    disabled={alreadyUsed || t.id === controlThemeId}
                    badgeLabel={variant.themeId === t.id ? "Selected" : alreadyUsed ? "In use" : undefined}
                  />
                );
              })}
            </div>
          )}

          {variant.themeId && (
            <a
              href={`https://your-store.myshopify.com/admin/themes/${variant.themeId}/editor`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
            >
              Preview theme <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </FormSection>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Traffic
// ---------------------------------------------------------------------------

function StepTraffic({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const allocVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocation,
  }));

  const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  return (
    <div className="space-y-6">
      <InlineAlert variant="warning">
        Theme tests affect <strong>all pages</strong> simultaneously. Consider starting with a lower traffic
        percentage (e.g. 20–40%) until you confirm the variant theme behaves correctly in production.
      </InlineAlert>

      <FormSection title="Overall traffic" description="Percentage of visitors enrolled in the test." accent={ACCENT}>
        <FormField label="Traffic allocation (%)" hint="Visitors outside this percentage see the live theme unchanged.">
          <input
            type="number"
            min={1}
            max={100}
            value={state.trafficAllocation}
            onChange={(e) =>
              onChange({ trafficAllocation: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)) })
            }
            className="w-28 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </FormField>
      </FormSection>

      <FormSection title="Variant split" description="Distribute traffic between variants. Must total 100%." accent={ACCENT}>
        <VariantAllocationEditor
          variants={allocVariants}
          onChange={(updated) =>
            onChange({
              variants: state.variants.map((v, i) => ({
                ...v,
                allocation: updated[i]?.allocationPercent ?? v.allocation,
              })),
            })
          }
          accentHex={ACCENT}
        />
        {!allocOk && (
          <InlineAlert variant="danger" className="mt-3">
            Total is {total.toFixed(1)}% — must equal 100%.
          </InlineAlert>
        )}
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Risk Review
// ---------------------------------------------------------------------------

const RISKS = [
  {
    title: "Theme tests affect all pages globally",
    body: "Unlike content tests, a theme test changes the visual experience on every page of your store simultaneously for enrolled visitors.",
  },
  {
    title: "CSS/JS conflicts may cause broken layouts",
    body: "The variant theme's assets are injected alongside the published theme. Custom apps or scripts that depend on specific CSS selectors may behave unexpectedly.",
  },
  {
    title: "Slower page load during theme switching",
    body: "An extra CSS/JS bundle is loaded per-visitor to apply the variant theme's styles. Test with a real device before launching at full traffic.",
  },
  {
    title: "Manual theme publish will break the test",
    body: "If someone publishes a different theme via the Shopify admin while this test is running, the test assignment logic breaks. MarginLab listens to the themes/publish webhook and will auto-pause the test.",
  },
  {
    title: "Theme preview links bypass the experiment",
    body: "Using `?preview_theme_id=` preview URLs is for visual review only — preview sessions are not enrolled in the experiment and analytics will not be recorded.",
  },
];

function StepRiskReview({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Read before continuing</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Theme A/B tests have broader impact than other test types. Review each risk below before
            confirming you understand.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {RISKS.map((risk, i) => (
          <div key={i} className="border border-neutral-200 rounded-xl p-4 bg-white">
            <p className="text-sm font-semibold text-neutral-800">{risk.title}</p>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{risk.body}</p>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={state.riskConfirmed}
          onChange={(e) => onChange({ riskConfirmed: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded accent-sky-500 cursor-pointer"
        />
        <span className="text-sm text-neutral-700 leading-relaxed group-hover:text-neutral-900 transition-colors">
          I understand the risks above and confirm that the variant theme has been tested in a preview
          environment before activating this experiment.
        </span>
      </label>

      {!state.riskConfirmed && (
        <InlineAlert variant="info">
          You must confirm the risks above before you can proceed to the final review.
        </InlineAlert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Review
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
  const unassigned = state.variants.filter((v) => !v.isControl && !v.themeId);
  const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  const readinessChecks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Test name",
      status: state.name.trim() ? "pass" : "block",
      detail: state.name.trim() ? `"${state.name.trim()}"` : "A name is required before creating.",
    },
    {
      id: "risk",
      label: "Risk review confirmed",
      status: state.riskConfirmed ? "pass" : "block",
      detail: state.riskConfirmed
        ? "All theme test risks acknowledged."
        : "Go back to Risk Review and confirm you understand the risks.",
    },
    {
      id: "themes",
      label: "Variant themes assigned",
      status: unassigned.length === 0 ? "pass" : "block",
      detail: unassigned.length === 0
        ? "All treatment variants have themes assigned."
        : `${unassigned.length} variant${unassigned.length !== 1 ? "s" : ""} still need a theme.`,
    },
    {
      id: "allocation",
      label: "Traffic split totals 100%",
      status: allocOk ? "pass" : "block",
      detail: allocOk ? `${total.toFixed(1)}% — correctly distributed.` : `Currently ${total.toFixed(1)}%.`,
    },
    {
      id: "traffic-caution",
      label: "Traffic percentage",
      status: state.trafficAllocation > 60 ? "warn" : "pass",
      detail: state.trafficAllocation > 60
        ? `${state.trafficAllocation}% is high for a theme test. Consider starting at 20–40%.`
        : `${state.trafficAllocation}% of visitors enrolled — reasonable for a theme test.`,
    },
    {
      id: "draft",
      label: "Saved as DRAFT",
      status: "info",
      detail: "The test is created as a draft. Activate it from the detail page when ready.",
    },
  ];

  const hasBlockers = readinessChecks.some((c) => c.status === "block");

  return (
    <div className="space-y-6">
      <LaunchReadinessPanel checks={readinessChecks} accentHex={ACCENT} />

      <div className="bg-white rounded-xl border border-neutral-100 divide-y divide-neutral-100">
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Summary</p>
          <dl className="space-y-2.5">
            {[
              { label: "Name",       value: state.name || <span className="text-neutral-400 italic">Not set</span> },
              { label: "Hypothesis", value: state.hypothesis || <span className="text-neutral-400 italic">—</span> },
              { label: "Traffic",    value: `${state.trafficAllocation}% of visitors` },
              { label: "Risk",       value: state.riskConfirmed ? "✓ Confirmed" : <span className="text-red-500">✗ Not confirmed</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <dt className="text-xs text-neutral-500 shrink-0 w-28">{label}</dt>
                <dd className="text-xs font-medium text-neutral-800 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Variant Themes</p>
          <div className="space-y-1.5">
            {state.variants.map((v) => (
              <div key={v.key} className="flex items-start justify-between gap-4">
                <dt className="text-xs text-neutral-500 shrink-0 w-28 truncate">{v.name}</dt>
                <dd className="text-xs font-medium text-neutral-800 text-right truncate">
                  {v.isControl
                    ? <span className="text-emerald-600">{v.themeName || "Live theme"} (LIVE)</span>
                    : v.themeName
                      ? v.themeName
                      : <span className="text-red-500">No theme assigned</span>
                  }
                </dd>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={hasBlockers || saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          style={{
            background: hasBlockers || saving ? "#e5e7eb" : GRADIENT,
            color: hasBlockers || saving ? "#9ca3af" : "#fff",
            boxShadow: hasBlockers || saving ? "none" : "0 4px 14px #0ea5e933",
          }}
        >
          {saving ? "Creating…" : "Create Theme Test"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme Preview Panel (right column, sticky)
// ---------------------------------------------------------------------------

const THEME_STEP_LABELS = ["Setup", "Control", "Variants", "Traffic", "Risk"];

function ThemePreviewPanel({
  step,
  state,
  themes,
}: {
  step: number;
  state: WizardState;
  themes: ShopifyThemeOption[];
}) {
  const controlVariant = state.variants.find((v) => v.isControl);
  const treatmentVariants = state.variants.filter((v) => !v.isControl);
  const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  const completedSteps = [
    state.name.trim().length > 0,
    !!controlVariant?.themeId,
    treatmentVariants.every((v) => !!v.themeId),
    allocOk,
    state.riskConfirmed,
  ];

  return (
    <div className="space-y-3">
      {/* Theme configuration card */}
      <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b border-neutral-50" style={{ background: `${ACCENT}08` }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
            Theme Configuration
          </p>
        </div>
        <div className="px-3 py-3 space-y-2.5">
          {/* Control */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Control</p>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-emerald-800 truncate flex-1">
                {controlVariant?.themeName || "Live theme (auto-selected)"}
              </span>
              <span className="text-[9px] font-bold bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                LIVE
              </span>
            </div>
          </div>

          {/* Variant themes */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
              Variants ({treatmentVariants.length})
            </p>
            <div className="space-y-1.5">
              {treatmentVariants.map((v) => (
                <div
                  key={v.key}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                  style={{
                    borderColor: v.themeId ? `${ACCENT}40` : "#fca5a5",
                    background: v.themeId ? `${ACCENT}06` : "#fef2f2",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: v.themeId ? ACCENT : "#f87171" }}
                  />
                  <span className="text-xs font-medium text-neutral-700 truncate flex-1">
                    {v.themeName || <span className="text-red-400 italic">Not assigned</span>}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 text-white"
                    style={{ background: v.themeId ? ACCENT : "#f87171" }}
                  >
                    {v.name.replace("Variant ", "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Traffic split */}
      <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Traffic Split</p>
        </div>
        <div className="px-3 py-2.5 space-y-2">
          {state.variants.map((v) => (
            <div key={v.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-neutral-700 truncate max-w-[110px]">{v.name}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: v.isControl ? "#6b7280" : ACCENT }}>
                  {v.allocation.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${v.allocation}%`, background: v.isControl ? "#d1d5db" : GRADIENT }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk status */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
        style={{
          borderColor: state.riskConfirmed ? "#bbf7d0" : "#fde68a",
          background: state.riskConfirmed ? "#f0fdf4" : "#fffbeb",
        }}
      >
        <span className="text-base shrink-0">{state.riskConfirmed ? "✓" : "⚠"}</span>
        <p className="text-[10px] font-medium leading-snug" style={{ color: state.riskConfirmed ? "#166534" : "#92400e" }}>
          {state.riskConfirmed ? "Risk review confirmed" : "Risk review pending — required before launch"}
        </p>
      </div>

      {/* Readiness bar */}
      <div className="rounded-xl border border-neutral-100 bg-white px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">Readiness</p>
        <div className="flex items-center gap-1">
          {completedSteps.map((done, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-1.5 rounded-full transition-all duration-300"
                style={{ background: done ? ACCENT : "#e5e7eb" }}
              />
              <span className="text-[8px] text-neutral-400 truncate w-full text-center leading-none">
                {THEME_STEP_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export function ThemeTestWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live Shopify theme list
  const [themes, setThemes] = useState<ShopifyThemeOption[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const fetchThemes = useCallback(async () => {
    setLoadingThemes(true);
    setThemeError(null);
    try {
      const res = await fetch("/api/shopify/themes");
      const data = (await res.json()) as { themes?: ShopifyThemeOption[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load themes");
      setThemes(data.themes ?? []);
    } catch (err) {
      setThemeError(err instanceof Error ? err.message : "Failed to load themes");
    } finally {
      setLoadingThemes(false);
    }
  }, []);

  // Fetch themes on wizard mount
  useEffect(() => {
    void fetchThemes();
  }, [fetchThemes]);

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
    if (step === 4) return state.riskConfirmed;
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 3) {
      const total = state.variants.reduce((s, v) => s + (v.allocation || 0), 0);
      if (Math.abs(total - 100) >= 0.1) return `Allocation totals ${total.toFixed(1)}%`;
    }
    if (step === 4 && !state.riskConfirmed) return "Confirm the risks above to continue";
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
      const res = await fetch("/api/theme-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          trafficAllocation: state.trafficAllocation,
          variants: state.variants.map((v) => ({
            name: v.name,
            isControl: v.isControl,
            allocation: v.allocation,
            settings: v.themeId ? { themeId: v.themeId, themeName: v.themeName } : undefined,
          })),
        }),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create test");
      }

      const created = (await res.json()) as { id: string };
      showSuccess(`Theme test "${state.name}" created — activate it from the test detail page.`);
      router.push(`/theme-tests/${created.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-neutral-50" style={{ background: `${ACCENT}0a` }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${ACCENT}18` }}
          >
            <Palette className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <p className="text-xs font-bold text-neutral-800">Theme Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test complete Shopify themes — fonts, colors, spacing, and global design changes.
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
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Variant themes are served via per-visitor asset injection — the published theme is never changed.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: ACCENT }}>
            Step {step + 1} of {TOTAL_STEPS}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Two-column content area */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Main form */}
            <div className="flex-1 min-w-0">
              {step === 0 && <StepSetup state={state} onChange={patch} />}
              {step === 1 && (
                <StepThemeSelection
                  themes={themes}
                  loadingThemes={loadingThemes}
                  themeError={themeError}
                  state={state}
                  onChange={patch}
                  onRefresh={fetchThemes}
                />
              )}
              {step === 2 && (
                <StepVariantThemes
                  themes={themes}
                  loadingThemes={loadingThemes}
                  state={state}
                  onChange={patch}
                />
              )}
              {step === 3 && <StepTraffic state={state} onChange={patch} />}
              {step === 4 && <StepRiskReview state={state} onChange={patch} />}
              {step === 5 && <StepReview state={state} onSubmit={handleSubmit} saving={saving} />}

              {submitError && (
                <div className="mt-6">
                  <InlineAlert variant="danger" title="Failed to create test">{submitError}</InlineAlert>
                </div>
              )}
            </div>

            {/* Right preview panel — hidden on review step */}
            {!isLastStep && (
              <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
                <ThemePreviewPanel step={step} state={state} themes={themes} />
              </aside>
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
  );
}
