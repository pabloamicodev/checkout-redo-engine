"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "variants_configured",
    label: "All variants configured",
    description: "Every variant has a unique key, name, and allocation percent. Allocations sum to 100%.",
    required: true,
  },
  {
    id: "hypothesis_set",
    label: "Hypothesis documented",
    description: "The hypothesis field explains what you expect to happen and why.",
    required: false,
  },
  {
    id: "traffic_allocation",
    label: "Traffic allocation reviewed",
    description: "Traffic allocation percentage is intentional (start low: 10-20% for risky tests).",
    required: true,
  },
  {
    id: "control_identified",
    label: "Control variant identified",
    description: "Exactly one variant is marked as the control (current experience).",
    required: true,
  },
  {
    id: "targeting_rules_tested",
    label: "Targeting rules validated",
    description: "Targeting rules have been tested in preview mode and produce the expected audience.",
    required: false,
  },
  {
    id: "preview_checked",
    label: "Storefront preview checked",
    description: "Each variant has been previewed on the live storefront using the ?marginlab_preview= URL param.",
    required: true,
  },
  {
    id: "analytics_configured",
    label: "Analytics integration active",
    description: "At least one analytics integration (GA4, Klaviyo, etc.) is enabled and credentials are saved.",
    required: false,
  },
  {
    id: "goal_metric_reviewed",
    label: "Primary metric selected",
    description: "The primary metric (conversion rate, RPV, AOV) is appropriate for this test's hypothesis.",
    required: true,
  },
  {
    id: "duration_planned",
    label: "Minimum duration planned",
    description: "The test will run long enough to reach statistical significance (typically 1-2 full business cycles).",
    required: true,
  },
  {
    id: "rollback_understood",
    label: "Rollback plan understood",
    description: "You know how to pause or roll back this experiment if unexpected issues arise.",
    required: true,
  },
];

interface Props {
  experimentId: string;
  experimentStatus: string;
  onLaunch?: () => void;
}

export function QAChecklist({ experimentId, experimentStatus, onLaunch }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredItems = CHECKLIST_ITEMS.filter((i) => i.required);
  const allRequiredChecked = requiredItems.every((i) => checked.has(i.id));
  const totalChecked = checked.size;
  const totalItems = CHECKLIST_ITEMS.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleLaunch() {
    if (!allRequiredChecked) return;
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      onLaunch?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  const canLaunch = ["DRAFT", "QA", "PAUSED", "SCHEDULED"].includes(experimentStatus);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${allRequiredChecked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {totalChecked}/{totalItems}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-neutral-900">Pre-launch QA checklist</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {allRequiredChecked ? "All required checks passed — ready to launch" : `${requiredItems.filter((i) => !checked.has(i.id)).length} required item(s) remaining`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>

      {expanded && (
        <div className="border-t border-neutral-100">
          <div className="divide-y divide-neutral-50">
            {CHECKLIST_ITEMS.map((item) => {
              const isDone = checked.has(item.id);
              return (
                <label key={item.id} className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <button
                    className="mt-0.5 shrink-0"
                    onClick={(e) => { e.preventDefault(); toggle(item.id); }}
                    aria-checked={isDone}
                  >
                    {isDone
                      ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                      : <Circle className={`w-5 h-5 ${item.required ? "text-amber-400" : "text-neutral-300"}`} />
                    }
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isDone ? "text-neutral-500 line-through" : "text-neutral-900"}`}>{item.label}</span>
                      {item.required && !isDone && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-neutral-100 space-y-3">
            {!allRequiredChecked && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Complete all required items before launching.
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            {canLaunch && (
              <Button
                size="sm"
                onClick={handleLaunch}
                disabled={!allRequiredChecked || launching}
                className="w-full"
              >
                {launching ? "Launching…" : "Launch Experiment"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
