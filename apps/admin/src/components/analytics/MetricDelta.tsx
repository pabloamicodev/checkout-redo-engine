import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricDeltaProps {
  value: number;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function MetricDelta({
  value,
  showIcon = true,
  size = "md",
  className,
}: MetricDeltaProps) {
  if (value === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium text-neutral-400",
          size === "sm" ? "text-xs" : "text-sm",
          className
        )}
      >
        {showIcon && <Minus className="w-3.5 h-3.5" />}
        <span>—</span>
      </span>
    );
  }

  const isPositive = value > 0;
  const formatted = `${isPositive ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        size === "sm" ? "text-xs" : "text-sm",
        isPositive ? "text-emerald-600" : "text-red-500",
        className
      )}
    >
      {showIcon && (
        isPositive ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        )
      )}
      <span>{formatted}</span>
    </span>
  );
}
