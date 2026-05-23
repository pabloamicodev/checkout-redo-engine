"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, type WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { VariantAllocationEditor, type AllocationVariant } from "@/components/experiments/VariantAllocationEditor";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#7c3aed";
const VIOLET = "#7c3aed";
const GRADIENT = "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)";

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Page Targeting" },
  { label: "Variants" },
  { label: "Content Changes" },
  { label: "Anti-flicker" },
  { label: "QA Checklist" },
  { label: "Review" },
];

const STEP_TITLES = [
  "Define your experiment",
  "Choose target pages",
  "Set up test groups",
  "Build content modifications",
  "Configure anti-flicker",
  "Pre-launch QA checklist",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the experiment and write a hypothesis about what content change will improve your metric.",
  "Specify which pages or URL patterns this experiment should run on.",
  "Define your control and variant groups with traffic allocation.",
  "Add DOM modifications for each non-control variant — text, images, CSS, or HTML changes.",
  "Anti-flicker prevents the original content from flashing before your variant loads.",
  "Confirm all technical and UX checks before launching to real visitors.",
  "Review the complete configuration and fix any blocking issues before creating the test.",
];

const TOTAL_STEPS = STEP_DEFS.length;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModificationType =
  | "replace_text"
  | "replace_image"
  | "hide_element"
  | "show_element"
  | "replace_link"
  | "inject_css"
  | "inject_js"
  | "html_insert";

type HtmlInsertPosition = "before" | "after" | "replace";

interface Modification {
  id: string;
  type: ModificationType;
  selector: string;
  // replace_text
  textValue?: string;
  // replace_image
  imageSrc?: string;
  // replace_link
  href?: string;
  // inject_css / inject_js
  code?: string;
  // html_insert
  html?: string;
  insertPosition?: HtmlInsertPosition;
}

interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  modifications: Modification[];
}

interface WizardState {
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  urlPattern: string;
  variants: VariantConfig[];
  antiFickerEnabled: boolean;
  antiFlickerTimeout: number;
  qaChecklist: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyModification(): Modification {
  return { id: uid(), type: "replace_text", selector: "" };
}

function emptyVariant(isControl: boolean, variantIndex: number): VariantConfig {
  const letter = String.fromCharCode(65 + variantIndex - 1); // A, B, C …
  return {
    key: isControl ? "control" : `variant_${letter.toLowerCase()}`,
    name: isControl ? "Control (original)" : `Variant ${letter}`,
    isControl,
    allocationPercent: 50,
    modifications: [],
  };
}

const MOD_LABELS: Record<ModificationType, { emoji: string; label: string }> = {
  replace_text:  { emoji: "📝", label: "Replace text" },
  replace_image: { emoji: "🖼", label: "Replace image" },
  hide_element:  { emoji: "👁", label: "Hide element" },
  show_element:  { emoji: "✨", label: "Show element" },
  replace_link:  { emoji: "🔗", label: "Replace link URL" },
  inject_css:    { emoji: "🎨", label: "Inject CSS" },
  inject_js:     { emoji: "⚡", label: "JavaScript injection" },
  html_insert:   { emoji: "📄", label: "HTML insert" },
};

// Visual cards data for modification type selector
const MOD_CARD_DEFS: Array<{
  type: ModificationType;
  icon: string;
  name: string;
  desc: string;
  color: string;
}> = [
  { type: "replace_text",  icon: "T",   name: "Text replacement",  desc: "Swap any text node",      color: "#3b82f6" },
  { type: "replace_image", icon: "🖼",  name: "Image swap",         desc: "Replace img src",         color: "#10b981" },
  { type: "replace_link",  icon: "🔗",  name: "Link change",        desc: "Update href",             color: "#f59e0b" },
  { type: "hide_element",  icon: "◌",   name: "Hide element",       desc: "Set display: none",       color: "#6b7280" },
  { type: "show_element",  icon: "👁",  name: "Show element",       desc: "Remove hidden state",     color: "#8b5cf6" },
  { type: "inject_css",    icon: "🎨",  name: "CSS injection",      desc: "Inject scoped CSS",       color: "#7c3aed" },
  { type: "inject_js",     icon: "⚡",  name: "JS injection",       desc: "Run JavaScript code",     color: "#ef4444" },
  { type: "html_insert",   icon: "</>", name: "HTML insert",        desc: "Insert raw HTML",         color: "#0ea5e9" },
];

const QA_ITEMS: { id: string; label: string }[] = [
  { id: "selector_exists",   label: "Selector exists on the target page" },
  { id: "no_layout_shift",   label: "No layout shift detected in preview" },
  { id: "mobile_checked",    label: "Mobile layout checked" },
  { id: "cart_unaffected",   label: "Cart drawer not affected" },
  { id: "anti_flicker_conf", label: "Anti-flicker timeout configured" },
  { id: "analytics_event",   label: "Analytics event received at least once" },
];

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------

const inputCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white placeholder:text-neutral-400";

const textareaCls =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white resize-none placeholder:text-neutral-400";

const monoTextareaCls =
  "w-full text-xs font-mono border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-neutral-950 text-emerald-300 resize-y";

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_QA = Object.fromEntries(QA_ITEMS.map((i) => [i.id, false]));

const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  urlPattern: "",
  variants: [
    { key: "control",   name: "Control (original)", isControl: true,  allocationPercent: 50, modifications: [] },
    { key: "variant_a", name: "Variant A",           isControl: false, allocationPercent: 50, modifications: [] },
  ],
  antiFickerEnabled: true,
  antiFlickerTimeout: 3000,
  qaChecklist: DEFAULT_QA,
};

