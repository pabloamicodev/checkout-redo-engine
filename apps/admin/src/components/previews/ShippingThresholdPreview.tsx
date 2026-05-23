"use client";

import { cn } from "@/lib/utils";

interface ShippingThresholdPreviewProps {
  threshold: number;
  currentCartValue?: number;
  message?: string;
  qualifiedMessage?: string;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function ShippingThresholdPreview({
  threshold,
  currentCartValue = 0,
  message,
  qualifiedMessage,
  currency = "USD",
  className,
}: ShippingThresholdPreviewProps) {
  const remaining = Math.max(0, threshold - currentCartValue);
  const progress = threshold > 0 ? Math.min(100, (currentCartValue / threshold) * 100) : 0;
  const qualified = remaining === 0;

  const defaultMessage = qualified
    ? qualifiedMessage ?? "🎉 You've unlocked free shipping!"
    : message ?? `Add ${fmt(remaining, currency)} more for free shipping`;

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Shipping Threshold Preview</span>
      </div>

      {/* Simulated banner */}
      <div className="p-4">
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 space-y-2">
          {/* Message */}
          <p className={cn("text-sm font-medium", qualified ? "text-cyan-700" : "text-cyan-800")}>
            {defaultMessage}
          </p>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-cyan-100 overflow-hidden">
            <div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
                qualified ? "bg-emerald-400" : "bg-cyan-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Labels */}
          <div className="flex items-center justify-between text-[10px] text-cyan-600">
            <span>Cart: {fmt(currentCartValue, currency)}</span>
            <span>Goal: {fmt(threshold, currency)}</span>
          </div>
        </div>

        {/* Example values note */}
        <p className="mt-2 text-[10px] text-neutral-400 text-center">
          Preview uses example cart value of {fmt(currentCartValue, currency)}
        </p>
      </div>
    </div>
  );
}
