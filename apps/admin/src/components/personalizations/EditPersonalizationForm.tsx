"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, X } from "lucide-react";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TargetingRule {
  type: string;
  operator?: string;
  value?: string;
}

interface EditPersonalizationFormProps {
  personalizationId: string;
  initial: {
    name: string;
    priority: number;
    startsAt: string | null;
    endsAt: string | null;
    targetingRules: TargetingRule[];
    offerIds: string[];
  };
  onCancel?: () => void;
}

const RULE_TYPES = [
  { value: "url_contains", label: "URL contains" },
  { value: "url_equals", label: "URL equals" },
  { value: "cart_total_gt", label: "Cart total >" },
  { value: "cart_total_lt", label: "Cart total <" },
  { value: "product_in_cart", label: "Product in cart" },
  { value: "customer_tag", label: "Customer tag" },
  { value: "referrer_contains", label: "Referrer contains" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditPersonalizationForm({
  personalizationId,
  initial,
  onCancel,
}: EditPersonalizationFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initial.name);
  const [priority, setPriority] = useState(initial.priority);
  const [startsAt, setStartsAt] = useState(
    initial.startsAt
      ? new Date(initial.startsAt).toISOString().slice(0, 16)
      : ""
  );
  const [endsAt, setEndsAt] = useState(
    initial.endsAt
      ? new Date(initial.endsAt).toISOString().slice(0, 16)
      : ""
  );
  const [rules, setRules] = useState<TargetingRule[]>(
    initial.targetingRules.length > 0
      ? initial.targetingRules
      : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-white placeholder:text-neutral-400";

  function addRule() {
    setRules((r) => [...r, { type: "url_contains", operator: "contains", value: "" }]);
  }

  function removeRule(i: number) {
    setRules((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRule(i: number, patch: Partial<TargetingRule>) {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        priority,
        targetingRules: rules.filter((r) => r.value?.trim()),
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      };

      const res = await fetch(`/api/personalizations/${personalizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to update");
      }

      toast.success("Personalization updated");
      router.refresh();
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name & Priority */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Personalization name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">Priority</label>
          <input
            type="number"
            min={0}
            max={9999}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            className={inputCls}
          />
          <p className="text-[10px] text-neutral-400">Higher = evaluated first</p>
        </div>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">Start date (optional)</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">End date (optional)</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Targeting rules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-700">Targeting rules</label>
          <button
            type="button"
            onClick={addRule}
            className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add rule
          </button>
        </div>

        {rules.length === 0 && (
          <p className="text-xs text-neutral-400 py-2 px-3 bg-neutral-50 rounded-lg border border-neutral-100">
            No rules — personalization will show to all visitors.
          </p>
        )}

        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={rule.type}
                onChange={(e) => updateRule(i, { type: e.target.value })}
                className="text-sm border border-neutral-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-white"
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={rule.value ?? ""}
                onChange={(e) => updateRule(i, { value: e.target.value })}
                className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-white placeholder:text-neutral-400"
                placeholder="Value"
              />
              <button
                type="button"
                onClick={() => removeRule(i)}
                className="text-neutral-400 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <InlineAlert variant="danger">{error}</InlineAlert>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: saving ? "#d1d5db" : "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)" }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
