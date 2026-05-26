"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ShoppingCart,
  Play,
  Pause,
  Trash2,
  ChevronRight,
  X,
  ArrowLeft,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { WizardLayout } from "@/components/layout/WizardLayout";
import { type WizardStep } from "@/components/experiments/WizardStepNav";
import { FormSection, FormField } from "@/components/forms/FormSection";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AcrItem {
  id: string;
  name: string;
  status: string;
  priority: number;
  modifications: Record<string, unknown>[];
  targetingRules: Record<string, unknown>[];
  offerIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialItems: AcrItem[];
  initialShowWizard?: boolean;
  redirectAfterCreate?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
  ACTIVE:    "#10b981",
  DRAFT:     "#94a3b8",
  PAUSED:    "#f59e0b",
  SCHEDULED: "#6366f1",
};

const ACCENT = "#6366f1";
const ACCENT_GRADIENT = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";

type WizardStepIndex = 0 | 1 | 2 | 3;

const STEP_DEFS: WizardStep[] = [
  { label: "Message",   sublabel: "Banner text & CTA" },
  { label: "Targeting", sublabel: "Trigger conditions" },
  { label: "Schedule",  sublabel: "Timing & priority" },
  { label: "Review",    sublabel: "Confirm & create" },
];

const STEP_LABELS = ["Message", "Targeting", "Schedule", "Review"];

const STEP_TITLES = [
  "Craft your message",
  "Set targeting rules",
  "Configure schedule",
  "Review & create",
];

const STEP_DESCS = [
  "Write the banner copy that will re-engage visitors who left items in their cart.",
  "Define when the banner appears — inactivity window, cart value threshold, and visitor type.",
  "Optionally set a start/end date and priority for this recovery campaign.",
  "Review all settings before creating the recovery. It will be saved as a Draft.",
];

interface WizardForm {
  name: string;
  message: string;
  subtext: string;
  ctaLabel: string;
  ctaUrl: string;
  inactivityMinutes: number;
  minCartValue: number;
  returningOnly: boolean;
  startsAt: string;
  endsAt: string;
  priority: number;
}

const DEFAULT_FORM: WizardForm = {
  name: "",
  message: "",
  subtext: "",
  ctaLabel: "Complete your order",
  ctaUrl: "/cart",
  inactivityMinutes: 30,
  minCartValue: 0,
  returningOnly: true,
  startsAt: "",
  endsAt: "",
  priority: 100,
};

// ── Preview panel ─────────────────────────────────────────────────────────────