// ---------------------------------------------------------------------------
// ContentTestPreviewPanel
// ---------------------------------------------------------------------------

function ContentTestPreviewPanel({
  step,
  urlPattern,
  variants,
  antiFickerEnabled,
  antiFlickerTimeout,
  qaChecklist,
  testName,
  trafficAllocation,
}: {
  step: number;
  urlPattern: string;
  variants: VariantConfig[];
  antiFickerEnabled: boolean;
  antiFlickerTimeout: number;
  qaChecklist: Record<string, boolean>;
  testName: string;
  trafficAllocation: number;
}) {
  const totalMods = variants
    .filter((v) => !v.isControl)
    .reduce((s, v) => s + v.modifications.length, 0);
  const nonControlVariants = variants.filter((v) => !v.isControl);
  const checkedCount = Object.values(qaChecklist).filter(Boolean).length;
  const urlDisplay = urlPattern.trim()
    ? urlPattern.startsWith("/") ? urlPattern : "/" + urlPattern
    : "/*  (all pages)";

  const modTypeBadgeColor: Record<ModificationType, string> = {
    replace_text:  "#3b82f6",
    replace_image: "#10b981",
    replace_link:  "#f59e0b",
    hide_element:  "#6b7280",
    show_element:  "#8b5cf6",
    inject_css:    "#7c3aed",
    inject_js:     "#ef4444",
    html_insert:   "#0ea5e9",
  };

  const modTypeShortLabel: Record<ModificationType, string> = {
    replace_text:  "text",
    replace_image: "img",
    replace_link:  "link",
    hide_element:  "hide",
    show_element:  "show",
    inject_css:    "css",
    inject_js:     "js",
    html_insert:   "html",
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm text-xs">
      {/* Step-specific preview */}
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
          Live Preview
        </p>

        {/* Steps 0-1: Browser / page targeting mockup */}
        {(step === 0 || step === 1) && (
          <div className="rounded-lg border border-neutral-200 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 border-b border-neutral-200">
              <span className="w-2 h-2 rounded-full bg-red-300" />
              <span className="w-2 h-2 rounded-full bg-yellow-300" />
              <span className="w-2 h-2 rounded-full bg-green-300" />
            </div>
            {/* URL bar */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 border-b border-neutral-200">
              <svg className="w-2.5 h-2.5 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-[10px] text-neutral-500 font-mono truncate">
                yourstore.com{urlDisplay}
              </span>
            </div>
            {/* Page area */}
            <div className="p-3 bg-white min-h-[72px]">
              <div className="w-full h-2 bg-neutral-100 rounded mb-1.5" />
              <div className="w-3/4 h-2 bg-neutral-100 rounded mb-3" />
              <div className="flex gap-1.5">
                <div className="w-12 h-8 bg-violet-50 border border-violet-100 rounded" />
                <div className="flex-1">
                  <div className="w-full h-1.5 bg-neutral-100 rounded mb-1" />
                  <div className="w-2/3 h-1.5 bg-neutral-100 rounded" />
                </div>
              </div>
              {urlPattern.trim() && (
                <div className="mt-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: VIOLET }} />
                  <span className="text-[9px] text-violet-600 font-medium">targeting this page</span>
                </div>
              )}
              {!urlPattern.trim() && (
                <div className="mt-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[9px] text-amber-600 font-medium">all pages targeted</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Traffic split bars */}
        {step === 2 && (
          <div className="space-y-2">
            {variants.map((v) => (
              <div key={v.key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-neutral-600 truncate max-w-[120px]">
                    {v.name}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-800 ml-1 shrink-0">
                    {v.allocationPercent}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${v.allocationPercent}%`,
                      background: v.isControl ? "#d1d5db" : GRADIENT,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Modification tree */}
        {step === 3 && (
          <div className="space-y-3">
            {nonControlVariants.length === 0 && (
              <p className="text-[10px] text-neutral-400 italic">No variants defined yet.</p>
            )}
            {nonControlVariants.map((v) => (
              <div key={v.key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: VIOLET }}
                  >
                    {v.name}
                  </span>
                  <span className="text-[9px] text-neutral-400">
                    {v.modifications.length} mod{v.modifications.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {v.modifications.length === 0 && (
                  <p className="text-[9px] text-neutral-400 italic pl-3">No modifications yet</p>
                )}
                <div className="space-y-1 pl-3 border-l-2 border-neutral-100">
                  {v.modifications.map((m) => {
                    const color = modTypeBadgeColor[m.type];
                    const label = modTypeShortLabel[m.type];
                    const value = m.textValue ?? m.imageSrc ?? m.href ?? m.code ?? m.html ?? "";
                    return (
                      <div key={m.id} className="flex items-start gap-1.5">
                        <span
                          className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0 text-white mt-0.5"
                          style={{ background: color }}
                        >
                          {label}
                        </span>
                        <div className="min-w-0">
                          {m.selector && (
                            <span className="text-[9px] text-neutral-600 font-mono block truncate">
                              {m.selector}
                            </span>
                          )}
                          {(m.type === "inject_css" || m.type === "inject_js") && !m.selector && (
                            <span className="text-[9px] text-neutral-500 italic">global</span>
                          )}
                          {value && (
                            <span className="text-[9px] text-neutral-400 block truncate">
                              → {value.slice(0, 32)}{value.length > 32 ? "…" : ""}
                            </span>
                          )}
                          {!value && (
                            <span className="text-[9px] text-neutral-300 italic">no value yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Anti-flicker timing diagram */}
        {step === 4 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${antiFickerEnabled ? "bg-emerald-400" : "bg-neutral-300"}`}
              />
              <span className="text-[10px] font-semibold text-neutral-700">
                Anti-flicker {antiFickerEnabled ? "enabled" : "disabled"}
              </span>
            </div>
            <div className="relative">
              {/* Timeline track */}
              <div className="h-1.5 bg-neutral-100 rounded-full w-full mb-3" />
              {antiFickerEnabled && (
                <div
                  className="absolute top-0 left-0 h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((antiFlickerTimeout / 10000) * 100, 100)}%`,
                    background: GRADIENT,
                  }}
                />
              )}
              {/* Labels */}
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>page load</span>
                {antiFickerEnabled && (
                  <span style={{ color: VIOLET }}>mods apply</span>
                )}
                <span>{antiFickerEnabled ? `${antiFlickerTimeout}ms` : "instant"}</span>
              </div>
            </div>
            {antiFickerEnabled && (
              <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-100 p-2.5 space-y-1">
                <p className="text-[9px] text-neutral-600 leading-relaxed">
                  Page hides on load, modifications apply, page reveals. Timeout: <strong>{antiFlickerTimeout}ms</strong>.
                </p>
              </div>
            )}
            {!antiFickerEnabled && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-2.5">
                <p className="text-[9px] text-amber-700 leading-relaxed">
                  Content may flash briefly before modifications apply.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: QA checklist progress */}
        {step === 5 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-neutral-600">QA Progress</span>
              <span
                className="text-[10px] font-bold"
                style={{ color: checkedCount === QA_ITEMS.length ? "#10b981" : VIOLET }}
              >
                {checkedCount}/{QA_ITEMS.length}
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(checkedCount / QA_ITEMS.length) * 100}%`,
                  background: checkedCount === QA_ITEMS.length
                    ? "linear-gradient(90deg, #10b981, #059669)"
                    : GRADIENT,
                }}
              />
            </div>
            <div className="mt-3 space-y-1">
              {QA_ITEMS.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <span
                    className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                      qaChecklist[item.id]
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-white border-neutral-200"
                    }`}
                  >
                    {qaChecklist[item.id] && (
                      <svg className="w-1.5 h-1.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 5l2.5 2.5L8 3" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-[9px] truncate ${
                      qaChecklist[item.id] ? "text-neutral-400 line-through" : "text-neutral-600"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6 (Review): readiness indicator */}
        {step === 6 && (
          <div className="flex flex-col items-center py-2 gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner"
              style={{ background: "#7c3aed15" }}
            >
              ✦
            </div>
            <p className="text-[10px] text-neutral-500 text-center leading-relaxed">
              Review all checks in the main panel before launching.
            </p>
          </div>
        )}
      </div>

      {/* Config summary — always shown */}
      <div className="px-4 py-3 space-y-1.5 bg-neutral-50">
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
          Configuration
        </p>
        {[
          { label: "Name", value: testName || "—" },
          {
            label: "Pages",
            value: urlPattern.trim() ? urlPattern : "All pages",
          },
          {
            label: "Variants",
            value: `${variants.length} (${nonControlVariants.length} treatment${nonControlVariants.length !== 1 ? "s" : ""})`,
          },
          { label: "Modifications", value: `${totalMods} total` },
          { label: "Traffic", value: `${trafficAllocation}% of visitors` },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className="text-[9px] text-neutral-400 w-20 shrink-0">{label}</span>
            <span
              className="text-[10px] font-medium text-neutral-700 truncate"
              title={value}
            >
              {value}
            </span>
          </div>
        ))}
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
        title="Test details"
        description="Give your test a clear name and hypothesis so your team can understand its purpose at a glance."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required hint="Use a descriptive name that identifies the element and goal.">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputCls}
              placeholder="Hero Headline Test"
            />
          </FormField>

          <FormField
            label="Hypothesis"
            hint="Describe what you expect to happen and why. Include the expected lift."
          >
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className={textareaCls}
              placeholder="e.g. Changing the hero headline to focus on price will increase CVR by 10%"
            />
          </FormField>

          <FormField
            label="Traffic allocation (%)"
            hint="Percentage of site visitors enrolled in this test. The rest see the original page."
          >
            <input
              type="number"
              min={1}
              max={100}
              value={state.trafficAllocation}
              onChange={(e) => onChange({ trafficAllocation: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
              className="w-28 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Page Targeting
// ---------------------------------------------------------------------------

function StepPageTargeting({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const [urlTouched, setUrlTouched] = useState(false);
  const urlError = urlTouched && !state.urlPattern.trim();

  return (
    <div className="space-y-6">
      <FormSection
        title="Page targeting"
        description="Restrict this test to specific URL patterns, or leave blank to run on every page."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField
            label="URL pattern"
            hint="Supports * wildcards. Examples: /products/*, /collections/summer, /pages/about"
          >
            <input
              type="text"
              value={state.urlPattern}
              onChange={(e) => onChange({ urlPattern: e.target.value })}
              onBlur={() => setUrlTouched(true)}
              className={`${inputCls}${urlError ? " border-red-400" : ""}`}
              placeholder="/products/*"
            />
            {urlError && (
              <p className="text-xs text-red-500 mt-1">URL pattern is required to proceed</p>
            )}
          </FormField>

          <InlineAlert variant="info" title="How it works">
            The runtime evaluates targeting on every page load before showing modifications. Visitors
            whose current URL does not match the pattern see the original page with zero changes.
          </InlineAlert>

          {!state.urlPattern.trim() && (
            <InlineAlert variant="warning">
              No URL pattern set — this test will run on <strong>all pages</strong>. Narrow the
              targeting if the modifications are page-specific.
            </InlineAlert>
          )}
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Variants
// ---------------------------------------------------------------------------

function StepVariants({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const allocVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));

  function handleAllocChange(updated: AllocationVariant[]) {
    onChange({
      variants: state.variants.map((v, i) => ({
        ...v,
        allocationPercent: updated[i]?.allocationPercent ?? v.allocationPercent,
      })),
    });
  }

  function updateVariant(index: number, patch: Partial<VariantConfig>) {
    onChange({ variants: state.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  }

  function addVariant() {
    const nonControlCount = state.variants.filter((v) => !v.isControl).length;
    const even = parseFloat((100 / (state.variants.length + 1)).toFixed(1));
    const remainder = parseFloat((100 - even * state.variants.length).toFixed(1));
    onChange({
      variants: [
        ...state.variants.map((v, i) => ({
          ...v,
          allocationPercent: i === state.variants.length - 1 ? remainder : even,
        })),
        emptyVariant(false, nonControlCount + 1),
      ],
    });
  }

  function removeVariant(index: number) {
    if (state.variants.length <= 2) return;
    onChange({ variants: state.variants.filter((_, i) => i !== index) });
  }

  const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;

  return (
    <div className="space-y-6">
      <FormSection
        title="Traffic allocation"
        description="Distribute traffic between variants. Must total exactly 100%."
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

      <FormSection
        title="Variants"
        description="Rename variants or remove extras. Every test needs at least one control and one treatment."
        accent={ACCENT}
      >
        <div className="space-y-3">
          {state.variants.map((v, vi) => (
            <div
              key={v.key}
              className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl bg-white"
            >
              {v.isControl ? (
                <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase bg-neutral-100 text-neutral-500 px-2 py-1 rounded-full">
                  Control
                </span>
              ) : (
                <span
                  className="shrink-0 text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full text-white"
                  style={{ background: ACCENT }}
                >
                  Variant
                </span>
              )}

              <input
                type="text"
                value={v.name}
                onChange={(e) => updateVariant(vi, { name: e.target.value })}
                className="flex-1 text-sm font-medium border-0 border-b border-transparent hover:border-neutral-200 focus:border-violet-400 focus:outline-none bg-transparent py-0.5"
              />

              {/* modification count badge */}
              {!v.isControl && (
                <span className="shrink-0 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">
                  {v.modifications.length} mod{v.modifications.length !== 1 ? "s" : ""}
                </span>
              )}

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
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Variant
          </button>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModificationTypeCard grid (replaces plain <select>)
// ---------------------------------------------------------------------------

function ModificationTypeGrid({
  value,
  onChange,
}: {
  value: ModificationType;
  onChange: (t: ModificationType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MOD_CARD_DEFS.map((card) => {
        const isSelected = value === card.type;
        return (
          <button
            key={card.type}
            type="button"
            onClick={() => onChange(card.type)}
            className="flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all"
            style={{
              borderColor: isSelected ? card.color : "#e5e7eb",
              background: isSelected ? `${card.color}0f` : "#ffffff",
              outline: isSelected ? `2px solid ${card.color}30` : "none",
              outlineOffset: "0px",
            }}
          >
            <span
              className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{
                background: isSelected ? card.color : "#f3f4f6",
                color: isSelected ? "#ffffff" : "#6b7280",
              }}
            >
              {card.icon}
            </span>
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold leading-tight"
                style={{ color: isSelected ? card.color : "#374151" }}
              >
                {card.name}
              </p>
              <p className="text-[10px] text-neutral-400 leading-tight mt-0.5 truncate">
                {card.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Content Changes
// ---------------------------------------------------------------------------

function ModificationEditor({
  mod,
  onUpdate,
  onRemove,
}: {
  mod: Modification;
  onUpdate: (patch: Partial<Modification>) => void;
  onRemove: () => void;
}) {
  const needsSelector = mod.type !== "inject_css" && mod.type !== "inject_js";
  const needsCode = mod.type === "inject_css" || mod.type === "inject_js";

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
      {/* Modification type card header */}
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-neutral-600">Modification type</p>
          <button
            type="button"
            onClick={onRemove}
            className="text-neutral-400 hover:text-red-500 transition-colors p-1 -mr-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <ModificationTypeGrid
          value={mod.type}
          onChange={(t) => onUpdate({ type: t })}
        />
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* JS warning */}
        {mod.type === "inject_js" && (
          <InlineAlert variant="danger">
            JavaScript injection can break your storefront. Review carefully before launching.
          </InlineAlert>
        )}

        {/* Selector */}
        {needsSelector && (
          <FormField label="CSS selector" error={!mod.selector.trim() ? "Selector is required" : undefined}>
            <input
              type="text"
              value={mod.selector}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              className={inputCls}
              placeholder="#hero-title, .product-description"
            />
            {!mod.selector.trim() && (
              <p className="text-xs text-amber-600 mt-1">&#9888; This modification has an empty selector</p>
            )}
          </FormField>
        )}

        {/* Selector guard */}
        {needsSelector && !mod.selector.trim() && (
          <InlineAlert variant="warning">
            A CSS selector is required so the runtime knows which element to modify.
          </InlineAlert>
        )}

        {/* Type-specific fields */}
        {mod.type === "replace_text" && (
          <FormField label="New text value">
            <input
              type="text"
              value={mod.textValue ?? ""}
              onChange={(e) => onUpdate({ textValue: e.target.value })}
              className={inputCls}
              placeholder="Free shipping on all orders over $50"
            />
          </FormField>
        )}

        {mod.type === "replace_image" && (
          <FormField label="New image URL">
            <input
              type="url"
              value={mod.imageSrc ?? ""}
              onChange={(e) => onUpdate({ imageSrc: e.target.value })}
              className={inputCls}
              placeholder="https://cdn.myshopify.com/files/hero-v2.jpg"
            />
          </FormField>
        )}

        {mod.type === "replace_link" && (
          <FormField label="New href URL">
            <input
              type="url"
              value={mod.href ?? ""}
              onChange={(e) => onUpdate({ href: e.target.value })}
              className={inputCls}
              placeholder="https://example.com/sale"
            />
          </FormField>
        )}

        {needsCode && (
          <FormField label={mod.type === "inject_css" ? "CSS code" : "JavaScript code"}>
            <textarea
              rows={6}
              value={mod.code ?? ""}
              onChange={(e) => onUpdate({ code: e.target.value })}
              className={monoTextareaCls}
              placeholder={
                mod.type === "inject_css"
                  ? ".hero__title { font-size: 2.5rem; color: #1a1a1a; }"
                  : "document.querySelector('.hero__cta').textContent = 'Shop Now';"
              }
            />
          </FormField>
        )}

        {mod.type === "html_insert" && (
          <>
            <FormField label="Insert position">
              <select
                value={mod.insertPosition ?? "replace"}
                onChange={(e) => onUpdate({ insertPosition: e.target.value as HtmlInsertPosition })}
                className="w-40 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                <option value="before">Before element</option>
                <option value="after">After element</option>
                <option value="replace">Replace element</option>
              </select>
            </FormField>
            <FormField label="HTML content">
              <textarea
                rows={5}
                value={mod.html ?? ""}
                onChange={(e) => onUpdate({ html: e.target.value })}
                className={monoTextareaCls}
                placeholder='<div class="badge badge--sale">50% off today only</div>'
              />
            </FormField>
          </>
        )}
      </div>
    </div>
  );
}

function StepContentChanges({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function updateMod(vi: number, mi: number, patch: Partial<Modification>) {
    const v = state.variants[vi];
    if (!v) return;
    onChange({
      variants: state.variants.map((variant, i) =>
        i !== vi
          ? variant
          : { ...variant, modifications: variant.modifications.map((m, j) => (j === mi ? { ...m, ...patch } : m)) }
      ),
    });
  }

  function addMod(vi: number) {
    const v = state.variants[vi];
    if (!v) return;
    onChange({
      variants: state.variants.map((variant, i) =>
        i !== vi ? variant : { ...variant, modifications: [...variant.modifications, emptyModification()] }
      ),
    });
  }

  function removeMod(vi: number, mi: number) {
    onChange({
      variants: state.variants.map((variant, i) =>
        i !== vi ? variant : { ...variant, modifications: variant.modifications.filter((_, j) => j !== mi) }
      ),
    });
  }

  const nonControlVariants = state.variants.filter((v) => !v.isControl);

  return (
    <div className="space-y-8">
      {nonControlVariants.map((v, rawVi) => {
        const vi = state.variants.indexOf(v);
        const hasNoMods = v.modifications.length === 0;

        return (
          <FormSection
            key={v.key}
            title={v.name}
            description="Define the DOM modifications this variant applies on the target page."
            accent={ACCENT}
          >
            <div className="space-y-3">
              {hasNoMods && (
                <InlineAlert variant="danger">
                  This variant has no modifications — visitors assigned to it will see the original
                  page, making it identical to the control.
                </InlineAlert>
              )}

              {v.modifications.map((mod, mi) => (
                <ModificationEditor
                  key={mod.id}
                  mod={mod}
                  onUpdate={(patch) => updateMod(vi, mi, patch)}
                  onRemove={() => removeMod(vi, mi)}
                />
              ))}

              <button
                type="button"
                onClick={() => addMod(vi)}
                className="w-full py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add modification
              </button>
            </div>
          </FormSection>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Anti-flicker
// ---------------------------------------------------------------------------

function StepAntiFlicker({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const cssSnippet = `/* MarginLab anti-flicker snippet */
.marginlab-loading * {
  visibility: hidden !important;
  opacity: 0 !important;
}`;

  return (
    <div className="space-y-6">
      <FormSection
        title="Anti-flicker protection"
        description="Prevent the original page from flashing briefly before variant modifications are applied."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <InlineAlert variant="info" title="How anti-flicker works">
            The runtime hides page content immediately on load, applies modifications, then reveals
            the page — all within the configured timeout. If the timeout expires before modifications
            load, the original page is shown to prevent a broken experience.
          </InlineAlert>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span
              className={`relative inline-block w-10 h-5 rounded-full transition-colors ${
                state.antiFickerEnabled ? "bg-violet-600" : "bg-neutral-300"
              }`}
              onClick={() => onChange({ antiFickerEnabled: !state.antiFickerEnabled })}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  state.antiFickerEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
            <span className="text-sm font-medium text-neutral-800">Enable anti-flicker</span>
            {state.antiFickerEnabled && (
              <span className="text-xs text-violet-600 font-medium bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </label>

          {state.antiFickerEnabled && (
            <>
              <FormField
                label="Timeout (ms)"
                hint="Maximum time to wait before revealing the page regardless of modification status."
              >
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={100}
                  value={state.antiFlickerTimeout}
                  onChange={(e) =>
                    onChange({ antiFlickerTimeout: parseInt(e.target.value, 10) || 3000 })
                  }
                  className="w-32 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </FormField>

              <div>
                <p className="text-xs font-medium text-neutral-600 mb-2">Anti-flicker CSS snippet</p>
                <pre className="text-xs font-mono bg-neutral-950 text-emerald-300 rounded-xl px-4 py-3 overflow-x-auto leading-relaxed">
                  {cssSnippet}
                </pre>
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  This snippet is automatically injected by the MarginLab runtime — no manual
                  installation required.
                </p>
              </div>
            </>
          )}
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — QA Checklist
// ---------------------------------------------------------------------------

function StepQAChecklist({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function toggle(id: string) {
    onChange({ qaChecklist: { ...state.qaChecklist, [id]: !state.qaChecklist[id] } });
  }

  const checkedCount = Object.values(state.qaChecklist).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <FormSection
        title="Pre-launch QA"
        description="Work through this checklist before activating the test. All items are optional, but strongly recommended."
        accent={ACCENT}
      >
        <div className="space-y-2">
          {QA_ITEMS.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={state.qaChecklist[item.id] ?? false}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 rounded accent-violet-600"
              />
              <span
                className={`text-sm ${
                  state.qaChecklist[item.id] ? "text-neutral-500 line-through" : "text-neutral-800"
                }`}
              >
                {item.label}
              </span>
              {state.qaChecklist[item.id] && (
                <span className="ml-auto text-emerald-500 text-xs font-medium">Done</span>
              )}
            </label>
          ))}
        </div>

        <p className="text-xs text-neutral-400 mt-3">
          {checkedCount}/{QA_ITEMS.length} items completed
        </p>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 7 — Review
// ---------------------------------------------------------------------------

function buildReadinessChecks(state: WizardState): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  const allocOk = Math.abs(total - 100) < 0.1;
  const nonControlVariants = state.variants.filter((v) => !v.isControl);
  const variantsWithNoMods = nonControlVariants.filter((v) => v.modifications.length === 0);
  const emptySelectors = nonControlVariants.flatMap((v) =>
    v.modifications.filter((m) => m.type !== "inject_css" && m.type !== "inject_js" && !m.selector.trim())
  );
  const hasJsInjection = nonControlVariants.some((v) =>
    v.modifications.some((m) => m.type === "inject_js")
  );

  // BLOCK: name
  checks.push(
    state.name.trim()
      ? { id: "name", label: "Test name provided", status: "pass" }
      : { id: "name", label: "Test name is required", status: "block", detail: "Go back to Setup to add a name." }
  );

  // BLOCK: allocation
  checks.push(
    allocOk
      ? { id: "alloc", label: "Traffic allocation totals 100%", status: "pass" }
      : {
          id: "alloc",
          label: `Allocation totals ${total.toFixed(1)}% — must be 100%`,
          status: "block",
          detail: "Go back to Variants to fix the split.",
        }
  );

  // BLOCK: variants with no modifications
  if (variantsWithNoMods.length > 0) {
    checks.push({
      id: "mods",
      label: `${variantsWithNoMods.map((v) => v.name).join(", ")} ${variantsWithNoMods.length === 1 ? "has" : "have"} no modifications`,
      status: "block",
      detail: "Each non-control variant needs at least one modification.",
    });
  } else {
    checks.push({ id: "mods", label: "All variants have modifications", status: "pass" });
  }

  // BLOCK: empty selectors
  if (emptySelectors.length > 0) {
    checks.push({
      id: "selectors",
      label: `${emptySelectors.length} modification${emptySelectors.length !== 1 ? "s" : ""} missing a CSS selector`,
      status: "block",
      detail: "Go back to Content Changes and fill in all selector fields.",
    });
  } else {
    checks.push({ id: "selectors", label: "All selectors are filled in", status: "pass" });
  }

  // WARN: no URL pattern
  if (!state.urlPattern.trim()) {
    checks.push({
      id: "url",
      label: "No URL pattern — test runs on all pages",
      status: "warn",
      detail: "Restrict targeting if modifications are page-specific.",
    });
  } else {
    checks.push({
      id: "url",
      label: `URL pattern set: ${state.urlPattern}`,
      status: "pass",
    });
  }

  // WARN: JS injection
  if (hasJsInjection) {
    checks.push({
      id: "js",
      label: "JavaScript injection in use",
      status: "warn",
      detail: "Review injected code carefully — it runs on every page load for enrolled visitors.",
    });
  }

  return checks;
}

function StepReview({
  state,
  onSubmit,
  saving,
}: {
  state: WizardState;
  onSubmit: () => void;
  saving: boolean;
}) {
  const checks = buildReadinessChecks(state);
  const hasBlockers = checks.some((c) => c.status === "block");
  const totalMods = state.variants
    .filter((v) => !v.isControl)
    .reduce((s, v) => s + v.modifications.length, 0);

  return (
    <div className="space-y-6">
      <FormSection title="Launch readiness" accent={ACCENT}>
        <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />
      </FormSection>

      <FormSection
        title="Test summary"
        description="Review all configuration before creating the test."
        accent={ACCENT}
      >
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
          {[
            { label: "Name",            value: state.name || "—" },
            { label: "Hypothesis",      value: state.hypothesis || "—" },
            { label: "Traffic",         value: `${state.trafficAllocation}% of visitors` },
            { label: "URL pattern",     value: state.urlPattern || "All pages" },
            { label: "Variants",        value: `${state.variants.length} (${state.variants.filter((v) => !v.isControl).length} treatment${state.variants.filter((v) => !v.isControl).length !== 1 ? "s" : ""})` },
            { label: "Modifications",   value: `${totalMods} total` },
            { label: "Anti-flicker",    value: state.antiFickerEnabled ? `Enabled (${state.antiFlickerTimeout}ms timeout)` : "Disabled" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-4 px-4 py-2.5 bg-white">
              <span className="w-36 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
              <span className="text-sm text-neutral-900 flex-1">{value}</span>
            </div>
          ))}
        </div>
      </FormSection>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={hasBlockers || saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-200"
          style={{ background: hasBlockers || saving ? "#e5e7eb" : GRADIENT }}
        >
          {saving ? "Creating…" : "Create Content Test"}
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

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = STEP_DEFS.map((s) => s.label);

export function ContentTestWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState<number>(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Build step nav array with statuses
  const navSteps: WizardStep[] = STEP_DEFS.map((s, i) => ({
    label: s.label,
    status: i < step ? "complete" : i === step ? "active" : "pending",
  }));

  function canAdvance(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 1) return state.urlPattern.trim().length > 0;
    if (step === 2) {
      const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
      return Math.abs(total - 100) < 0.1;
    }
    if (step === 3) {
      for (const v of state.variants) {
        if (v.isControl) continue;
        for (const m of v.modifications) {
          const needsSelector = m.type !== "inject_css" && m.type !== "inject_js";
          const needsCode = m.type === "inject_css" || m.type === "inject_js";
          if (needsSelector && !m.selector.trim()) return false;
          if (needsCode && !m.code?.trim()) return false;
        }
      }
    }
    return true;
  }

  function blockingIssue(): string | undefined {
    if (step === 0 && !state.name.trim()) return "Test name is required";
    if (step === 1 && !state.urlPattern.trim()) return "URL pattern is required";
    if (step === 2) {
      const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
      if (Math.abs(total - 100) >= 0.1) return `Allocation totals ${total.toFixed(1)}%`;
    }
    if (step === 3) {
      for (const v of state.variants) {
        if (v.isControl) continue;
        for (const m of v.modifications) {
          const needsSelector = m.type !== "inject_css" && m.type !== "inject_js";
          const needsCode = m.type === "inject_css" || m.type === "inject_js";
          if (needsSelector && !m.selector.trim()) return "CSS selector is required on all modifications";
          if (needsCode && !m.code?.trim()) return `${m.type === "inject_js" ? "JavaScript" : "CSS"} code is required`;
        }
      }
    }
    return undefined;
  }

  const handleBack = useCallback(() => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/content-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          hypothesis: state.hypothesis || undefined,
          trafficAllocation: state.trafficAllocation,
          targetingRules: state.urlPattern
            ? [{ type: "url_contains", value: state.urlPattern }]
            : [],
          variants: state.variants.map((v) => ({
            key: v.key,
            name: v.name,
            isControl: v.isControl,
            allocationPercent: v.allocationPercent,
            modifications: v.isControl ? [] : v.modifications,
          })),
        }),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create test");
      }

      showSuccess(`Content test "${state.name}" created — activate it from the test detail page.`);
      router.push("/content-tests");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setSubmitError(`Could not create test: ${msg}. Check your connection and try again.`);
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step, handleSubmit]);

  const isLastStep = step === TOTAL_STEPS - 1;

  const CONTINUE_LABELS: Record<number, string> = {
    0: "Set up variants →",
    1: "Configure targeting →",
    2: "Add content changes →",
    3: "Configure anti-flicker →",
    4: "Run QA checklist →",
    5: "Review modifications →",
  };

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: "#7c3aed0a" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: "#7c3aed15" }}
          >
            <span className="text-base" style={{ color: VIOLET }}>✦</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Content Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            A/B test headlines, images, CTAs, and layout changes on your storefront pages.
          </p>
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={navSteps}
            currentStep={step}
            accentHex={VIOLET}
            onStepClick={(i) => {
              if (i < step) setStep(i as StepIndex);
            }}
          />
        </div>
        <div className="p-3 border-t border-neutral-50">
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Changes apply to the storefront via JavaScript injection.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: VIOLET }}
          >
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Two-column content area */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Form column */}
            <div className="flex-1 min-w-0 space-y-5">
              {step === 0 && <StepSetup state={state} onChange={patch} />}
              {step === 1 && <StepPageTargeting state={state} onChange={patch} />}
              {step === 2 && <StepVariants state={state} onChange={patch} />}
              {step === 3 && <StepContentChanges state={state} onChange={patch} />}
              {step === 4 && <StepAntiFlicker state={state} onChange={patch} />}
              {step === 5 && <StepQAChecklist state={state} onChange={patch} />}
              {step === 6 && (
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

            {/* Preview panel column */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <ContentTestPreviewPanel
                step={step}
                urlPattern={state.urlPattern}
                variants={state.variants}
                antiFickerEnabled={state.antiFickerEnabled}
                antiFlickerTimeout={state.antiFlickerTimeout}
                qaChecklist={state.qaChecklist}
                testName={state.name}
                trafficAllocation={state.trafficAllocation}
              />
            </aside>
          </div>
        </div>

        {/* Sticky bottom actions (hidden on review step — review has its own submit button) */}
        {!isLastStep && (
          <StickyFormActions
            step={step}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onNext={handleNext}
            canContinue={canAdvance()}
            isLastStep={false}
            isSubmitting={saving}
            continueLabel={CONTINUE_LABELS[step]}
            accentHex={ACCENT}
            blockingIssue={blockingIssue()}
          />
        )}
      </div>
    </div>
  );
}
