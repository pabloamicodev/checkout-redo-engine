"use client";

import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import type { TargetingCondition, TargetingConditionType, TargetingGroup } from "@/lib/targeting";

// ─── Condition type metadata ─────────────────────────────────────────────────

type InputKind = "text" | "number" | "date" | "select" | "boolean";

interface ConditionMeta {
  label: string;
  kind: InputKind;
  operators: Array<{ value: string; label: string }>;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const TEXT_OPS = [
  { value: "eq",          label: "is" },
  { value: "neq",         label: "is not" },
  { value: "contains",    label: "contains" },
  { value: "not_contains",label: "does not contain" },
];

const NUM_OPS = [
  { value: "gte", label: "≥" },
  { value: "gt",  label: ">" },
  { value: "lte", label: "≤" },
  { value: "lt",  label: "<" },
  { value: "eq",  label: "=" },
];

const EQ_OPS = [
  { value: "eq",  label: "is" },
  { value: "neq", label: "is not" },
];

const CONDITION_META: Record<TargetingConditionType, ConditionMeta> = {
  device: {
    label: "Device type",
    kind: "select",
    operators: EQ_OPS,
    options: [
      { value: "mobile",  label: "Mobile" },
      { value: "tablet",  label: "Tablet" },
      { value: "desktop", label: "Desktop" },
    ],
  },
  country: {
    label: "Country",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "US, CA, GB …",
  },
  currency: {
    label: "Currency",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "USD",
  },
  url_contains: {
    label: "URL contains",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "/products/",
  },
  url_matches: {
    label: "URL matches regex",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "^/collections/.+",
  },
  utm_source: {
    label: "UTM source",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "google",
  },
  utm_medium: {
    label: "UTM medium",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "cpc",
  },
  utm_campaign: {
    label: "UTM campaign",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "summer_sale",
  },
  utm_content: {
    label: "UTM content",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "banner_a",
  },
  utm_term: {
    label: "UTM term",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "running shoes",
  },
  cart_value_gte: {
    label: "Cart value ≥",
    kind: "number",
    operators: NUM_OPS,
    placeholder: "50",
  },
  cart_value_lte: {
    label: "Cart value ≤",
    kind: "number",
    operators: NUM_OPS,
    placeholder: "200",
  },
  cart_contains_product: {
    label: "Cart contains product ID",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "gid://shopify/Product/123",
  },
  cart_contains_collection: {
    label: "Cart contains collection ID",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "gid://shopify/Collection/456",
  },
  new_visitor: {
    label: "New visitor",
    kind: "boolean",
    operators: [],
  },
  returning_visitor: {
    label: "Returning visitor",
    kind: "boolean",
    operators: [],
  },
  customer_logged_in: {
    label: "Customer logged in",
    kind: "boolean",
    operators: [],
  },
  customer_tag: {
    label: "Customer tag",
    kind: "text",
    operators: TEXT_OPS,
    placeholder: "vip",
  },
  date_after: {
    label: "Date after",
    kind: "date",
    operators: [{ value: "gte", label: "after" }],
  },
  date_before: {
    label: "Date before",
    kind: "date",
    operators: [{ value: "lt", label: "before" }],
  },
  hour_of_day: {
    label: "Hour of day",
    kind: "number",
    operators: NUM_OPS,
    placeholder: "9",
  },
  day_of_week: {
    label: "Day of week",
    kind: "select",
    operators: EQ_OPS,
    options: [
      { value: "0", label: "Sunday" },
      { value: "1", label: "Monday" },
      { value: "2", label: "Tuesday" },
      { value: "3", label: "Wednesday" },
      { value: "4", label: "Thursday" },
      { value: "5", label: "Friday" },
      { value: "6", label: "Saturday" },
    ],
  },
  page_type: {
    label: "Page type",
    kind: "select",
    operators: EQ_OPS,
    options: [
      { value: "home",       label: "Home" },
      { value: "product",    label: "Product" },
      { value: "collection", label: "Collection" },
      { value: "cart",       label: "Cart" },
      { value: "checkout",   label: "Checkout" },
      { value: "blog",       label: "Blog" },
      { value: "other",      label: "Other" },
    ],
  },
  product_viewed: {
    label: "Product viewed",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "gid://shopify/Product/123",
  },
  collection_viewed: {
    label: "Collection viewed",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "gid://shopify/Collection/456",
  },
  js_api: {
    label: "JS expression",
    kind: "text",
    operators: EQ_OPS,
    placeholder: "window.myFlag === true",
  },
};

const CONDITION_TYPES = Object.keys(CONDITION_META) as TargetingConditionType[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultCondition(type: TargetingConditionType): TargetingCondition {
  const meta = CONDITION_META[type];
  const operator = meta.kind === "boolean" ? "eq" : (meta.operators[0]?.value ?? "eq");
  const value: TargetingCondition["value"] = meta.kind === "boolean" ? true : meta.kind === "number" ? 0 : meta.options?.[0]?.value ?? "";
  return { type, operator: operator as TargetingCondition["operator"], value };
}

function defaultGroup(): TargetingGroup {
  return { operator: "AND", conditions: [defaultCondition("device")] };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500 pr-7 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
    </div>
  );
}

interface ConditionRowProps {
  condition: TargetingCondition;
  onChange: (c: TargetingCondition) => void;
  onRemove: () => void;
  disabled?: boolean;
  isOnly: boolean;
}

function ConditionRow({ condition, onChange, onRemove, disabled, isOnly }: ConditionRowProps) {
  const meta = CONDITION_META[condition.type];

  function setType(t: string) {
    onChange(defaultCondition(t as TargetingConditionType));
  }

  function setOperator(op: string) {
    onChange({ ...condition, operator: op as TargetingCondition["operator"] });
  }

  function setValue(v: TargetingCondition["value"]) {
    onChange({ ...condition, value: v });
  }

  const typeOptions = CONDITION_TYPES.map((t) => ({
    value: t,
    label: CONDITION_META[t].label,
  }));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Condition type */}
      <Select
        value={condition.type}
        onChange={setType}
        options={typeOptions}
        className="min-w-[160px] flex-shrink-0"
        disabled={disabled}
      />

