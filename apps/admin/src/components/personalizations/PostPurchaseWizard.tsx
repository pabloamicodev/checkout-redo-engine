"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Plus, X, ChevronRight, ArrowLeft, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { WizardLayout } from "@/components/layout/WizardLayout";
import { type WizardStep } from "@/components/experiments/WizardStepNav";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const FUCHSIA = "#c026d3";
const ACCENT = FUCHSIA;
const ACCENT_GRADIENT = "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)";

const TYPE_LABEL: Record<string, string> = {
  PERCENTAGE_DISCOUNT: "% Discount",
  FIXED_AMOUNT_DISCOUNT: "Fixed Amount",
  PRODUCT_DISCOUNT: "Product Discount",
  ORDER_DISCOUNT: "Order Discount",
  FREE_SHIPPING: "Free Shipping",
  FREE_GIFT: "Free Gift",
  VOLUME_DISCOUNT: "Volume Discount",
  QUANTITY_BREAK: "Quantity Break",
  BUY_X_GET_Y: "Buy X Get Y",
  TIERED_PROGRESS_BAR: "Tiered Bar",
  CAMPAIGN_LINK_OFFER: "Campaign Link",
};

const RULE_TYPE_OPTIONS = [
  { value: "visitor_type",   label: "Visitor type" },
  { value: "device_type",    label: "Device type" },
  { value: "utm_source",     label: "UTM source" },
  { value: "utm_medium",     label: "UTM medium" },
  { value: "utm_campaign",   label: "UTM campaign" },
  { value: "cart_value_min", label: "Cart value min ($)" },
  { value: "cart_value_max", label: "Cart value max ($)" },
  { value: "url_contains",   label: "URL contains" },
  { value: "country",        label: "Country code" },
  { value: "customer_tag",   label: "Customer tag" },
] as const;

type RuleType = (typeof RULE_TYPE_OPTIONS)[number]["value"];

const STEP_DEFS: WizardStep[] = [
  { label: "Setup" },
  { label: "Audience" },
  { label: "Offer" },
  { label: "Schedule" },
  { label: "Review" },
];

const STEP_LABELS = ["Setup", "Audience", "Offer", "Schedule", "Review"];

const STEP_TITLES = [
  "Set up post-purchase personalization",
  "Build your audience",
  "Choose the offer",
  "Set a schedule",
  "Review and publish",
];

