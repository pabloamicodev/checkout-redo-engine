"use client";

import { cn } from "@/lib/utils";

interface SplitUrlVariant {
  name: string;
  url: string;
  weight: number;
}

interface SplitUrlPreviewProps {
  controlUrl?: string;
  variants?: SplitUrlVariant[];
  className?: string;
}

function truncateUrl(url: string, max = 40): string {
  try {
    const u = new URL(url);
    const path = u.pathname + (u.search || "");
    const display = u.hostname + path;
    return display.length > max ? display.slice(0, max) + "…" : display;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

const VARIANT_COLORS = [
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-700",
];

export function SplitUrlPreview({ controlUrl, variants = [], className }: SplitUrlPreviewProps) {
  const allBranches: Array<{ label: string; url: string; weight: number; colorIndex: number; isControl: boolean }> = [
    { label: "Control", url: controlUrl ?? "", weight: 0, colorIndex: -1, isControl: true },
    ...variants.map((v, i) => ({ label: v.name, url: v.url, weight: v.weight, colorIndex: i, isControl: false })),
  ];

  // Assign control weight as remainder
  const variantTotal = variants.reduce((s, v) => s + (v.weight ?? 0), 0);
  if (allBranches[0]) allBranches[0].weight = Math.max(0, 100 - variantTotal);

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">URL Routing Preview</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Visitor node */}
        <div className="flex justify-center">
          <div className="rounded-full border border-neutral-300 bg-neutral-100 px-4 py-1.5 text-xs font-medium text-neutral-600 flex items-center gap-1.5">
            <span>👤</span> Visitor
          </div>
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <div className="w-px h-6 bg-neutral-300" />
        </div>

        {/* Branches */}
        <div className={cn("grid gap-2", allBranches.length <= 2 ? "grid-cols-2" : allBranches.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {allBranches.map((branch, i) => {
            const colorClass = branch.isControl
              ? "border-neutral-200 bg-neutral-50 text-neutral-700"
              : VARIANT_COLORS[branch.colorIndex % VARIANT_COLORS.length];
            return (
              <div key={i} className={cn("rounded-lg border p-2.5 space-y-1", colorClass)}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{branch.label}</span>
                  <span className="text-[10px] font-bold">{branch.weight}%</span>
                </div>
                {branch.url ? (
                  <code className="text-[10px] block truncate opacity-70">{truncateUrl(branch.url)}</code>
                ) : (
                  <code className="text-[10px] opacity-40 italic">no URL set</code>
                )}
              </div>
            );
          })}
        </div>

        {/* Weight bar */}
        <div className="rounded-full overflow-hidden h-2 flex">
          {allBranches.map((branch, i) => {
            const bg = branch.isControl
              ? "bg-neutral-300"
              : ["bg-sky-400","bg-violet-400","bg-emerald-400","bg-amber-400"][branch.colorIndex % 4];
            return (
              <div
                key={i}
                className={cn("h-full transition-all", bg)}
                style={{ width: `${branch.weight}%` }}
                title={`${branch.label}: ${branch.weight}%`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