      {/* Operator (hidden for boolean) */}
      {meta.kind !== "boolean" && meta.operators.length > 1 && (
        <Select
          value={condition.operator}
          onChange={setOperator}
          options={meta.operators}
          className="w-[120px] flex-shrink-0"
          disabled={disabled}
        />
      )}

      {/* Value input */}
      {meta.kind === "boolean" && (
        <span className="text-xs text-neutral-500 italic">is true</span>
      )}

      {meta.kind === "text" && (
        <input
          type="text"
          value={condition.value as string}
          onChange={(e) => setValue(e.target.value)}
          placeholder={meta.placeholder}
          disabled={disabled}
          className="flex-1 min-w-[140px] border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
      )}

      {meta.kind === "number" && (
        <input
          type="number"
          value={condition.value as number}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          placeholder={meta.placeholder}
          disabled={disabled}
          className="w-24 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
      )}

      {meta.kind === "date" && (
        <input
          type="date"
          value={condition.value as string}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
      )}

      {meta.kind === "select" && meta.options && (
        <Select
          value={condition.value as string}
          onChange={(v) => setValue(v)}
          options={meta.options}
          className="min-w-[120px]"
          disabled={disabled}
        />
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isOnly || disabled}
        title={isOnly ? "At least one condition required" : "Remove condition"}
        className="p-1.5 rounded text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RuleBuilderProps {
  value: TargetingGroup[];
  onChange: (groups: TargetingGroup[]) => void;
  disabled?: boolean;
  className?: string;
}

export function RuleBuilder({ value: groups, onChange, disabled, className }: RuleBuilderProps) {
  function updateGroup(i: number, g: TargetingGroup) {
    const next = [...groups];
    next[i] = g;
    onChange(next);
  }

  function removeGroup(i: number) {
    onChange(groups.filter((_, idx) => idx !== i));
  }

  function addGroup() {
    onChange([...groups, defaultGroup()]);
  }

  function addCondition(gi: number) {
    const g = groups[gi]!;
    updateGroup(gi, { ...g, conditions: [...g.conditions, defaultCondition("device")] });
  }

  function updateCondition(gi: number, ci: number, c: TargetingCondition) {
    const g = groups[gi]!;
    const conditions = [...g.conditions];
    conditions[ci] = c;
    updateGroup(gi, { ...g, conditions });
  }

  function removeCondition(gi: number, ci: number) {
    const g = groups[gi]!;
    updateGroup(gi, { ...g, conditions: g.conditions.filter((_, idx) => idx !== ci) });
  }

  if (groups.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-sm text-neutral-400 italic">No targeting rules — all visitors will be included.</p>
        <button
          type="button"
          onClick={addGroup}
          disabled={disabled}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add rule group
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-1.5">
          {/* Group AND connector (between groups) */}
          {gi > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest px-2">
                AND
              </span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
          )}

          {/* Group card */}
          <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
            {/* Group header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Match</span>
                <div className="flex rounded-lg overflow-hidden border border-neutral-200">
                  {(["AND", "OR"] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => updateGroup(gi, { ...group, operator: op })}
                      disabled={disabled}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                        group.operator === op
                          ? "bg-neutral-800 text-white"
                          : "bg-white text-neutral-500 hover:bg-neutral-100"
                      )}
                    >
                      {op}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-neutral-500">of the following</span>
              </div>

              {/* Remove group */}
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                disabled={disabled}
                title="Remove group"
                className="p-1 rounded text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conditions */}
            <div className="divide-y divide-neutral-100">
              {group.conditions.map((cond, ci) => (
                <div key={ci} className="px-4 py-3">
                  <ConditionRow
                    condition={cond}
                    onChange={(c) => updateCondition(gi, ci, c)}
                    onRemove={() => removeCondition(gi, ci)}
                    disabled={disabled}
                    isOnly={group.conditions.length === 1}
                  />
                </div>
              ))}
            </div>

            {/* Add condition */}
            <div className="px-4 py-2.5 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => addCondition(gi)}
                disabled={disabled}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add condition
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add group */}
      <button
        type="button"
        onClick={addGroup}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 mt-1"
      >
        <Plus className="w-4 h-4" />
        Add rule group
      </button>
    </div>
  );
}