const STEP_DESCS = [
  "Name this personalization and set its priority. It will appear on the post-purchase page.",
  "Define targeting rules to specify which visitors will see this personalization.",
  "Select the offers to show to visitors who match your audience rules.",
  "Optionally set a start and end date for this personalization to run automatically.",
  "Review the post-purchase personalization configuration and publish when ready.",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailableOffer {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface AudienceRule {
  id: string;
  type: RuleType;
  value: string;
}

interface Props {
  availableOffers: AvailableOffer[];
}

type StepIndex = 0 | 1 | 2 | 3 | 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultValueForType(type: RuleType): string {
  if (type === "visitor_type") return "returning";
  if (type === "device_type")  return "mobile";
  return "";
}

// ─── Rule type metadata ───────────────────────────────────────────────────────

const RULE_META: Record<RuleType, { icon: string; color: string; bg: string; border: string }> = {
  visitor_type:   { icon: "👤", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  device_type:    { icon: "📱", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  utm_source:     { icon: "🔗", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  utm_medium:     { icon: "🔗", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  utm_campaign:   { icon: "🔗", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  cart_value_min: { icon: "🛒", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  cart_value_max: { icon: "🛒", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  url_contains:   { icon: "🌐", color: "#7c3aed", bg: "#faf5ff", border: "#ddd6fe" },
  country:        { icon: "🌍", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  customer_tag:   { icon: "🏷", color: "#db2777", bg: "#fdf2f8", border: "#fbcfe8" },
};

function ruleToSentence(rule: AudienceRule): string {
  const v = rule.value;
  switch (rule.type) {
    case "visitor_type":   return v === "returning" ? "Returning visitors only" : "New visitors only";
    case "device_type":    return `${v.charAt(0).toUpperCase() + v.slice(1)} devices only`;
    case "utm_source":     return `Traffic from ${v}`;
    case "utm_medium":     return `UTM medium is ${v}`;
    case "utm_campaign":   return `UTM campaign is ${v}`;
    case "cart_value_min": return `Cart value ≥ $${v}`;
    case "cart_value_max": return `Cart value ≤ $${v}`;
    case "url_contains":   return `URL contains ${v}`;
    case "country":        return `From ${v}`;
    case "customer_tag":   return `Tagged as ${v}`;
    default:               return `${rule.type} = ${v}`;
  }
}

// ─── Rule value editor ────────────────────────────────────────────────────────

function RuleValueEditor({
  rule,
  onChange,
}: {
  rule: AudienceRule;
  onChange: (value: string) => void;
}) {
  if (rule.type === "visitor_type") {
    return (
      <div className="flex items-center gap-3">
        {(["new", "returning"] as const).map((v) => (
          <label key={v} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`vt-${rule.id}`}
              value={v}
              checked={rule.value === v}
              onChange={() => onChange(v)}
              className="accent-fuchsia-600"
            />
            <span className="text-xs text-neutral-700 capitalize">{v} visitor</span>
          </label>
        ))}
      </div>
    );
  }

  if (rule.type === "device_type") {
    return (
      <div className="flex items-center gap-3">
        {(["mobile", "desktop", "tablet"] as const).map((v) => (
          <label key={v} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`dt-${rule.id}`}
              value={v}
              checked={rule.value === v}
              onChange={() => onChange(v)}
              className="accent-fuchsia-600"
            />
            <span className="text-xs text-neutral-700 capitalize">{v}</span>
          </label>
        ))}
      </div>
    );
  }

  const placeholders: Partial<Record<RuleType, string>> = {
    utm_source:     "google",
    utm_medium:     "cpc",
    utm_campaign:   "summer-sale",
    cart_value_min: "50",
    cart_value_max: "500",
    url_contains:   "/collections/sale",
    country:        "US",
    customer_tag:   "vip",
  };

  const prefix = (rule.type === "cart_value_min" || rule.type === "cart_value_max") ? "$" : undefined;

  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-xs text-neutral-400 font-medium">{prefix}</span>}
      <input
        type={rule.type.startsWith("cart_value") ? "number" : "text"}
        min={0}
        value={rule.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholders[rule.type] ?? "value"}
        className="input-base h-8 text-xs py-1 px-2 min-w-0 w-40"
      />
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

function PersonalizationPreviewPanel({
  step,
  name,
  description,
  priority,
  rules,
  selectedOfferIds,
  startsAt,
  endsAt,
  availableOffers,
}: {
  step: number;
  name: string;
  description: string;
  priority: number;
  rules: AudienceRule[];
  selectedOfferIds: string[];
  startsAt: string;
  endsAt: string;
  availableOffers: AvailableOffer[];
}) {
  const completedSteps = [
    name.trim().length > 0,
    true,
    selectedOfferIds.length > 0,
    true,
    false,
  ];

  const reachPercent = rules.length === 0 ? 100 : rules.length === 1 ? 60 : rules.length === 2 ? 35 : 15;

  const stepContent = (() => {
    if (step === 0) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-50" style={{ background: `${ACCENT}08` }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                Post-Purchase Identity
              </p>
              <p className="text-sm font-bold text-neutral-900 leading-snug">
                {name.trim() || <span className="text-neutral-300 font-normal italic">Untitled personalization</span>}
              </p>
              {description.trim() && (
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{description.trim()}</p>
              )}
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">Evaluation priority</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${ACCENT}18`, color: FUCHSIA }}
              >
                #{priority}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-3">
              Priority Stack
            </p>
            <div className="space-y-1.5">
              {priority > 1 && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-300 font-mono w-4 text-right">{priority - 1}</span>
                  <div className="flex-1 h-2 rounded bg-neutral-100" />
                  <span className="text-[10px] text-neutral-300">other</span>
                </div>
              )}
              <div
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}30` }}
              >
                <span className="text-[10px] font-mono font-bold w-4 text-right" style={{ color: FUCHSIA }}>
                  {priority}
                </span>
                <span className="flex-1 text-[11px] font-semibold text-neutral-700 truncate">
                  {name.trim() || "This personalization"}
                </span>
                <span className="text-[10px] font-medium" style={{ color: FUCHSIA }}>you</span>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-300 font-mono w-4 text-right">{priority + 1}</span>
                <div className="flex-1 h-2 rounded bg-neutral-100" />
                <span className="text-[10px] text-neutral-300">other</span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 mt-3 leading-relaxed">
              Lower priority number = evaluated first when multiple rules match.
            </p>
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Audience Summary
              </p>
            </div>
            <div className="px-4 py-3">
              {rules.length === 0 ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-amber-500 text-sm mt-px">⚠</span>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    This personalization will show to <strong>ALL post-purchase visitors</strong>. Add targeting rules to narrow the audience.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, idx) => (
                    <div key={rule.id}>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border"
                        style={{
                          background: RULE_META[rule.type]?.bg ?? "#f9fafb",
                          borderColor: RULE_META[rule.type]?.border ?? "#e5e7eb",
                          color: RULE_META[rule.type]?.color ?? "#374151",
                        }}
                      >
                        <span>{RULE_META[rule.type]?.icon ?? "•"}</span>
                        <span>{ruleToSentence(rule)}</span>
                      </div>
                      {idx < rules.length - 1 && (
                        <div className="flex items-center gap-1.5 pl-4 py-0.5">
                          <div className="w-px h-3 bg-neutral-200" />
                          <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-wider">AND</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Est. Audience Reach
              </p>
              <span className="text-sm font-bold text-neutral-800">{reachPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${reachPercent}%`,
                  background: reachPercent > 60
                    ? ACCENT_GRADIENT
                    : reachPercent > 30
                    ? "linear-gradient(90deg, #f59e0b, #ea580c)"
                    : "linear-gradient(90deg, #10b981, #059669)",
                }}
              />
            </div>
            <p className="text-[10px] text-neutral-400 mt-2">
              {rules.length === 0
                ? "All post-purchase visitors — no targeting rules applied."
                : `Based on ${rules.length} rule${rules.length !== 1 ? "s" : ""}. Actual reach depends on your traffic mix.`}
            </p>
          </div>
        </div>
      );
    }

    if (step === 2) {
      const selectedOffers = availableOffers.filter((o) => selectedOfferIds.includes(o.id));
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-50 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Selected Offer
              </p>
              {selectedOfferIds.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${ACCENT}18`, color: FUCHSIA }}
                >
                  {selectedOfferIds.length} offer{selectedOfferIds.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="px-4 py-3">
              {selectedOfferIds.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No offers selected yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedOffers.length > 0
                    ? selectedOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: FUCHSIA }}
                          />
                          <span className="text-xs font-medium text-neutral-800 truncate flex-1">
                            {offer.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 shrink-0">
                            {TYPE_LABEL[offer.type] ?? offer.type}
                          </span>
                        </div>
                      ))
                    : selectedOfferIds.map((id) => (
                        <div
                          key={id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: FUCHSIA }}
                          />
                          <span className="text-[10px] font-mono text-neutral-500 truncate">
                            {id.slice(0, 8)}...
                          </span>
                        </div>
                      ))}
                  <p className="text-[10px] text-neutral-400 pt-1">
                    {selectedOfferIds.length} offer{selectedOfferIds.length !== 1 ? "s" : ""} will be shown on the post-purchase page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (step === 3) {
      const fmtDate = (dt: string) => {
        if (!dt) return null;
        try {
          return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        } catch {
          return dt;
        }
      };
      const startLabel = fmtDate(startsAt);
      const endLabel = fmtDate(endsAt);

      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Schedule
              </p>
            </div>
            <div className="px-4 py-4">
              {!startsAt && !endsAt ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs text-neutral-700 font-medium">Always active (no expiry)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative pt-2 pb-2">
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                      <span className="shrink-0 font-medium text-neutral-400">Now</span>
                      <div className="flex-1 flex items-center gap-0.5">
                        <div className="flex-1 h-px bg-neutral-200" />
                        {startLabel && (
                          <>
                            <div
                              className="w-2 h-2 rounded-full shrink-0 border-2"
                              style={{ borderColor: FUCHSIA, background: "white" }}
                            />
                            <div className="flex-1 h-px" style={{ background: FUCHSIA }} />
                          </>
                        )}
                        {endLabel && (
                          <>
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: FUCHSIA }}
                            />
                            <div className="flex-1 h-px bg-neutral-200" />
                          </>
                        )}
                        <span className="shrink-0 text-neutral-300">→</span>
                      </div>
                    </div>
                    <div className="flex items-start mt-1">
                      <span className="w-10 shrink-0" />
                      {startLabel && (
                        <div className="flex-1 text-center">
                          <p className="text-[10px] font-semibold text-neutral-700">{startLabel}</p>
                          <p className="text-[9px] text-neutral-400">Start</p>
                        </div>
                      )}
                      {endLabel && (
                        <div className="flex-1 text-center">
                          <p className="text-[10px] font-semibold text-neutral-700">{endLabel}</p>
                          <p className="text-[9px] text-neutral-400">End</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {startLabel && (
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <span className="text-neutral-300">From</span>
                      <span className="font-medium">{startLabel}</span>
                    </div>
                  )}
                  {endLabel && (
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <span className="text-neutral-300">Until</span>
                      <span className="font-medium">{endLabel}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  })();

  return (
    <div className="space-y-4">
      {stepContent}

      <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Configuration
          </p>
        </div>
        <div className="px-4 py-3 space-y-2">
          <MiniRow label="Name" value={name.trim() || <span className="text-neutral-300 italic">—</span>} />
          <MiniRow label="Priority" value={`#${priority}`} />
          <MiniRow
            label="Rules"
            value={rules.length === 0 ? <span className="text-amber-500">All visitors</span> : `${rules.length} rule${rules.length !== 1 ? "s" : ""}`}
          />
          <MiniRow
            label="Offers"
            value={selectedOfferIds.length === 0 ? <span className="text-neutral-300">None</span> : `${selectedOfferIds.length} selected`}
          />
          <MiniRow
            label="Schedule"
            value={startsAt || endsAt ? "Date-bound" : "Always active"}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-100 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5">
          Readiness
        </p>
        <div className="flex items-center gap-1.5">
          {completedSteps.slice(0, 4).map((done, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-1.5 rounded-full transition-all duration-300"
                style={{ background: done ? FUCHSIA : "#e5e7eb" }}
              />
              <span className="text-[9px] text-neutral-400 truncate w-full text-center">
                {STEP_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
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

// ─── Main component ───────────────────────────────────────────────────────────

export function PostPurchaseWizard({ availableOffers }: Props) {
  const router = useRouter();
  const { success: showSuccess } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Setup
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(100);

  // Step 2 — Audience
  const [rules, setRules] = useState<AudienceRule[]>([]);

  // Step 3 — Offer
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);

  // Step 4 — Schedule
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Offers attempted (for inline validation on step 3)
  const [offersAttempted, setOffersAttempted] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const scheduleError: string | null = (() => {
    if (!startsAt || !endsAt) return null;
    if (new Date(endsAt) <= new Date(startsAt)) return "End date must be after start date.";
    return null;
  })();

  const endInPast = endsAt && new Date(endsAt) < new Date() && !scheduleError;

  const endDateInPastError = endsAt && new Date(endsAt) < new Date() ? "End date cannot be in the past" : undefined;

  const canAdvanceStep: Record<number, boolean> = {
    0: name.trim().length > 0,
    1: true,
    2: availableOffers.length === 0 || selectedOfferIds.length > 0,
    3: !scheduleError && !endDateInPastError,
    4: name.trim().length > 0 && selectedOfferIds.length > 0,
  };

  const blockingIssueForStep: Record<number, string | undefined> = {
    0: name.trim() ? undefined : "Name is required",
    1: undefined,
    2: availableOffers.length > 0 && selectedOfferIds.length === 0 ? "Select at least one offer" : undefined,
    3: scheduleError ?? endDateInPastError,
    4: !name.trim() ? "Name is required" : selectedOfferIds.length === 0 ? "No offers selected" : undefined,
  };

  // ── Rule helpers ──────────────────────────────────────────────────────────────

  function addRule() {
    const type: RuleType = "visitor_type";
    setRules((prev) => [...prev, { id: uid(), type, value: defaultValueForType(type) }]);
  }

  function updateRuleType(id: string, type: RuleType) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type, value: defaultValueForType(type) } : r))
    );
  }

  function updateRuleValue(id: string, value: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Offer helpers ─────────────────────────────────────────────────────────────

  function toggleOffer(id: string) {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || selectedOfferIds.length === 0) return;

    setSaving(true);
    setError(null);

    const targetingRules = rules
      .filter((r) => r.value.trim() !== "")
      .map((r) => ({ type: r.type, value: r.value.trim() }));

    try {
      const res = await fetch("/api/personalizations/post-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          offerIds: selectedOfferIds,
          priority,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          targetingRules,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown };
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to create personalization"
        );
      }

      showSuccess(`Post-purchase offer "${name.trim()}" created — activate it from the detail page.`);
      router.push("/personalizations/post-purchase");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create personalization. Check your connection and try again.");
      setSaving(false);
    }
  }, [name, selectedOfferIds, rules, priority, startsAt, endsAt, router, showSuccess]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const handleNext = useCallback(() => {
    if (step === 2 && availableOffers.length > 0 && selectedOfferIds.length === 0) {
      setOffersAttempted(true);
      return;
    }
    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      void handleSubmit();
    }
  }, [step, handleSubmit]);

  // ── Readiness checks ──────────────────────────────────────────────────────────

  const readinessChecks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Personalization name",
      status: name.trim() ? "pass" : "block",
      detail: name.trim() ? `"${name.trim()}"` : "A name is required before creating.",
    },
    {
      id: "offers",
      label: "Offers selected",
      status: selectedOfferIds.length > 0 ? "pass" : "block",
      detail:
        selectedOfferIds.length > 0
          ? `${selectedOfferIds.length} offer${selectedOfferIds.length !== 1 ? "s" : ""} attached`
          : "Select at least one offer in Step 3.",
    },
    {
      id: "audience",
      label: "Audience rules",
      status: rules.length > 0 ? "pass" : "warn",
      detail:
        rules.length > 0
          ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} — AND logic`
          : "No rules set — will show to ALL post-purchase visitors.",
    },
    {
      id: "extension",
      label: "Shopify extension",
      status: "warn",
      detail: "Requires the Shopify post-purchase checkout extension to be installed in your theme.",
    },
    {
      id: "draft",
      label: "Created as DRAFT",
      status: "info",
      detail: "This personalization will be saved as DRAFT. Activate it from the list when ready.",
    },
  ];

  const hasBlockers = readinessChecks.some((c) => c.status === "block");
  void hasBlockers;

  // ── Step content ──────────────────────────────────────────────────────────────

  const stepContent = [
    // Step 1: Setup
    <div key="setup" className="space-y-5">
      <InlineAlert variant="warning">
        Requires the Shopify post-purchase checkout extension to be installed.
      </InlineAlert>

      <FormSection title="Basic info" accent={ACCENT}>
        <div className="space-y-4">
          <FormField label="Name" required hint="A short internal name to identify this personalization.">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Post-Purchase Upsell — VIP Customers"
              className="input-base"
              autoFocus
            />
          </FormField>

          <FormField label="Description" hint="Optional internal notes about what this personalization does.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Show a special offer on the thank-you page to returning customers"
              rows={2}
              className="input-base resize-none"
            />
          </FormField>

          <FormField
            label="Priority"
            hint="Lower number = evaluated first when multiple personalizations match. Default: 100"
          >
            <input
              type="number"
              min={0}
              max={9999}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              className="input-base w-32"
            />
          </FormField>
        </div>
      </FormSection>
    </div>,

    // Step 2: Audience
    <div key="audience" className="space-y-5">
      <FormSection
        title="Who should see this post-purchase personalization?"
        description="Define rules to target a specific segment. All rules must match (AND logic)."
        accent={ACCENT}
      >
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-xs text-neutral-400 py-2">No rules yet — click &quot;Add targeting rule&quot; below.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, idx) => {
                const meta = RULE_META[rule.type];
                return (
                  <div key={rule.id}>
                    {idx > 0 && (
                      <div className="flex items-center gap-2 pl-3 py-1">
                        <div className="w-px h-3 bg-neutral-200 ml-1" />
                        <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-wider">AND</span>
                      </div>
                    )}
                    <div
                      className="group flex items-start gap-3 p-3 bg-white rounded-xl border shadow-xs transition-shadow hover:shadow-sm"
                      style={{ borderColor: meta?.border ?? "#e5e7eb" }}
                    >
                      <div
                        className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold border"
                        style={{
                          background: meta?.bg ?? "#f9fafb",
                          borderColor: meta?.border ?? "#e5e7eb",
                          color: meta?.color ?? "#374151",
                        }}
                      >
                        <span>{meta?.icon ?? "•"}</span>
                        <select
                          value={rule.type}
                          onChange={(e) => updateRuleType(rule.id, e.target.value as RuleType)}
                          className="bg-transparent border-none outline-none cursor-pointer font-semibold text-[10px] pr-1"
                          style={{ color: meta?.color ?? "#374151" }}
                        >
                          {RULE_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <RuleValueEditor rule={rule} onChange={(v) => updateRuleValue(rule.id, v)} />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-400 transition-all mt-0.5"
                        title="Remove rule"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={addRule}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-fuchsia-300 hover:text-fuchsia-600 hover:bg-fuchsia-50/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add targeting rule
          </button>
        </div>
      </FormSection>

      <InlineAlert variant="info">
        Rules use AND logic — visitors must match ALL rules to see this personalization.
      </InlineAlert>

      {rules.length === 0 && (
        <InlineAlert variant="warning">
          No audience rules set. This personalization will be shown to <strong>all post-purchase visitors</strong>.
          Add at least one rule to target a specific segment.
        </InlineAlert>
      )}

      <InlineAlert variant="info">
        If this matches the same audience as another active personalization, the one with the lower
        priority number wins. Current priority: <strong>{priority}</strong>.
      </InlineAlert>
    </div>,

    // Step 3: Offer
    <div key="offer" className="space-y-5">
      <FormSection
        title="What should matching visitors see?"
        description="Select the offers to show on the post-purchase page to visitors who match your audience rules."
        accent={ACCENT}
      >
        {availableOffers.length === 0 ? (
          <div className="space-y-3">
            <InlineAlert variant="warning">
              No active offers found. Create an offer in Offers Library first, then come back to
              attach it here.
            </InlineAlert>
            <a
              href="/offers-library/new"
              className="inline-flex items-center gap-1 text-xs font-medium text-fuchsia-700 hover:text-fuchsia-900 transition-colors"
            >
              Go to Offers Library
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {availableOffers.map((offer) => {
              const selected = selectedOfferIds.includes(offer.id);
              return (
                <label
                  key={offer.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                    selected
                      ? "border-fuchsia-300 bg-fuchsia-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-fuchsia-200 hover:bg-fuchsia-50/40",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleOffer(offer.id)}
                    className="rounded accent-fuchsia-600 shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-neutral-900 truncate">
                      {offer.name}
                    </span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="neutral">{TYPE_LABEL[offer.type] ?? offer.type}</Badge>
                    <Badge variant={offer.status === "ACTIVE" ? "success" : "neutral"} dot>
                      {offer.status.charAt(0) + offer.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </FormSection>

      {availableOffers.length > 0 && selectedOfferIds.length === 0 && offersAttempted && (
        <p className="text-xs text-red-500 mt-1">Select at least one offer to continue</p>
      )}

      {availableOffers.length > 0 && selectedOfferIds.length === 0 && (
        <InlineAlert variant="warning">
          No offers selected. Select at least one offer to continue.
        </InlineAlert>
      )}
    </div>,

    // Step 4: Schedule
    <div key="schedule" className="space-y-5">
      <FormSection
        title="Schedule"
        description="Optionally restrict when this post-purchase personalization is active."
        accent={ACCENT}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start date" hint="Leave blank to activate immediately.">
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input-base"
            />
          </FormField>
          <FormField label="End date" hint="Leave blank for no expiry.">
            <input
              type="datetime-local"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
              className={`input-base${scheduleError || (endsAt && new Date(endsAt) < new Date()) ? " border-red-400" : ""}`}
            />
            {scheduleError && (
              <p className="text-xs text-red-500 mt-1">End date must be after start date</p>
            )}
            {!scheduleError && endsAt && new Date(endsAt) < new Date() && (
              <p className="text-xs text-red-500 mt-1">End date cannot be in the past</p>
            )}
          </FormField>
        </div>
      </FormSection>

      {scheduleError && (
        <InlineAlert variant="danger">{scheduleError}</InlineAlert>
      )}

      {endInPast && (
        <InlineAlert variant="warning">
          The end date is in the past. This personalization will expire immediately upon activation.
        </InlineAlert>
      )}

      {!startsAt && !endsAt && (
        <InlineAlert variant="info">
          No schedule set — this personalization will be active immediately after you activate it
          and run indefinitely.
        </InlineAlert>
      )}
    </div>,

    // Step 5: Review
    <div key="review" className="space-y-6">
      <LaunchReadinessPanel checks={readinessChecks} accentHex={ACCENT} />

      <div className="bg-white rounded-xl border border-neutral-100 divide-y divide-neutral-100">
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Summary</p>
          <dl className="space-y-2.5">
            <SummaryRow label="Name" value={name || <span className="text-neutral-400 italic">Not set</span>} />
            <SummaryRow
              label="Audience rules"
              value={
                rules.length > 0
                  ? `${rules.length} rule${rules.length !== 1 ? "s" : ""}`
                  : <span className="text-amber-600 text-xs">None — targets all visitors</span>
              }
            />
            <SummaryRow
              label="Offers"
              value={
                selectedOfferIds.length > 0
                  ? `${selectedOfferIds.length} offer${selectedOfferIds.length !== 1 ? "s" : ""} selected`
                  : <span className="text-red-500 text-xs">None selected</span>
              }
            />
            <SummaryRow
              label="Schedule"
              value={
                startsAt || endsAt
                  ? [startsAt && `From ${startsAt}`, endsAt && `Until ${endsAt}`].filter(Boolean).join(" · ")
                  : "No schedule (runs indefinitely)"
              }
            />
            <SummaryRow label="Priority" value={String(priority)} />
            <SummaryRow label="Type" value="Post-Purchase" />
          </dl>
        </div>
      </div>

      {error && (
        <InlineAlert variant="danger">{error}</InlineAlert>
      )}
    </div>,
  ];

  // ── Step nav ──────────────────────────────────────────────────────────────────

  const wizardSteps: WizardStep[] = STEP_DEFS.map((s, i) => ({
    ...s,
    status:
      i < step
        ? "complete"
        : i === step
        ? "active"
        : "pending",
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <WizardLayout
      title="Post-Purchase"
      subtitle="Target post-checkout visitors with specific offers"
      icon={<span className="text-base leading-none">◎</span>}
      accentHex={FUCHSIA}
      steps={wizardSteps}
      currentStep={step}
      onStepClick={(i) => { if (i < step) setStep(i as StepIndex); }}
      onCancel={() => router.back()}
      previewPanel={
        step < 4 ? (
          <PersonalizationPreviewPanel
            step={step}
            name={name}
            description={description}
            priority={priority}
            rules={rules}
            selectedOfferIds={selectedOfferIds}
            startsAt={startsAt}
            endsAt={endsAt}
            availableOffers={availableOffers}
          />
        ) : undefined
      }
      previewLabel="Live Preview"
      stickyActions={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            {step === 0 ? "Cancel" : <><ArrowLeft className="w-3.5 h-3.5" /> Back</>}
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvanceStep[step]}
              title={blockingIssueForStep[step]}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: `linear-gradient(135deg, ${FUCHSIA} 0%, #a21caf 100%)` }}
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !canAdvanceStep[4]}
              title={blockingIssueForStep[4]}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
              style={{ background: FUCHSIA }}
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Create Post-Purchase Personalization"}
            </button>
          )}
        </div>
      }
    >
      {/* Step header — sticky */}
      <div className="sticky top-0 z-10 px-6 pt-5 pb-4 border-b border-neutral-100 bg-white">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
          style={{ color: FUCHSIA }}
        >
          Step {step + 1} of {STEP_LABELS.length}
        </p>
        <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[step]}</h1>
        <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[step]}</p>
      </div>

      {/* Step content */}
      <div className="p-6 space-y-5">
        {stepContent[step]}
      </div>
    </WizardLayout>
  );
}

// ─── Summary row helper ───────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-neutral-500 shrink-0 w-32">{label}</dt>
      <dd className="text-xs font-medium text-neutral-800 text-right">{value}</dd>
    </div>
  );
}
