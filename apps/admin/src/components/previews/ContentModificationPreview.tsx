"use client";

import { cn } from "@/lib/utils";

type ChangeType = "text" | "html" | "css" | "attribute" | "visibility" | string;

interface Modification {
  selector: string;
  changeType: ChangeType;
  value: string;
  controlValue?: string;
}

interface ContentModificationPreviewProps {
  modifications?: Modification[];
  className?: string;
}

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const colors: Record<string, string> = {
    text: "bg-violet-50 text-violet-700 border-violet-100",
    html: "bg-blue-50 text-blue-700 border-blue-100",
    css: "bg-pink-50 text-pink-700 border-pink-100",
    attribute: "bg-amber-50 text-amber-700 border-amber-100",
    visibility: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", colors[type] ?? "bg-neutral-100 text-neutral-500 border-neutral-200")}>
      {type}
    </span>
  );
}

function ModificationRow({ mod }: { mod: Modification }) {
  return (
    <div className="rounded-lg border border-neutral-100 overflow-hidden">
      {/* Selector header */}
      <div className="px-3 py-2 bg-neutral-50 flex items-center justify-between gap-2 border-b border-neutral-100">
        <code className="text-[11px] text-violet-600 font-mono truncate">{mod.selector}</code>
        <ChangeTypeBadge type={mod.changeType} />
      </div>

      {/* Before / After */}
      <div className="grid grid-cols-2 divide-x divide-neutral-100">
        <div className="px-3 py-2 space-y-1">
          <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">Before</p>
          <p className="text-xs text-neutral-500 line-through">{mod.controlValue ?? "(no value)"}</p>
        </div>
        <div className="px-3 py-2 space-y-1">
          <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">After</p>
          <p className="text-xs text-violet-700 font-medium">{mod.value || "(empty)"}</p>
        </div>
      </div>
    </div>
  );
}

export function ContentModificationPreview({ modifications, className }: ContentModificationPreviewProps) {
  const mods = modifications ?? [];

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Content Changes Preview</span>
        </div>
        {mods.length > 0 && (
          <span className="text-[10px] text-neutral-400">{mods.length} modification{mods.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <div className="p-4">
        {mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-300 space-y-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <p className="text-xs">Add content modifications to see a preview</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mods.map((mod, i) => (
              <ModificationRow key={i} mod={mod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
