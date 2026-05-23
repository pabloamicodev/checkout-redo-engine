"use client";
import { cn } from "@/lib/utils";
import { InlineAlert } from "@/components/ui/InlineAlert";

export interface AllocationVariant {
  key: string;
  name: string;
  isControl: boolean;
  allocationPercent: number;
}

interface VariantAllocationEditorProps {
  variants: AllocationVariant[];
  onChange: (variants: AllocationVariant[]) => void;
  accentHex?: string;
  compact?: boolean;
}

const VARIANT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#d946ef", "#f97316"];

export function VariantAllocationEditor({ variants, onChange, accentHex = "#6366f1", compact = false }: VariantAllocationEditorProps) {
  const total = variants.reduce((s, v) => s + (v.allocationPercent || 0), 0);
  const valid = Math.abs(total - 100) < 0.1;

  function update(i: number, pct: number) {
    onChange(variants.map((v, idx) => idx === i ? { ...v, allocationPercent: pct } : v));
  }

  function equalSplit() {
    const even = parseFloat((100 / variants.length).toFixed(1));
    const remainder = parseFloat((100 - even * (variants.length - 1)).toFixed(1));
    onChange(variants.map((v, i) => ({ ...v, allocationPercent: i === variants.length - 1 ? remainder : even })));
  }

  return (
    <div className="space-y-3">
      {/* Visual bar */}
      <div className="h-2 flex rounded-full overflow-hidden gap-px">
        {variants.map((v, i) => (
          <div
            key={v.key}
            className="transition-all duration-200"
            style={{ width: `${v.allocationPercent}%`, background: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
          />
        ))}
      </div>

      {/* Inputs */}
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-1")}>
        {variants.map((v, i) => (
          <div key={v.key} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }} />
            <span className={cn("text-xs text-neutral-700 flex-1 truncate", v.isControl ? "font-medium" : "")}>
              {v.name}
              {v.isControl && <span className="ml-1.5 text-[10px] text-neutral-400">control</span>}
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={v.allocationPercent}
                onChange={(e) => update(i, parseFloat(e.target.value) || 0)}
                className="w-16 text-right text-xs px-2 py-1 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <span className="text-xs text-neutral-400">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", valid ? "text-emerald-600" : "text-red-600")}>
          Total: {total.toFixed(1)}%
          {valid ? " ✓" : " — must equal 100%"}
        </span>
        <button type="button" onClick={equalSplit} className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2">
          Split evenly
        </button>
      </div>

      {!valid && (
        <InlineAlert variant="danger">
          Traffic allocation must total exactly 100%. Currently at {total.toFixed(1)}%.
        </InlineAlert>
      )}
    </div>
  );
}