function AbandonedCartPreviewPanel({ step, form }: { step: WizardStepIndex; form: WizardForm }) {
  const scheduleError =
    form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)
      ? "End date must be after start date"
      : null;

  const completedSteps = [
    form.name.trim().length > 0 && form.message.trim().length > 0,
    form.inactivityMinutes >= 5,
    true,
    false,
  ];

  if (step === 0) {
    return (
      <div className="space-y-4">
        {/* Live banner mock */}
        <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50" style={{ background: `${ACCENT}08` }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">
              Banner Preview
            </p>
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}06` }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: ACCENT }}
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-800 leading-snug">
                    {form.message.trim() || (
                      <span className="text-neutral-300 font-normal italic">
                        Your banner message will appear here…
                      </span>
                    )}
                  </p>
                  {form.subtext.trim() && (
                    <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                      {form.subtext.trim()}
                    </p>
                  )}
                  <button
                    className="mt-2 text-[10px] font-semibold text-white px-3 py-1 rounded-md"
                    style={{ background: ACCENT }}
                    tabIndex={-1}
                  >
                    {form.ctaLabel || "Complete your order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <MiniRow label="Internal name" value={form.name.trim() || <span className="text-neutral-300 italic">—</span>} />
            <MiniRow label="CTA URL" value={form.ctaUrl || <span className="text-neutral-300 italic">—</span>} />
          </div>
        </div>

        {/* Readiness bar */}
        <div className="rounded-xl border border-neutral-100 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5">
            Progress
          </p>
          <div className="flex items-center gap-1.5">
            {completedSteps.slice(0, 3).map((done, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full h-1.5 rounded-full transition-all duration-300"
                  style={{ background: done ? ACCENT : "#e5e7eb" }}
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

  if (step === 1) {
    const reachPercent =
      !form.returningOnly && form.minCartValue === 0
        ? 100
        : form.returningOnly && form.minCartValue === 0
        ? 55
        : form.returningOnly && form.minCartValue > 0
        ? 30
        : 70;

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Trigger Summary
            </p>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border"
              style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>After {form.inactivityMinutes} min of inactivity</span>
            </div>
            {form.minCartValue > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border"
                style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" }}
              >
                <span>🛒</span>
                <span>Cart value ≥ ${form.minCartValue}</span>
              </div>
            )}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border"
              style={
                form.returningOnly
                  ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#16a34a" }
                  : { background: "#f9fafb", borderColor: "#e5e7eb", color: "#374151" }
              }
            >
              <span>👤</span>
              <span>{form.returningOnly ? "Returning visitors only" : "All visitors"}</span>
            </div>
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
                background:
                  reachPercent > 60
                    ? ACCENT_GRADIENT
                    : reachPercent > 30
                    ? "linear-gradient(90deg, #f59e0b, #ea580c)"
                    : "linear-gradient(90deg, #10b981, #059669)",
              }}
            />
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
            Narrower targeting = higher intent audience. Broader = more reach.
          </p>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const fmtDate = (dt: string) => {
      if (!dt) return null;
      try {
        return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch {
        return dt;
      }
    };
    const startLabel = fmtDate(form.startsAt);
    const endLabel = fmtDate(form.endsAt);

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Schedule
            </p>
          </div>
          <div className="px-4 py-4">
            {!form.startsAt && !form.endsAt ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-xs text-neutral-700 font-medium">Active immediately (no expiry)</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                {scheduleError && (
                  <p className="text-[11px] text-red-500">{scheduleError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Priority Stack
            </p>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {form.priority > 1 && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-300 font-mono w-4 text-right">{form.priority - 1}</span>
                <div className="flex-1 h-2 rounded bg-neutral-100" />
                <span className="text-[10px] text-neutral-300">other</span>
              </div>
            )}
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
              style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}30` }}
            >
              <span className="text-[10px] font-mono font-bold w-4 text-right" style={{ color: ACCENT }}>
                {form.priority}
              </span>
              <span className="flex-1 text-[11px] font-semibold text-neutral-700 truncate">
                {form.name.trim() || "This recovery"}
              </span>
              <span className="text-[10px] font-medium" style={{ color: ACCENT }}>you</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <span className="text-[10px] text-neutral-300 font-mono w-4 text-right">{form.priority + 1}</span>
              <div className="flex-1 h-2 rounded bg-neutral-100" />
              <span className="text-[10px] text-neutral-300">other</span>
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 px-4 pb-3 leading-relaxed">
            Lower number = evaluated first when multiple recoveries are configured.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-neutral-400 shrink-0">{label}</span>
      <span className="text-[10px] font-medium text-neutral-700 text-right truncate">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AbandonedCartClient({ initialItems, initialShowWizard = false, redirectAfterCreate }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<AcrItem[]>(initialItems);
  const [showWizard, setShowWizard] = useState(initialShowWizard);
  const [wizardStep, setWizardStep] = useState<WizardStepIndex>(0);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
  }

  // ── Step validation ────────────────────────────────────────────────────────

  const scheduleError =
    form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)
      ? "End date must be after start date."
      : null;

  const endDateInPastError =
    form.endsAt && new Date(form.endsAt) < new Date()
      ? "End date cannot be in the past"
      : undefined;

  const canAdvanceStep: Record<number, boolean> = {
    0: form.name.trim().length > 0 && form.message.trim().length > 0,
    1: form.inactivityMinutes >= 5 && form.inactivityMinutes <= 1440 && form.minCartValue >= 0,
    2: !scheduleError && !endDateInPastError,
    3: form.name.trim().length > 0 && form.message.trim().length > 0,
  };

  const blockingIssueForStep: Record<number, string | undefined> = {
    0: !form.name.trim() ? "Name is required" : !form.message.trim() ? "Message is required" : undefined,
    1: form.inactivityMinutes < 5 || form.inactivityMinutes > 1440
      ? "Inactivity window must be between 5 and 1440 minutes"
      : undefined,
    2: scheduleError ?? endDateInPastError,
    3: !form.name.trim() ? "Name is required" : !form.message.trim() ? "Message is required" : undefined,
  };

  const readinessChecks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Recovery name",
      status: form.name.trim() ? "pass" : "block",
      detail: form.name.trim() ? `"${form.name.trim()}"` : "A name is required before creating.",
    },
    {
      id: "message",
      label: "Banner message",
      status: form.message.trim() ? "pass" : "block",
      detail: form.message.trim() ? "Message is set" : "A banner message is required.",
    },
    {
      id: "cta",
      label: "CTA configured",
      status: form.ctaLabel.trim() ? "pass" : "warn",
      detail: form.ctaLabel.trim()
        ? `"${form.ctaLabel}" → ${form.ctaUrl}`
        : "No CTA label set — visitors will see a default button.",
    },
    {
      id: "inactivity",
      label: "Inactivity trigger",
      status: "pass",
      detail: `Banner shows after ${form.inactivityMinutes} min of no activity`,
    },
    {
      id: "draft",
      label: "Created as DRAFT",
      status: "info",
      detail: "This recovery will be saved as DRAFT. Activate it manually when ready to start showing it.",
    },
  ];

  function handleNext() {
    const issue = blockingIssueForStep[wizardStep];
    if (issue) { setFormError(issue); return; }
    setFormError(null);
    setWizardStep((s) => (s + 1) as WizardStepIndex);
  }

  function handleBack() {
    setFormError(null);
    if (wizardStep === 0) {
      setShowWizard(false);
    } else {
      setWizardStep((s) => (s - 1) as WizardStepIndex);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.name.trim() || !form.message.trim()) {
      setFormError("Name and message are required.");
      return;
    }

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          message: form.message.trim(),
          inactivityMinutes: form.inactivityMinutes,
          returningOnly: form.returningOnly,
          priority: form.priority,
        };
        if (form.subtext.trim()) body.subtext = form.subtext.trim();
        if (form.ctaLabel.trim()) body.ctaLabel = form.ctaLabel.trim();
        if (form.ctaUrl.trim()) body.ctaUrl = form.ctaUrl.trim();
        if (form.minCartValue > 0) body.minCartValue = form.minCartValue;
        if (form.startsAt) body.startsAt = form.startsAt;
        if (form.endsAt) body.endsAt = form.endsAt;

        const res = await fetch("/api/personalizations/abandoned-cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Creation failed");

        setShowWizard(false);
        setWizardStep(0);
        setForm(DEFAULT_FORM);
        if (redirectAfterCreate) {
          router.push(redirectAfterCreate);
        } else {
          setItems((prev) => [data as AcrItem, ...prev]);
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function executeDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    await doAction(target.id, "delete");
  }

  async function doAction(id: string, action: "activate" | "pause" | "delete") {
    setActionError(null);
    try {
      if (action === "delete") {
        const res = await fetch(`/api/personalizations/abandoned-cart/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Delete failed");
        }
        setItems((prev) => prev.filter((p) => p.id !== id));
        return;
      }

      const res = await fetch(`/api/personalizations/abandoned-cart/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${action} failed`);

      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: data.status } : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  // ── Derived helpers ────────────────────────────────────────────────────────

  function getMessage(item: AcrItem): string {
    const mod = item.modifications[0];
    return typeof mod?.message === "string" ? mod.message : "—";
  }

  function getInactivity(item: AcrItem): string {
    const rule = item.targetingRules.find((r) => r.field === "inactivity_minutes");
    return rule ? `${rule.value} min` : "30 min";
  }

  // ── Step content ───────────────────────────────────────────────────────────

  const stepContent = [
    // Step 0: Message
    <div key="message" className="space-y-5">
      <FormSection title="Internal label" accent={ACCENT}>
        <FormField label="Recovery name" required hint="Internal label, not shown to visitors.">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Spring sale cart recovery"
            maxLength={200}
            className="input-base"
            autoFocus
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Banner copy"
        description="This text appears in the recovery banner shown to visitors."
        accent={ACCENT}
      >
        <div className="space-y-4">
          <FormField label="Main message" required hint="The primary text shown in the banner.">
            <textarea
              value={form.message}
              onChange={(e) => setField("message", e.target.value)}
              placeholder="You left something behind! Complete your purchase before it's gone."
              rows={3}
              maxLength={500}
              className="input-base resize-none"
            />
          </FormField>

          <FormField label="Subtext" hint="Optional supporting text beneath the main message.">
            <textarea
              value={form.subtext}
              onChange={(e) => setField("subtext", e.target.value)}
              placeholder="Free shipping on all orders over $50"
              rows={2}
              maxLength={300}
              className="input-base resize-none"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Call to action"
        description="The button visitors click to return to their cart."
        accent={ACCENT}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Button label" hint="Text shown on the CTA button.">
            <input
              type="text"
              value={form.ctaLabel}
              onChange={(e) => setField("ctaLabel", e.target.value)}
              placeholder="Complete your order"
              maxLength={100}
              className="input-base"
            />
          </FormField>
          <FormField label="Button URL" hint="Where the button navigates to.">
            <input
              type="text"
              value={form.ctaUrl}
              onChange={(e) => setField("ctaUrl", e.target.value)}
              placeholder="/cart"
              className="input-base"
            />
          </FormField>
        </div>
      </FormSection>
    </div>,

    // Step 1: Targeting
    <div key="targeting" className="space-y-5">
      <InlineAlert variant="info">
        All active rules must match before the banner is shown to a visitor.
      </InlineAlert>

      <FormSection
        title="Inactivity trigger"
        description="Show the banner after this many minutes of no activity."
        accent={ACCENT}
      >
        <FormField
          label="Inactivity window (minutes)"
          hint="Recommended: 15–30 min. Minimum 5, maximum 1440 (24 h)."
        >
          <input
            type="number"
            value={form.inactivityMinutes}
            min={5}
            max={1440}
            onChange={(e) => setField("inactivityMinutes", parseInt(e.target.value, 10) || 5)}
            className="input-base w-36"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Cart value threshold"
        description="Only trigger the banner if the cart total meets a minimum value."
        accent={ACCENT}
      >
        <FormField label="Minimum cart value" hint="Set to 0 to trigger for any cart value.">
          <div className="relative w-36">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">$</span>
            <input
              type="number"
              value={form.minCartValue}
              min={0}
              step={0.01}
              onChange={(e) => setField("minCartValue", parseFloat(e.target.value) || 0)}
              className="input-base pl-8"
            />
          </div>
        </FormField>
      </FormSection>

      <FormSection title="Visitor type" accent={ACCENT}>
        <label
          className={[
            "flex items-start gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all",
            form.returningOnly
              ? "border-indigo-300 bg-indigo-50 shadow-sm"
              : "border-neutral-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40",
          ].join(" ")}
        >
          <input
            type="checkbox"
            checked={form.returningOnly}
            onChange={(e) => setField("returningOnly", e.target.checked)}
            className="rounded accent-indigo-600 mt-0.5 shrink-0"
          />
          <div>
            <span className="block text-sm font-medium text-neutral-900">Returning visitors only</span>
            <span className="text-xs text-neutral-500 leading-relaxed mt-0.5 block">
              Only show to visitors who have been to your store before. Recommended — avoids showing recovery banners to first-time visitors still exploring.
            </span>
          </div>
        </label>

        {!form.returningOnly && (
          <InlineAlert variant="warning" className="mt-3">
            Showing to all visitors may reduce conversion rate. Consider enabling &quot;Returning visitors only&quot; for better results.
          </InlineAlert>
        )}
      </FormSection>
    </div>,

    // Step 2: Schedule
    <div key="schedule" className="space-y-5">
      <FormSection
        title="Schedule"
        description="Optionally restrict when this recovery campaign is active."
        accent={ACCENT}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start date" hint="Leave blank to activate immediately.">
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setField("startsAt", e.target.value)}
              className="input-base"
            />
          </FormField>
          <FormField label="End date" hint="Leave blank for no expiry.">
            <input
              type="datetime-local"
              value={form.endsAt}
              min={form.startsAt || undefined}
              onChange={(e) => setField("endsAt", e.target.value)}
              className={`input-base${scheduleError || endDateInPastError ? " border-red-400" : ""}`}
            />
            {scheduleError && <p className="text-[11px] text-red-500 mt-1">{scheduleError}</p>}
            {!scheduleError && endDateInPastError && (
              <p className="text-[11px] text-red-500 mt-1">{endDateInPastError}</p>
            )}
          </FormField>
        </div>
      </FormSection>

      {!form.startsAt && !form.endsAt && (
        <InlineAlert variant="info">
          No schedule set — this recovery will become active immediately after you activate it and run indefinitely.
        </InlineAlert>
      )}

      {scheduleError && <InlineAlert variant="danger">{scheduleError}</InlineAlert>}

      <FormSection
        title="Priority"
        description="Controls evaluation order when multiple recovery campaigns overlap."
        accent={ACCENT}
      >
        <FormField
          label="Priority number"
          hint="Lower number = evaluated first. Default: 100. Range: 0–9999."
        >
          <input
            type="number"
            value={form.priority}
            min={0}
            max={9999}
            onChange={(e) => setField("priority", parseInt(e.target.value, 10) || 0)}
            className="input-base w-32"
          />
        </FormField>
      </FormSection>

      <InlineAlert variant="warning">
        Only one abandoned cart recovery can be <strong>Active</strong> at a time. Activate this recovery manually after creation, and pause any currently active one first.
      </InlineAlert>
    </div>,

    // Step 3: Review
    <div key="review" className="space-y-6">
      <LaunchReadinessPanel checks={readinessChecks} accentHex={ACCENT} />

      <div className="bg-white rounded-xl border border-neutral-100 divide-y divide-neutral-100">
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Summary</p>
          <dl className="space-y-2.5">
            <SummaryRow label="Name" value={form.name || <span className="text-neutral-400 italic">Not set</span>} />
            <SummaryRow label="Message" value={form.message || <span className="text-neutral-400 italic">Not set</span>} />
            {form.subtext && <SummaryRow label="Subtext" value={form.subtext} />}
            <SummaryRow label="CTA" value={`${form.ctaLabel} → ${form.ctaUrl}`} />
            <SummaryRow label="Inactivity trigger" value={`${form.inactivityMinutes} minutes`} />
            <SummaryRow
              label="Min cart value"
              value={form.minCartValue > 0 ? `$${form.minCartValue}` : "Any"}
            />
            <SummaryRow
              label="Targeting"
              value={form.returningOnly ? "Returning visitors only" : "All visitors"}
            />
            <SummaryRow
              label="Schedule"
              value={
                form.startsAt || form.endsAt
                  ? [form.startsAt && `From ${form.startsAt}`, form.endsAt && `Until ${form.endsAt}`]
                      .filter(Boolean)
                      .join(" · ")
                  : "No schedule (runs indefinitely)"
              }
            />
            <SummaryRow label="Priority" value={String(form.priority)} />
          </dl>
        </div>
      </div>

      {formError && <InlineAlert variant="danger">{formError}</InlineAlert>}
    </div>,
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Abandoned Cart Recovery</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Re-engage visitors who leave with items in their cart
            </p>
          </div>
          <button
            onClick={() => { setShowWizard(true); setWizardStep(0); setForm(DEFAULT_FORM); setFormError(null); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: ACCENT_GRADIENT }}
          >
            <Plus className="w-4 h-4" />
            Create recovery
          </button>
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-red-700">{actionError}</div>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* How it works info box */}
        {items.length === 0 && (
          <div className="mb-6 bg-brand-50 border border-brand-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-brand-900 mb-2 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              How Abandoned Cart Recovery works
            </h3>
            <ol className="text-xs text-brand-700 space-y-1.5 list-decimal list-inside">
              <li>Your storefront tracks visitor activity and cart contents in the browser</li>
              <li>After the configured inactivity window, the recovery banner appears</li>
              <li>The banner shows your custom message and a CTA to return to the cart</li>
              <li>Recoveries and attributed revenue are tracked automatically</li>
            </ol>
          </div>
        )}

        {/* Recoveries list */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-6 h-6 text-brand-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700 mb-1">No recovery campaigns yet</p>
              <p className="text-xs text-neutral-400 mb-4 max-w-xs mx-auto">
                Create your first abandoned cart recovery to start re-engaging visitors
              </p>
              <button
                onClick={() => { setShowWizard(true); setWizardStep(0); setForm(DEFAULT_FORM); setFormError(null); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: ACCENT_GRADIENT }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create recovery
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Trigger</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const hex = STATUS_HEX[item.status] ?? STATUS_HEX.DRAFT!;
                  return (
                    <tr key={item.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link href={`/personalizations/abandoned-cart/${item.id}`} className="font-medium text-neutral-800 hover:text-brand-600 transition-colors">
                          {item.name}
                        </Link>
                        <p className="text-xs text-neutral-400 mt-0.5">Priority {item.priority}</p>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="text-xs text-neutral-600 truncate">{getMessage(item)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Clock className="w-3 h-3" />
                          {getInactivity(item)} inactive
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{ background: `${hex}12`, color: hex, borderColor: `${hex}25` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />
                          {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-400">
                        {new Date(item.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.status === "DRAFT" || item.status === "PAUSED" || item.status === "SCHEDULED" ? (
                            <button
                              onClick={() => doAction(item.id, "activate")}
                              title="Activate"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          {item.status === "ACTIVE" || item.status === "SCHEDULED" ? (
                            <button
                              onClick={() => doAction(item.id, "pause")}
                              title="Pause"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          {item.status === "DRAFT" ? (
                            <button
                              onClick={() => setConfirmDelete({ id: item.id, name: item.name })}
                              title="Delete"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          <Link href={`/personalizations/abandoned-cart/${item.id}`} className="p-1.5 rounded-lg text-neutral-300 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Full-screen creation wizard ──────────────────────────────────────── */}
      {showWizard && (
        <div className="fixed inset-0 z-50">
          <WizardLayout
            title="Abandoned Cart Recovery"
            subtitle="Re-engage cart abandoners with a targeted banner"
            icon={<ShoppingCart className="w-4 h-4" />}
            accentHex={ACCENT}
            steps={STEP_DEFS}
            currentStep={wizardStep}
            onStepClick={(i) => {
              if (i < wizardStep) {
                setFormError(null);
                setWizardStep(i as WizardStepIndex);
              }
            }}
            onCancel={() => setShowWizard(false)}
            previewPanel={
              wizardStep < 3 ? (
                <AbandonedCartPreviewPanel step={wizardStep} form={form} />
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
                  {wizardStep === 0 ? "Cancel" : <><ArrowLeft className="w-3.5 h-3.5" /> Back</>}
                </button>
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvanceStep[wizardStep]}
                    title={blockingIssueForStep[wizardStep]}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background: ACCENT_GRADIENT }}
                  >
                    Continue
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending || !canAdvanceStep[3]}
                    title={blockingIssueForStep[3]}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
                    style={{ background: "#4f46e5" }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isPending ? "Creating…" : "Create recovery"}
                  </button>
                )}
              </div>
            }
          >
            {/* Step header — sticky */}
            <div className="sticky top-0 z-10 px-6 pt-5 pb-4 border-b border-neutral-100 bg-white">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: ACCENT }}
              >
                Step {wizardStep + 1} of {STEP_LABELS.length}
              </p>
              <h1 className="text-[15px] font-bold text-neutral-900">{STEP_TITLES[wizardStep]}</h1>
              <p className="text-xs text-neutral-500 mt-0.5">{STEP_DESCS[wizardStep]}</p>
            </div>

            {/* Step content */}
            <div className="p-6 space-y-5">
              {stepContent[wizardStep]}

              {/* Inline error (steps 0–2 only; step 3 shows it inside LaunchReadinessPanel) */}
              {formError && wizardStep < 3 && (
                <InlineAlert variant="danger">{formError}</InlineAlert>
              )}
            </div>
          </WizardLayout>
        </div>
      )}
    </div>

    {confirmDelete && (
      <ConfirmDialog
        title="Delete recovery?"
        description={`"${confirmDelete.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    )}
    </>
  );
}

// ── Summary row helper ────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-neutral-500 shrink-0 w-32">{label}</dt>
      <dd className="text-xs font-medium text-neutral-800 text-right">{value}</dd>
    </div>
  );
}
