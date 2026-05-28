"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ArrowLeft, ArrowRight, Plus, Trash2, User, Tag, ShoppingBag, MapPin, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { LaunchReadinessPanel, type ReadinessCheck } from "@/components/experiments/LaunchReadinessPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleOperator = "is" | "is_not" | "contains" | "greater_than" | "less_than" | "in";

interface TargetingRule {
  id: string;
  type: "customer_tag" | "purchase_count" | "country" | "device" | "new_vs_returning" | "cart_value";
  operator: RuleOperator;
  value: string;
}

type ActionType = "show_content" | "hide_element" | "replace_text" | "show_offer" | "custom_css" | "custom_js";

interface PersonalizationAction {
  id: string;
  type: ActionType;
  selector?: string;
  content?: string;
  offerId?: string;
}

interface WizardData {
  name: string;
  hypothesis: string;
  rules: TargetingRule[];
  ruleOperator: "AND" | "OR";
  actions: PersonalizationAction[];
}

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

const RULE_TYPE_LABELS: Record<TargetingRule["type"], string> = {
  customer_tag: "Customer Tag",
  purchase_count: "Purchase Count",
  country: "Country",
  device: "Device Type",
  new_vs_returning: "New vs Returning",
  cart_value: "Cart Value",
};

const RULE_TYPE_ICONS: Record<TargetingRule["type"], React.ReactNode> = {
  customer_tag: <Tag className="w-3.5 h-3.5" />,
  purchase_count: <ShoppingBag className="w-3.5 h-3.5" />,
  country: <MapPin className="w-3.5 h-3.5" />,
  device: <User className="w-3.5 h-3.5" />,
  new_vs_returning: <User className="w-3.5 h-3.5" />,
  cart_value: <ShoppingBag className="w-3.5 h-3.5" />,
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  show_content: "Show custom content",
  hide_element: "Hide element",
  replace_text: "Replace text",
  show_offer: "Show targeted offer",
  custom_css: "Inject CSS",
  custom_js: "Inject JavaScript",
};

function newRule(): TargetingRule {
  return { id: crypto.randomUUID(), type: "customer_tag", operator: "is", value: "" };
}

function newAction(): PersonalizationAction {
  return { id: crypto.randomUUID(), type: "show_content", selector: "", content: "" };
}

// ---------------------------------------------------------------------------
// Step 1: Basics
// ---------------------------------------------------------------------------

