"use client";

import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Home, Shuffle, Lock, Globe, CheckCircle2, AlertTriangle, XCircle, Monitor, Smartphone } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { StickyFormActions } from "@/components/forms/StickyFormActions";
import { WizardStepNav, WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { VariantAllocationEditor, AllocationVariant } from "@/components/experiments/VariantAllocationEditor";

const SplitUrlPreviewPanel = lazy(() => import("./SplitUrlPreviewPanel"));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SKY = "#0284c7";
const ACCENT = SKY;
const ACCENT_GRADIENT = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)";

const STEP_LABELS = ["Setup", "URL Routes", "Traffic & Targeting", "Settings", "Review"];

const STEP_TITLES = [
  "Define your landing page test",
  "Configure redirect URLs",
  "Allocate traffic and set targeting",
  "Configure redirect settings",
  "Review and launch",
];

const STEP_DESCS = [
  "Name the test and write a hypothesis about which landing page variation will drive higher conversion.",
  "Set the control URL and add one or more variant URLs to redirect traffic to.",
  "Choose how traffic is split between URLs and which visitor segments are included.",
  "Configure query parameter handling, UTM preservation, and loop protection.",
  "Review the complete redirect configuration and validate all URLs before launching.",
];

const STEP_DEFS: WizardStep[] = STEP_LABELS.map((label) => ({ label }));

const CONTINUE_LABELS: Record<number, string> = {
  0: "Configure URL routes",
  1: "Set traffic",
  2: "Adjust settings",
  3: "Review & launch",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VariantConfig {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
  redirectUrl: string;
}

interface TargetingConfig {
  deviceType: "all" | "mobile" | "desktop";
  trafficSource: "all" | "paid" | "organic";
  newVisitorsOnly: boolean;
}

interface WizardState {
  name: string;
  hypothesis: string;
  trafficAllocation: number;
  variants: VariantConfig[];
  targeting: TargetingConfig;
  preserveQueryParams: boolean;
  preserveUtm: boolean;
}

type StepIndex = 0 | 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  if (url.startsWith("/")) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function hasDuplicateUrls(variants: VariantConfig[]): boolean {
  const urls = variants.map((v) => v.redirectUrl.trim()).filter(Boolean);
  return new Set(urls).size !== urls.length;
}

function truncateUrl(url: string, max = 32): string {
  if (!url) return "";
  // Strip protocol for display
  const display = url.replace(/^https?:\/\//, "");
  return display.length > max ? display.slice(0, max) + "…" : display;
}

// ---------------------------------------------------------------------------
// DEFAULT STATE
// ---------------------------------------------------------------------------
const DEFAULT_STATE: WizardState = {
  name: "",
  hypothesis: "",
  trafficAllocation: 100,
  variants: [
    {
      key: "control",
      name: "Control",
      isControl: true,
      allocationPercent: 50,
      redirectUrl: "",
    },
    {
      key: "variant_a",
      name: "Variant A",
      isControl: false,
      allocationPercent: 50,
      redirectUrl: "",
    },
  ],
  targeting: {
    deviceType: "all",
    trafficSource: "all",
    newVisitorsOnly: false,
  },
  preserveQueryParams: true,
  preserveUtm: true,
};

// ---------------------------------------------------------------------------
// URL status badge helper
// ---------------------------------------------------------------------------
function UrlStatusBadge({ url, duplicates }: { url: string; duplicates: boolean }) {
  if (!url.trim()) return null;
  if (duplicates) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="w-2.5 h-2.5" /> Duplicate
      </span>
    );
  }
  if (!isValidUrl(url)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="w-2.5 h-2.5" /> Invalid URL
      </span>
    );
  }
  if (isExternalUrl(url)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle className="w-2.5 h-2.5" /> External
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-2.5 h-2.5" /> Valid
    </span>
  );
}

