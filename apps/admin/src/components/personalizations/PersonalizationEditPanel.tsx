"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditPersonalizationForm } from "./EditPersonalizationForm";

interface TargetingRule {
  type: string;
  operator?: string;
  value?: string;
}

interface Props {
  personalizationId: string;
  initial: {
    name: string;
    priority: number;
    startsAt: string | null;
    endsAt: string | null;
    targetingRules: TargetingRule[];
    offerIds: string[];
  };
}

export function PersonalizationEditPanel({ personalizationId, initial }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-fuchsia-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-fuchsia-50/50">
          <Pencil className="w-3.5 h-3.5 text-fuchsia-500" />
          <h2 className="text-xs font-semibold text-neutral-700">Edit personalization</h2>
        </div>
        <div className="px-5 py-5">
          <EditPersonalizationForm
            personalizationId={personalizationId}
            initial={initial}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 border border-neutral-200 hover:bg-neutral-50 transition-colors"
    >
      <Pencil className="w-3.5 h-3.5" />
      Edit
    </button>
  );
}