function StepBasics({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
        <input
          type="text"
          className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="e.g. VIP Customer Upsell Banner"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Hypothesis <span className="text-neutral-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="We believe showing a loyalty reward banner to VIP customers will increase their AOV by 15%..."
          value={data.hypothesis}
          onChange={(e) => onChange({ hypothesis: e.target.value })}
        />
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-brand-700">
        <p className="font-medium mb-1">Personalization vs A/B Test</p>
        <p className="text-xs text-brand-600">
          Personalizations always show a specific experience to a targeted segment — no split testing.
          Use this for loyalty rewards, geo-targeted messaging, or VIP-only offers.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Targeting Rules
// ---------------------------------------------------------------------------

function StepTargeting({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  function updateRule(id: string, patch: Partial<TargetingRule>) {
    onChange({
      rules: data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeRule(id: string) {
    onChange({ rules: data.rules.filter((r) => r.id !== id) });
  }

  function getOperators(type: TargetingRule["type"]): { value: RuleOperator; label: string }[] {
    switch (type) {
      case "customer_tag":
        return [
          { value: "is", label: "has tag" },
          { value: "is_not", label: "does not have tag" },
        ];
      case "purchase_count":
        return [
          { value: "greater_than", label: "greater than" },
          { value: "less_than", label: "less than" },
          { value: "is", label: "equals" },
        ];
      case "country":
        return [
          { value: "is", label: "is" },
          { value: "is_not", label: "is not" },
          { value: "in", label: "is one of" },
        ];
      case "device":
        return [
          { value: "is", label: "is" },
          { value: "is_not", label: "is not" },
        ];
      case "new_vs_returning":
        return [{ value: "is", label: "is" }];
      case "cart_value":
        return [
          { value: "greater_than", label: "greater than" },
          { value: "less_than", label: "less than" },
        ];
    }
  }

  function getValuePlaceholder(rule: TargetingRule): string {
    switch (rule.type) {
      case "customer_tag": return "e.g. vip, wholesale";
      case "purchase_count": return "e.g. 3";
      case "country": return "e.g. US, CA, MX";
      case "device": return "mobile, desktop, tablet";
      case "new_vs_returning": return "new, returning";
      case "cart_value": return "e.g. 100";
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Define who sees this personalization. Visitors who match will see the customized experience.
      </p>

      {/* Rule operator */}
      {data.rules.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600">Match</span>
          {(["AND", "OR"] as const).map((op) => (
            <button
              key={op}
              onClick={() => onChange({ ruleOperator: op })}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-lg border transition-colors",
                data.ruleOperator === op
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-neutral-600 border-neutral-200"
              )}
            >
              {op === "AND" ? "ALL conditions" : "ANY condition"}
            </button>
          ))}
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-2">
        {data.rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center gap-2 p-3 border border-neutral-200 rounded-lg bg-white"
          >
            <span className="text-neutral-400 shrink-0">
              {RULE_TYPE_ICONS[rule.type]}
            </span>

            {/* Type */}
            <select
              className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={rule.type}
              onChange={(e) =>
                updateRule(rule.id, {
                  type: e.target.value as TargetingRule["type"],
                  operator: getOperators(e.target.value as TargetingRule["type"])[0]?.value ?? "is",
                  value: "",
                })
              }
            >
              {(Object.keys(RULE_TYPE_LABELS) as TargetingRule["type"][]).map((t) => (
                <option key={t} value={t}>
                  {RULE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            {/* Operator */}
            <select
              className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={rule.operator}
              onChange={(e) => updateRule(rule.id, { operator: e.target.value as RuleOperator })}
            >
              {getOperators(rule.type).map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value */}
            <input
              type={rule.type === "purchase_count" || rule.type === "cart_value" ? "number" : "text"}
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={getValuePlaceholder(rule)}
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            />

            <button
              onClick={() => removeRule(rule.id)}
              className="p-1 text-neutral-400 hover:text-danger-500 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={<Plus className="w-3.5 h-3.5" />}
        onClick={() => onChange({ rules: [...data.rules, newRule()] })}
      >
        Add Condition
      </Button>

      {data.rules.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No conditions means this personalization shows to everyone. Add at least one condition to target a segment.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Actions
// ---------------------------------------------------------------------------

function StepActions({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  function updateAction(id: string, patch: Partial<PersonalizationAction>) {
    onChange({
      actions: data.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  function removeAction(id: string) {
    onChange({ actions: data.actions.filter((a) => a.id !== id) });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Define what happens for visitors who match your targeting conditions.
      </p>

      <div className="space-y-3">
        {data.actions.map((action) => (
          <div key={action.id} className="border border-neutral-200 rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <select
                className="text-sm font-medium border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={action.type}
                onChange={(e) =>
                  updateAction(action.id, { type: e.target.value as ActionType })
                }
              >
                {(Object.keys(ACTION_TYPE_LABELS) as ActionType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeAction(action.id)}
                className="p-1 text-neutral-400 hover:text-danger-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {["show_content", "hide_element", "replace_text"].includes(action.type) && (
              <input
                type="text"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="CSS selector — e.g. .announcement-bar, #hero-title"
                value={action.selector ?? ""}
                onChange={(e) => updateAction(action.id, { selector: e.target.value })}
              />
            )}

            {["show_content", "replace_text"].includes(action.type) && (
              <textarea
                rows={3}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder={action.type === "replace_text" ? "New text content" : "HTML content to inject"}
                value={action.content ?? ""}
                onChange={(e) => updateAction(action.id, { content: e.target.value })}
              />
            )}

            {["custom_css", "custom_js"].includes(action.type) && (
              <textarea
                rows={5}
                className="w-full text-sm font-mono border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
                placeholder={action.type === "custom_css" ? ".my-class { color: red; }" : "console.log('hello from personalization');"}
                value={action.content ?? ""}
                onChange={(e) => updateAction(action.id, { content: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={<Plus className="w-3.5 h-3.5" />}
        onClick={() => onChange({ actions: [...data.actions, newAction()] })}
      >
        Add Action
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review
// ---------------------------------------------------------------------------

function StepReview({ data }: { data: WizardData }) {
  const checks: ReadinessCheck[] = [
    {
      id: "name",
      label: "Personalization has a name",
      status: data.name.trim() ? "pass" : "block",
      detail: data.name.trim() ? undefined : "Go back to Basics and add a name.",
    },
    {
      id: "actions",
      label: "At least one action configured",
      status: data.actions.length > 0 ? "pass" : "block",
      detail: data.actions.length > 0
        ? `${data.actions.length} action${data.actions.length !== 1 ? "s" : ""} defined`
        : "Go back to Actions and add at least one action.",
    },
    {
      id: "targeting",
      label: "Targeting rules",
      status: data.rules.length > 0 ? "pass" : "warn",
      detail: data.rules.length > 0
        ? `${data.rules.length} condition${data.rules.length !== 1 ? "s" : ""} (${data.ruleOperator} logic)`
        : "No conditions set — personalization will show to ALL visitors.",
    },
    {
      id: "info-draft",
      label: "Starts in DRAFT — you must activate manually",
      status: "info",
      detail: "Activate it from the personalization detail page when ready.",
    },
    {
      id: "info-content",
      label: "DOM selectors must match your live theme",
      status: "info",
      detail: "If your theme updates after this personalization is created, CSS selectors may stop matching. Re-test after theme changes.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">Name</p>
          <p className="text-sm text-neutral-900">{data.name || "—"}</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">Match</p>
          <p className="text-sm text-neutral-900">{data.ruleOperator} of {data.rules.length} condition{data.rules.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="bg-neutral-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
          Targeting ({data.rules.length} condition{data.rules.length !== 1 ? "s" : ""})
        </p>
        {data.rules.length === 0 ? (
          <p className="text-sm text-neutral-500">No conditions — shows to everyone</p>
        ) : (
          <ul className="space-y-1">
            {data.rules.map((r) => (
              <li key={r.id} className="text-sm text-neutral-700">
                <span className="font-medium">{RULE_TYPE_LABELS[r.type]}</span> {r.operator} {r.value}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-neutral-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
          Actions ({data.actions.length})
        </p>
        {data.actions.length === 0 ? (
          <p className="text-sm text-amber-600">No actions defined — add at least one action.</p>
        ) : (
          <ul className="space-y-1">
            {data.actions.map((a) => (
              <li key={a.id} className="text-sm text-neutral-700">
                <span className="font-medium">{ACTION_TYPE_LABELS[a.type]}</span>
                {a.selector && <span className="text-neutral-500"> on {a.selector}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <LaunchReadinessPanel checks={checks} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "basics", title: "Basics", icon: <Target className="w-4 h-4" /> },
  { key: "targeting", title: "Targeting", icon: <User className="w-4 h-4" /> },
  { key: "actions", title: "Actions", icon: <Tag className="w-4 h-4" /> },
  { key: "review", title: "Review", icon: <Target className="w-4 h-4" /> },
];

export function PersonalizationTestWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<WizardData>({
    name: "",
    hypothesis: "",
    rules: [],
    ruleOperator: "AND",
    actions: [newAction()],
  });

  function update(patch: Partial<WizardData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function canNext(): boolean {
    if (step === 0) return data.name.trim().length > 0;
    if (step === 2) return data.actions.length > 0;
    return true;
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      // Build targeting rules in the format the API expects
      const targetingRules = data.rules.length > 0
        ? [{ operator: data.ruleOperator, conditions: data.rules.map((r) => ({
            type: r.type,
            operator: r.operator === "is" ? "eq"
              : r.operator === "is_not" ? "neq"
              : r.operator === "contains" ? "contains"
              : r.operator === "greater_than" ? "gt"
              : r.operator === "less_than" ? "lt"
              : "in",
            value: r.value,
          })) }]
        : [];

      const payload = {
        name: data.name,
        hypothesis: data.hypothesis,
        targetingRules,
        trafficAllocation: 100,
        variants: [
          {
            key: "control",
            name: "Original",
            isControl: true,
            allocationPercent: 50,
            actions: [],
          },
          {
            key: "personalized",
            name: "Personalized",
            isControl: false,
            allocationPercent: 50,
            actions: data.actions.map((a) => ({
              type: a.type,
              selector: a.selector,
              content: a.content,
              offerId: a.offerId,
            })),
          },
        ],
      };

      const res = await fetch("/api/personalization-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "Failed to save personalization";
        toast.error(msg);
        setError(msg);
        return;
      }

      toast.success(`Personalization test created — activate it from the test detail page.`);
      router.push("/personalization-tests");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : router.push("/personalization-tests"))}
          className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-neutral-900">New Personalization</h1>
          <p className="text-xs text-neutral-500">Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                  i < step
                    ? "bg-success-500 text-white"
                    : i === step
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-400"
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  i === step ? "text-neutral-900" : "text-neutral-400"
                )}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 min-w-4", i < step ? "bg-success-300" : "bg-neutral-200")} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]?.title ?? ""}</CardTitle>
          </CardHeader>

          {step === 0 && <StepBasics data={data} onChange={update} />}
          {step === 1 && <StepTargeting data={data} onChange={update} />}
          {step === 2 && <StepActions data={data} onChange={update} />}
          {step === 3 && <StepReview data={data} />}
        </Card>

        {error && (
          <div className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => (step > 0 ? setStep(step - 1) : router.push("/personalization-tests"))}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              iconPosition="right"
              disabled={!canNext()}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button size="sm" loading={saving} onClick={submit} disabled={data.actions.length === 0}>
              Create Personalization
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
