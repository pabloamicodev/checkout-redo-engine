import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  trend?: "up" | "down" | "flat";
  pValue?: number;
  loading?: boolean;
  className?: string;
  formatValue?: (v: string | number) => string;
}

function SignificanceBadge({ pValue }: { pValue: number }) {
  if (pValue < 0.05) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Significant
      </span>
    );
  }
  if (pValue < 0.1) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        Trending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
      Not significant
    </span>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  pValue,
  loading,
  className,
  formatValue,
}: MetricCardProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className={cn("p-4 bg-white border border-neutral-200 rounded-xl", className)}>
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
        {label}
      </p>
      <div className="mt-1">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold text-neutral-900">{displayValue}</p>
        )}
      </div>
      {delta !== undefined && !loading && (
        <div className="flex items-center gap-1 mt-1">
          {delta > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          ) : delta < 0 ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-neutral-400" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              delta > 0
                ? "text-emerald-600"
                : delta < 0
                ? "text-red-500"
                : "text-neutral-400"
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(2)}%
          </span>
        </div>
      )}
      {pValue !== undefined && !loading && (
        <div className="mt-2">
          <SignificanceBadge pValue={pValue} />
        </div>
      )}
    </div>
  );
}
