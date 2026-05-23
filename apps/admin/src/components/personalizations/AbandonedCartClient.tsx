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

const WIZARD_STEPS = ["Message", "Targeting", "Schedule", "Review"] as const;
type WizardStep = 0 | 1 | 2 | 3;

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

// ── Main component ────────────────────────────────────────────────────────────

export function AbandonedCartClient({ initialItems, initialShowWizard = false, redirectAfterCreate }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<AcrItem[]>(initialItems);
  const [showWizard, setShowWizard] = useState(initialShowWizard);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
  }

  // ── Step validation ────────────────────────────────────────────────────────

  function validateStep(step: WizardStep): string | null {
    if (step === 0) {
      if (!form.name.trim()) return "Name is required";
      if (form.name.length > 200) return "Name must be 200 characters or fewer";
      if (!form.message.trim()) return "Message is required";
      if (form.message.length > 500) return "Message must be 500 characters or fewer";
      if (form.subtext.length > 300) return "Subtext must be 300 characters or fewer";
      if (form.ctaLabel.length > 100) return "CTA label must be 100 characters or fewer";
    }
    if (step === 1) {
      if (form.inactivityMinutes < 5 || form.inactivityMinutes > 1440)
        return "Inactivity window must be between 5 and 1440 minutes";
      if (form.minCartValue < 0) return "Minimum cart value cannot be negative";
    }
    if (step === 2) {
      if (form.priority < 0 || form.priority > 9999) return "Priority must be between 0 and 9999";
      if (form.endsAt) {
        const end = new Date(form.endsAt);
        if (isNaN(end.getTime())) return "End date is not valid";
        if (end <= new Date()) return "End date must be in the future";
        if (form.startsAt) {
          const start = new Date(form.startsAt);
          if (end <= start) return "End date must be after start date";
        }
      }
    }
    return null;
  }

  function handleNext() {
    const err = validateStep(wizardStep);
    if (err) { setFormError(err); return; }
    setFormError(null);
    setWizardStep((s) => (s + 1) as WizardStep);
  }

  function handleBack() {
    setFormError(null);
    setWizardStep((s) => (s - 1) as WizardStep);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    const err = validateStep(3);
    if (err) { setFormError(err); return; }

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-4xl mx-auto px-8 py-8">

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
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
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
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
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
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"? This cannot be undone.`)) {
                                  doAction(item.id, "delete");
                                }
                              }}
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

      {/* ── Wizard modal ─────────────────────────────────────────────────────── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowWizard(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  Create abandoned cart recovery
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Step {wizardStep + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[wizardStep]}
                </p>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step progress */}
            <div className="flex px-6 pt-4 gap-1.5">
              {WIZARD_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    i <= wizardStep ? "bg-brand-600" : "bg-neutral-100"
                  }`}
                />
              ))}
            </div>

            {/* Form body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {wizardStep === 0 && <Step1 form={form} setField={setField} />}
              {wizardStep === 1 && <Step2 form={form} setField={setField} />}
              {wizardStep === 2 && <Step3 form={form} setField={setField} />}
              {wizardStep === 3 && <StepReview form={form} />}

              {formError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">{formError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
              <div>
                {wizardStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>
              <div>
                {wizardStep < 3 ? (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleCreate}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                    style={{ background: "#4f46e5" }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isPending ? "Creating…" : "Create recovery"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wizard steps ──────────────────────────────────────────────────────────────

interface StepProps {
  form: WizardForm;
  setField: <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => void;
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-medium text-neutral-700">{label}</label>
      {hint && <p className="text-[11px] text-neutral-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
      />
      {maxLength && (
        <p className="text-[11px] text-neutral-400 text-right mt-0.5">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

function Step1({ form, setField }: StepProps) {
  return (
    <>
      <div>
        <FieldLabel label="Recovery name" hint="Internal label, not shown to visitors" />
        <Input
          value={form.name}
          onChange={(v) => setField("name", v)}
          placeholder="e.g. Spring sale cart recovery"
        />
      </div>

      <div>
        <FieldLabel
          label="Banner message"
          hint="The main text shown in the recovery banner (max 500 chars)"
        />
        <Textarea
          value={form.message}
          onChange={(v) => setField("message", v)}
          placeholder="You left something behind! Complete your purchase before it's gone."
          rows={3}
          maxLength={500}
        />
      </div>

      <div>
        <FieldLabel label="Subtext" hint="Optional supporting text beneath the message (max 300 chars)" />
        <Textarea
          value={form.subtext}
          onChange={(v) => setField("subtext", v)}
          placeholder="Free shipping on all orders over $50"
          rows={2}
          maxLength={300}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel label="CTA button label" />
          <Input
            value={form.ctaLabel}
            onChange={(v) => setField("ctaLabel", v)}
            placeholder="Complete your order"
          />
        </div>
        <div>
          <FieldLabel label="CTA button URL" />
          <Input
            value={form.ctaUrl}
            onChange={(v) => setField("ctaUrl", v)}
            placeholder="/cart"
          />
        </div>
      </div>
    </>
  );
}

function Step2({ form, setField }: StepProps) {
  return (
    <>
      <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
        <p className="text-xs text-brand-700">
          These rules determine <strong>when</strong> the banner is shown. A visitor must match all
          active rules before the banner appears.
        </p>
      </div>

      <div>
        <FieldLabel
          label="Inactivity window (minutes)"
          hint="Show banner after this many minutes of no activity (5–1440)"
        />
        <Input
          type="number"
          value={form.inactivityMinutes}
          onChange={(v) => setField("inactivityMinutes", parseInt(v, 10) || 30)}
          min={5}
          max={1440}
        />
        <p className="text-[11px] text-neutral-400 mt-1">
          Recommended: 15–30 minutes for most stores
        </p>
      </div>

      <div>
        <FieldLabel
          label="Minimum cart value"
          hint="Only trigger if cart total ≥ this amount (0 = any cart value)"
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
          <input
            type="number"
            value={form.minCartValue}
            min={0}
            step={0.01}
            onChange={(e) => setField("minCartValue", parseFloat(e.target.value) || 0)}
            className="w-full pl-7 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={form.returningOnly}
              onChange={(e) => setField("returningOnly", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-4 h-4 rounded border-2 border-neutral-300 peer-checked:bg-brand-600 peer-checked:border-brand-600 flex items-center justify-center transition-colors">
              {form.returningOnly && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700">Returning visitors only</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Only show to visitors who have been to your store before. Recommended — avoids
              showing recovery banners to first-time visitors still exploring.
            </p>
          </div>
        </label>
      </div>
    </>
  );
}

function Step3({ form, setField }: StepProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel label="Start date" hint="Leave blank to start immediately on activation" />
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={(v) => setField("startsAt", v)}
          />
        </div>
        <div>
          <FieldLabel label="End date" hint="Leave blank for no expiry" />
          <Input
            type="datetime-local"
            value={form.endsAt}
            onChange={(v) => setField("endsAt", v)}
          />
        </div>
      </div>

      <div>
        <FieldLabel
          label="Priority"
          hint="Lower number = evaluated first when multiple recoveries are configured (0–9999)"
        />
        <Input
          type="number"
          value={form.priority}
          onChange={(v) => setField("priority", parseInt(v, 10) || 100)}
          min={0}
          max={9999}
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Note:</strong> Only one abandoned cart recovery can be{" "}
          <strong>Active</strong> at a time. You will need to activate this recovery manually
          after creation, and pause any currently active one first.
        </p>
      </div>
    </>
  );
}

function StepReview({ form }: { form: WizardForm }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Review your settings before creating the recovery campaign.
      </p>

      <ReviewRow label="Name" value={form.name} />
      <ReviewRow label="Message" value={form.message} />
      {form.subtext && <ReviewRow label="Subtext" value={form.subtext} />}
      <ReviewRow label="CTA" value={`${form.ctaLabel} → ${form.ctaUrl}`} />

      <div className="border-t border-neutral-100 pt-3 mt-3" />

      <ReviewRow label="Inactivity window" value={`${form.inactivityMinutes} minutes`} />
      <ReviewRow label="Min cart value" value={form.minCartValue > 0 ? `$${form.minCartValue}` : "Any"} />
      <ReviewRow label="Targeting" value={form.returningOnly ? "Returning visitors only" : "All visitors"} />

      <div className="border-t border-neutral-100 pt-3 mt-3" />

      <ReviewRow
        label="Start date"
        value={form.startsAt ? new Date(form.startsAt).toLocaleString() : "On activation"}
      />
      <ReviewRow
        label="End date"
        value={form.endsAt ? new Date(form.endsAt).toLocaleString() : "No expiry"}
      />
      <ReviewRow label="Priority" value={String(form.priority)} />

      <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
        <p className="text-xs text-neutral-500">
          The recovery will be created as a <strong>Draft</strong>. Activate it when you are ready
          to start showing the banner to visitors.
          {form.startsAt &&
            new Date(form.startsAt) > new Date() &&
            " It will be created as Scheduled and will go live automatically at the start date."}
        </p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-neutral-400 shrink-0 w-32">{label}</span>
      <span className="text-xs text-neutral-800 text-right">{value}</span>
    </div>
  );
}
