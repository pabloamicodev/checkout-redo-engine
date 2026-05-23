"use client";

import { cn } from "@/lib/utils";

type DiscountType = "percentage" | "fixed_amount" | "free_shipping" | "bxgy" | string;

interface DiscountPreviewProps {
  discountType?: DiscountType;
  value?: number;
  label?: string;
  eligibilityMessage?: string;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function DiscountPreview({
  discountType = "percentage",
  value,
  label,
  eligibilityMessage,
  currency = "USD",
  className,
}: DiscountPreviewProps) {
  const badgeText = (() => {
    if (label) return label;
    if (discountType === "percentage") return value != null ? `${value}% OFF` : "% OFF";
    if (discountType === "fixed_amount") return value != null ? `${fmt(value, currency)} OFF` : "$ OFF";
    if (discountType === "free_shipping") return "FREE SHIPPING";
    if (discountType === "bxgy") return "BUY X GET Y";
    return "DISCOUNT";
  })();

  const eligibility = eligibilityMessage ?? (() => {
    if (discountType === "percentage") return "Applied automatically at checkout";
    if (discountType === "fixed_amount") return "Discount code applied to qualifying orders";
    if (discountType === "free_shipping") return "On all orders — no minimum required";
    if (discountType === "bxgy") return "Add qualifying items to unlock deal";
    return "Conditions apply";
  })();

  const isLarge = discountType === "percentage" || discountType === "fixed_amount";

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Discount Preview</span>
      </div>

      <div className="p-4">
        {/* Discount callout card */}
        <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 space-y-3">
          {/* Badge */}
          <div className="flex justify-center">
            <div className={cn(
              "rounded-full font-black tracking-wider text-white px-5 py-2 bg-amber-500",
              isLarge ? "text-2xl" : "text-sm px-4 py-1.5"
            )}>
              {badgeText}
            </div>
          </div>

          {/* Price line for % or fixed */}
          {(discountType === "percentage" || discountType === "fixed_amount") && value != null && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-neutral-400 line-through text-sm">
                {discountType === "percentage" ? fmt(100, currency) : fmt((value ?? 0) + 50, currency)}
              </span>
              <span className="text-2xl font-bold text-amber-600">
                {discountType === "percentage"
                  ? fmt(100 * (1 - value / 100), currency)
                  : fmt(50, currency)}
              </span>
            </div>
          )}

          {/* Eligibility */}
          <p className="text-center text-xs text-neutral-500">{eligibility}</p>
        </div>

        <p className="mt-2 text-[10px] text-neutral-400 text-center">Simulated discount display</p>
      </div>
    </div>
  );
}