// ---------------------------------------------------------------------------
// Browser Bar Mockup
// ---------------------------------------------------------------------------
function BrowserBar({ url, placeholder }: { url: string; placeholder: string }) {
  const display = url ? truncateUrl(url, 38) : placeholder;
  const hasUrl = Boolean(url.trim());
  return (
    <div className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2 border border-neutral-200">
      <div className="flex gap-1 shrink-0">
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
      </div>
      <div className="flex-1 flex items-center gap-1.5 bg-white rounded-md px-2.5 py-1 border border-neutral-200 min-w-0">
        <Lock className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
        <span
          className={`text-[11px] font-mono truncate ${hasUrl ? "text-neutral-700" : "text-neutral-300 italic"}`}
        >
          {display}
        </span>
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
    <div className="space-y-5">
      <FormSection
        title="Test details"
        description="Give your test a name and describe what you expect to learn."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Test name" required hint="A short, descriptive label visible across the dashboard.">
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="input-base w-full"
              placeholder="New Landing Page Test"
            />
          </FormField>

          <FormField
            label="Hypothesis"
            hint="Describe what you expect to happen and why. A clear hypothesis makes results easier to interpret."
          >
            <textarea
              rows={3}
              value={state.hypothesis}
              onChange={(e) => onChange({ hypothesis: e.target.value })}
              className="input-base w-full resize-none"
              placeholder="Sending paid traffic to the long-form landing page will increase conversion rate compared to the standard PDP."
            />
          </FormField>

          <FormField
            label="Traffic allocation (%)"
            hint="Percentage of all visitors included in this test. The rest always see the original URL."
          >
            <input
              type="number"
              min={1}
              max={100}
              value={state.trafficAllocation}
              onChange={(e) =>
                onChange({ trafficAllocation: Math.min(100, Math.max(1, parseInt(e.target.value) || 100)) })
              }
              className="input-base w-28"
            />
          </FormField>
        </div>
      </FormSection>

      {/* How it works callout */}
      <div
        className="rounded-xl px-4 py-4 border text-xs text-neutral-600 leading-relaxed space-y-2"
        style={{ background: `${SKY}06`, borderColor: `${SKY}20` }}
      >
        <p className="font-semibold text-neutral-700">How split URL tests work</p>
        <p>
          When a visitor matches your targeting rules, the MarginLab router assigns them to a
          variant and redirects them server-side. The assignment is sticky for their session so
          they always see the same URL on return visits.
        </p>
        <p>
          Conversion events from both URLs are tracked and compared to find a statistically
          significant winner.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — URL Routes (enhanced cards)
// ---------------------------------------------------------------------------
function StepUrlRoutes({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  function updateVariant(index: number, patch: Partial<VariantConfig>) {
    onChange({
      variants: state.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });
  }

  function addVariant() {
    const letter = String.fromCharCode(65 + state.variants.filter((v) => !v.isControl).length);
    const newVar: VariantConfig = {
      key: `variant_${letter.toLowerCase()}`,
      name: `Variant ${letter}`,
      isControl: false,
      allocationPercent: 0,
      redirectUrl: "",
    };
    onChange({ variants: [...state.variants, newVar] });
  }

  function removeVariant(index: number) {
    if (state.variants.filter((v) => !v.isControl).length <= 1) return;
    onChange({ variants: state.variants.filter((_, i) => i !== index) });
  }

  const controlVariant = state.variants.find((v) => v.isControl);
  const nonControlVariants = state.variants.filter((v) => !v.isControl);
  const allUrls = [controlVariant?.redirectUrl ?? "", ...nonControlVariants.map((v) => v.redirectUrl)];
  const duplicates = hasDuplicateUrls(state.variants);
  const anyExternal = allUrls.some((u) => isExternalUrl(u));
  const controlEmpty = !controlVariant?.redirectUrl.trim();
  const variantEmpty = nonControlVariants.some((v) => !v.redirectUrl.trim());

  // Per-field duplicate set — URLs that appear more than once
  const duplicateUrlSet = new Set(
    state.variants
      .filter((v, i) => v.redirectUrl.trim() && state.variants.findIndex((other) => other.redirectUrl === v.redirectUrl) !== i)
      .map((v) => v.redirectUrl)
  );

  // Per-field external domain mismatch — detect cross-domain pairs
  function isExternalDomainMismatch(url: string): boolean {
    if (!isExternalUrl(url)) return false;
    try {
      const thisHost = new URL(url).hostname;
      return state.variants.some((other) => {
        if (other.redirectUrl === url) return false;
        if (!isExternalUrl(other.redirectUrl) && !other.redirectUrl.trim()) return false;
        if (isExternalUrl(other.redirectUrl)) {
          try {
            return new URL(other.redirectUrl).hostname !== thisHost;
          } catch {
            return false;
          }
        }
        return false;
      });
    } catch {
      return false;
    }
  }

  return (
    <div className="space-y-4">
      {/* Guards */}
      {controlEmpty && (
        <InlineAlert variant="danger">
          Control URL is required. Enter the original page URL visitors currently see.
        </InlineAlert>
      )}
      {variantEmpty && (
        <InlineAlert variant="danger">
          All variant redirect URLs must be filled in before continuing.
        </InlineAlert>
      )}
      {duplicates && (
        <InlineAlert variant="danger" title="Duplicate URLs detected">
          Two or more variants share the same URL. Each variant must have a unique destination.
        </InlineAlert>
      )}
      {anyExternal && (
        <InlineAlert variant="warning">
          Using an external URL (https://…) will redirect visitors off your store. Ensure this
          is intentional.
        </InlineAlert>
      )}

      {/* Enhanced variant cards */}
      {state.variants.map((v, i) => {
        const isInvalid = v.redirectUrl.trim().length > 0 && !isValidUrl(v.redirectUrl);
        const isDuplicate = duplicates && v.redirectUrl.trim().length > 0;
        const isExt = isExternalUrl(v.redirectUrl);

        return (
          <div
            key={v.key}
            className="rounded-xl border bg-white overflow-hidden shadow-sm"
            style={v.isControl ? { borderColor: "#bae6fd" } : { borderColor: "#e5e7eb" }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={
                v.isControl
                  ? { background: "#f0f9ff", borderBottom: "1px solid #bae6fd" }
                  : { background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }
              }
            >
              <div className="flex items-center gap-2">
                {v.isControl ? (
                  <Home className="w-4 h-4" style={{ color: SKY }} />
                ) : (
                  <Shuffle className="w-4 h-4 text-neutral-400" />
                )}
                <span className="text-sm font-bold text-neutral-800">{v.name}</span>
                {v.isControl ? (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${SKY}18`, color: SKY }}
                  >
                    Control — original
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                    Redirect variant
                  </span>
                )}
                {/* Allocation badge */}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                  style={
                    v.isControl
                      ? { background: "#dbeafe", color: "#1d4ed8" }
                      : { background: "#f3f4f6", color: "#6b7280" }
                  }
                >
                  {v.allocationPercent}% of traffic
                </span>
              </div>
              {!v.isControl && nonControlVariants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="text-neutral-300 hover:text-red-500 transition-colors p-1 rounded"
                  aria-label="Remove variant"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Card body */}
            <div className="px-4 py-4 space-y-3">
              {/* Browser bar mockup */}
              <BrowserBar
                url={v.redirectUrl}
                placeholder={v.isControl ? "yourstore.com/products/original-page" : "yourstore.com/pages/landing-variant"}
              />

              {/* URL input with inline status */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    {v.isControl ? "Control URL" : "Redirect URL"}
                  </label>
                  <UrlStatusBadge url={v.redirectUrl} duplicates={isDuplicate} />
                </div>
                <input
                  type="text"
                  value={v.redirectUrl}
                  onChange={(e) => updateVariant(i, { redirectUrl: e.target.value })}
                  placeholder={v.isControl ? "/products/best-seller" : "/pages/landing"}
                  className={`input-base w-full font-mono text-sm ${
                    (isInvalid || isDuplicate || duplicateUrlSet.has(v.redirectUrl)) ? "border-red-400 focus:ring-red-300" : ""
                  }`}
                />
                {isInvalid && !isDuplicate && (
                  <p className="text-[11px] text-red-500">
                    Enter a valid path (e.g. /products/hero) or full URL (https://…).
                  </p>
                )}
                {duplicateUrlSet.has(v.redirectUrl) && (
                  <p className="text-xs text-red-500 mt-1">This URL is already used by another variant</p>
                )}
                {isExternalDomainMismatch(v.redirectUrl) && (
                  <p className="text-xs text-amber-600 mt-1">&#9888; External domain detected — consider SEO canonical tags on this page</p>
                )}
                <p className="text-[11px] text-neutral-400">
                  {v.isControl
                    ? "This is the page visitors currently see. Used as the baseline for comparison."
                    : isExt
                    ? "Visitors in this variant are redirected to this external URL."
                    : "Visitors in this variant are silently redirected server-side to this path."}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add variant */}
      <button
        type="button"
        onClick={addVariant}
        className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-400 hover:border-sky-300 hover:text-sky-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Add variant URL
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Traffic & Targeting
// ---------------------------------------------------------------------------
function StepTrafficTargeting({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const allocationVariants: AllocationVariant[] = state.variants.map((v) => ({
    key: v.key,
    name: v.name,
    isControl: v.isControl,
    allocationPercent: v.allocationPercent,
  }));

  function handleAllocationChange(updated: AllocationVariant[]) {
    onChange({
      variants: state.variants.map((v) => {
        const u = updated.find((u) => u.key === v.key);
        return u ? { ...v, allocationPercent: u.allocationPercent } : v;
      }),
    });
  }

  function patchTargeting(patch: Partial<TargetingConfig>) {
    onChange({ targeting: { ...state.targeting, ...patch } });
  }

  return (
    <div className="space-y-5">
      <FormSection
        title="Variant allocation"
        description="Set what percentage of test traffic is sent to each URL."
        accent={ACCENT}
      >
        <VariantAllocationEditor
          variants={allocationVariants}
          onChange={handleAllocationChange}
          accentHex={ACCENT}
        />
      </FormSection>

      <FormSection
        title="Targeting rules"
        description="Optionally restrict which visitors are enrolled in this test. All rules are additive (AND)."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Device type">
            <select
              value={state.targeting.deviceType}
              onChange={(e) => patchTargeting({ deviceType: e.target.value as TargetingConfig["deviceType"] })}
              className="input-base w-full"
            >
              <option value="all">All devices</option>
              <option value="mobile">Mobile only</option>
              <option value="desktop">Desktop only</option>
            </select>
          </FormField>

          <FormField label="Traffic source">
            <select
              value={state.targeting.trafficSource}
              onChange={(e) => patchTargeting({ trafficSource: e.target.value as TargetingConfig["trafficSource"] })}
              className="input-base w-full"
            >
              <option value="all">All sources</option>
              <option value="paid">Paid traffic (UTM) only</option>
              <option value="organic">Organic only</option>
            </select>
          </FormField>

          <FormField label="Visitor type">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={state.targeting.newVisitorsOnly}
                onClick={() => patchTargeting({ newVisitorsOnly: !state.targeting.newVisitorsOnly })}
                className="relative rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: state.targeting.newVisitorsOnly ? ACCENT : "#d1d5db",
                  height: "18px",
                  width: "32px",
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform"
                  style={{
                    transform: state.targeting.newVisitorsOnly ? "translateX(14px)" : "translateX(0)",
                    width: "14px",
                    height: "14px",
                  }}
                />
              </button>
              <span className="text-xs text-neutral-700">New visitors only</span>
            </label>
            <p className="text-[11px] text-neutral-400 mt-1">
              When enabled, returning visitors always see the control URL.
            </p>
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Settings
// ---------------------------------------------------------------------------
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  readOnly,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-neutral-800">{label}</p>
          {readOnly && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
        </div>
        {hint && <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={readOnly}
        onClick={() => !readOnly && onChange?.(!checked)}
        className="shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: checked ? ACCENT : "#d1d5db",
          height: "20px",
          width: "36px",
          position: "relative",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform"
          style={{
            transform: checked ? "translateX(16px)" : "translateX(0)",
            width: "16px",
            height: "16px",
          }}
        />
      </button>
    </div>
  );
}

function StepSettings({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <FormSection
        title="Redirect behaviour"
        description="Control how the redirect handles URL parameters."
        accent={ACCENT}
      >
        <div className="rounded-xl border border-neutral-100 divide-y divide-neutral-100 bg-white px-4">
          <ToggleRow
            label="Preserve query parameters"
            hint="Passes ?utm_source= etc. to the destination URL."
            checked={state.preserveQueryParams}
            onChange={(v) => onChange({ preserveQueryParams: v })}
          />
          <ToggleRow
            label="Preserve UTM parameters"
            hint="Ensures UTM attribution is not lost when a visitor is redirected."
            checked={state.preserveUtm}
            onChange={(v) => onChange({ preserveUtm: v })}
          />
          <ToggleRow
            label="Redirect loop protection"
            hint="Automatically stops redirect chains that would cause infinite loops. Cannot be disabled."
            checked={true}
            readOnly
          />
        </div>
      </FormSection>

      <FormSection
        title="SEO considerations"
        description="Be aware of how this test can affect search engine indexing."
        accent={ACCENT}
      >
        <div className="space-y-3">
          <InlineAlert variant="warning" title="Search engine indexing">
            Redirected URLs may be indexed by search engines. Consider adding{" "}
            <code className="font-mono text-xs">noindex</code> to test variant pages if you
            don&apos;t want them indexed during the experiment.
          </InlineAlert>
          <InlineAlert variant="info" title="Canonical URL">
            The control URL remains canonical. Variant pages should use{" "}
            <code className="font-mono text-xs">rel=canonical</code> pointing to the control if
            they share substantially similar content.
          </InlineAlert>
        </div>
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
  const totalAlloc = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  const allocOk = Math.abs(totalAlloc - 100) < 0.01;
  const controlEmpty = !state.variants.find((v) => v.isControl)?.redirectUrl.trim();
  const variantEmpty = state.variants.filter((v) => !v.isControl).some((v) => !v.redirectUrl.trim());
  const duplicates = hasDuplicateUrls(state.variants);
  const anyExternal = state.variants.some((v) => isExternalUrl(v.redirectUrl));
  const noTargeting =
    state.targeting.deviceType === "all" &&
    state.targeting.trafficSource === "all" &&
    !state.targeting.newVisitorsOnly;

  const checks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Test name provided",
      status: state.name.trim() ? "pass" : "block",
      detail: state.name.trim() ? undefined : "A test name is required.",
    },
    {
      id: "control-url",
      label: "Control URL set",
      status: controlEmpty ? "block" : "pass",
      detail: controlEmpty ? "Enter the original page URL on the URL Routes step." : undefined,
    },
    {
      id: "variant-urls",
      label: "All variant URLs set",
      status: variantEmpty ? "block" : "pass",
      detail: variantEmpty ? "Fill in every variant redirect URL before launching." : undefined,
    },
    {
      id: "duplicate-urls",
      label: "No duplicate URLs",
      status: duplicates ? "block" : "pass",
      detail: duplicates ? "Two or more variants share the same URL." : undefined,
    },
    {
      id: "allocation",
      label: "Traffic allocation sums to 100%",
      status: allocOk ? "pass" : "block",
      detail: allocOk ? undefined : `Currently ${totalAlloc.toFixed(1)}% — adjust on the Traffic step.`,
    },
    ...(anyExternal
      ? [
          {
            id: "external-urls",
            label: "External URLs detected",
            status: "warn" as const,
            detail: "Visitors will leave your store domain. Confirm this is intentional.",
          },
        ]
      : []),
    ...(noTargeting
      ? [
          {
            id: "no-targeting",
            label: "No targeting rules set",
            status: "warn" as const,
            detail: "All visitors are eligible. Consider narrowing the audience if needed.",
          },
        ]
      : []),
    {
      id: "hypothesis",
      label: "Hypothesis provided",
      status: state.hypothesis.trim() ? "pass" : "info",
      detail: state.hypothesis.trim() ? undefined : "Optional but recommended for tracking test intent.",
    },
  ];

  const hasBlockers = checks.some((c) => c.status === "block");

  return (
    <div className="space-y-5">
      <LaunchReadinessPanel checks={checks} accentHex={ACCENT} />

      {/* Summary table */}
      <FormSection
        title="URL routing summary"
        description="Each URL and its share of test traffic."
        accent={ACCENT}
      >
        <div className="rounded-xl border border-neutral-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="text-left px-3 py-2 font-medium text-neutral-500">Variant</th>
                <th className="text-left px-3 py-2 font-medium text-neutral-500">URL</th>
                <th className="text-left px-3 py-2 font-medium text-neutral-500">Type</th>
                <th className="text-right px-3 py-2 font-medium text-neutral-500">Traffic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {state.variants.map((v) => (
                <tr key={v.key} className="bg-white">
                  <td className="px-3 py-2.5 font-medium text-neutral-800">{v.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-neutral-600">
                      {v.redirectUrl || <span className="text-neutral-300 italic">not set</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {v.isControl ? (
                      <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        <Home className="w-2.5 h-2.5" /> Control
                      </span>
                    ) : isExternalUrl(v.redirectUrl) ? (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        <Globe className="w-2.5 h-2.5" /> External
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        <Shuffle className="w-2.5 h-2.5" /> Redirect
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">
                    {v.allocationPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>

      {/* Settings summary */}
      <FormSection title="Settings" accent={ACCENT}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-neutral-50 rounded-lg px-3 py-2.5">
            <p className="text-neutral-400">Traffic allocation</p>
            <p className="font-semibold text-neutral-800 mt-0.5">{state.trafficAllocation}% of visitors</p>
          </div>
          <div className="bg-neutral-50 rounded-lg px-3 py-2.5">
            <p className="text-neutral-400">Device target</p>
            <p className="font-semibold text-neutral-800 mt-0.5 capitalize">
              {state.targeting.deviceType === "all" ? "All devices" : state.targeting.deviceType}
            </p>
          </div>
          <div className="bg-neutral-50 rounded-lg px-3 py-2.5">
            <p className="text-neutral-400">Traffic source</p>
            <p className="font-semibold text-neutral-800 mt-0.5 capitalize">
              {state.targeting.trafficSource === "all"
                ? "All sources"
                : state.targeting.trafficSource === "paid"
                ? "Paid (UTM)"
                : "Organic"}
            </p>
          </div>
          <div className="bg-neutral-50 rounded-lg px-3 py-2.5">
            <p className="text-neutral-400">New visitors only</p>
            <p className="font-semibold text-neutral-800 mt-0.5">
              {state.targeting.newVisitorsOnly ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Create button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={hasBlockers || saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
        style={
          hasBlockers || saving
            ? { background: "#9ca3af" }
            : { background: ACCENT_GRADIENT }
        }
      >
        {saving ? "Creating test…" : "Create Split URL Test"}
      </button>

      <p className="text-[11px] text-center text-neutral-400">
        Saved as <strong>draft</strong> — activate from the test detail page when ready.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell — two-panel layout
// ---------------------------------------------------------------------------
export function SplitUrlWizard() {
  const router = useRouter();
  const { success: showSuccess } = useToast();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Per-step validation for the Continue button
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.name.trim().length > 0;
      case 1: {
        const controlUrl = state.variants.find((v) => v.isControl)?.redirectUrl.trim() ?? "";
        const variantsOk = state.variants.filter((v) => !v.isControl).every((v) => v.redirectUrl.trim());
        return (
          controlUrl.length > 0 &&
          variantsOk &&
          !hasDuplicateUrls(state.variants) &&
          state.variants.every((v) => v.redirectUrl.trim().length === 0 || isValidUrl(v.redirectUrl))
        );
      }
      case 2: {
        const total = state.variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
        return Math.abs(total - 100) < 0.01;
      }
      default:
        return true;
    }
  }, [step, state]);

  const blockingIssue = useMemo(() => {
    if (canAdvance) return undefined;
    switch (step) {
      case 0:
        return "Test name is required";
      case 1:
        return hasDuplicateUrls(state.variants)
          ? "Duplicate URLs"
          : "Fill in all URLs";
      case 2:
        return "Allocation must total 100%";
      default:
        return undefined;
    }
  }, [step, state, canAdvance]);

  const stepDefs: WizardStep[] = STEP_DEFS.map((s, i) => ({
    ...s,
    status: i < step ? "complete" : i === step ? "active" : "pending",
  }));

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const controlVariant = state.variants.find((v) => v.isControl);
      const payload = {
        name: state.name,
        hypothesis: state.hypothesis,
        trafficAllocation: state.trafficAllocation,
        splitUrlConfig: {
          baseUrl: controlVariant?.redirectUrl ?? "",
          preserveQueryParams: state.preserveQueryParams,
          preserveUtm: state.preserveUtm,
        },
        targeting: state.targeting,
        variants: state.variants.map((v) => ({
          key: v.key,
          name: v.name,
          isControl: v.isControl,
          allocationPercent: v.allocationPercent,
          redirectUrl: v.isControl ? "" : v.redirectUrl,
        })),
      };

      const res = await fetch("/api/split-url-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Failed to create test");
      }

      showSuccess(`Split URL test "${state.name}" created — activate it from the test detail page.`);
      router.push("/split-url-tests");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create test. Check your connection and try again.");
      setSaving(false);
    }
  }, [state, router, showSuccess]);

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => (s - 1) as StepIndex);
    }
  }, [step, router]);

  const handleNext = useCallback(() => {
    if (step < STEP_DEFS.length - 1) {
      setStep((s) => (s + 1) as StepIndex);
    } else {
      handleSubmit();
    }
  }, [step, handleSubmit]);

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-neutral-100 flex-col">
        {/* Sidebar header */}
        <div
          className="px-4 pt-5 pb-4 border-b border-neutral-50"
          style={{ background: `${SKY}0a` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${SKY}18` }}
          >
            <span className="text-base leading-none" style={{ color: SKY }}>⇄</span>
          </div>
          <p className="text-xs font-bold text-neutral-800">Split URL Test</p>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            Route visitors between different URLs and measure which landing page converts better.
          </p>
        </div>

        {/* Step nav */}
        <div className="flex-1 p-3 overflow-auto">
          <WizardStepNav
            orientation="vertical"
            steps={stepDefs}
            currentStep={step}
            accentHex={SKY}
            onStepClick={(i) => {
              if (i < step) setStep(i as StepIndex);
            }}
          />
        </div>

        {/* Sidebar footer note */}
        <div className="p-3 border-t border-neutral-50">
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Redirects happen server-side. Visitors are assigned once per session.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 bg-white shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: SKY }}
          >
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 p-6">
            {/* Step form content */}
            <div className="flex-1 min-w-0 space-y-5">
              {step === 0 && <StepSetup state={state} onChange={patch} />}
              {step === 1 && <StepUrlRoutes state={state} onChange={patch} />}
              {step === 2 && <StepTrafficTargeting state={state} onChange={patch} />}
              {step === 3 && <StepSettings state={state} onChange={patch} />}
              {step === 4 && (
                <StepReview state={state} onSubmit={handleSubmit} saving={saving} />
              )}

              {submitError && (
                <div className="mt-4">
                  <InlineAlert variant="danger" title="Failed to create test">
                    {submitError}
                  </InlineAlert>
                </div>
              )}
            </div>

            {/* Right sidebar preview panel — lazy loaded for bundle splitting */}
            <aside className="w-72 xl:w-80 shrink-0 self-start sticky top-6">
              <Suspense fallback={<div className="rounded-2xl border border-neutral-100 bg-white h-64 animate-pulse" />}>
                <SplitUrlPreviewPanel
                  step={step}
                  name={state.name}
                  trafficAllocation={state.trafficAllocation}
                  variants={state.variants}
                  targeting={state.targeting}
                  preserveQueryParams={state.preserveQueryParams}
                  preserveUtm={state.preserveUtm}
                />
              </Suspense>
            </aside>
          </div>
        </div>

        {/* Sticky footer — not shown on review step (has its own CTA) */}
        {step < 4 && (
          <StickyFormActions
            step={step}
            totalSteps={STEP_DEFS.length}
            onBack={handleBack}
            onNext={handleNext}
            canContinue={canAdvance}
            isLastStep={false}
            continueLabel={CONTINUE_LABELS[step]}
            accentHex={SKY}
            blockingIssue={blockingIssue}
          />
        )}
      </div>
    </div>
  );
}
