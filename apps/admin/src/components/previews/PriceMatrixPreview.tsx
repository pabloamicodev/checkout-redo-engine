"use client";

import { cn } from "@/lib/utils";

interface PriceEntry {
  variantName: string;
  originalPrice?: number;
  newPrice: number;
  compareAtPrice?: number;
}

interface PriceMatrixPreviewProps {
  variants: Array<{
    name: string;
    isControl?: boolean;
    priceOverrides?: Array<{ variantName?: string; price?: number; compareAtPrice?: number }>;
  }>;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function PriceMatrixPreview({ variants, currency = "USD", className }: PriceMatrixPreviewProps) {
  // Collect all product variant names from any experiment variant
  const productVariantNames = Array.from(
    new Set(
      variants.flatMap((v) =>
        (v.priceOverrides ?? []).map((o) => o.variantName ?? "Product")
      )
    )
  );

  if (productVariantNames.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center py-10", className)}>
        <p className="text-xs text-neutral-400">Add products and prices to see a preview</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Price Matrix Preview</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="text-left px-4 py-2.5 text-neutral-400 font-medium">Product Variant</th>
              {variants.map((v) => (
                <th key={v.name} className="text-right px-4 py-2.5 text-neutral-600 font-semibold whitespace-nowrap">
                  {v.name}
                  {v.isControl && (
                    <span className="ml-1 text-[10px] font-normal text-neutral-400">(control)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productVariantNames.map((productVariantName) => {
              const cells: PriceEntry[] = variants.map((v) => {
                const override = (v.priceOverrides ?? []).find((o) => (o.variantName ?? "Product") === productVariantName);
                return {
                  variantName: v.name,
                  newPrice: override?.price ?? 0,
                  compareAtPrice: override?.compareAtPrice,
                };
              });

              // Compute delta vs control
              const controlPrice = cells.find((_, i) => variants[i]?.isControl)?.newPrice;

              return (
                <tr key={productVariantName} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                  <td className="px-4 py-2.5 font-medium text-neutral-700 whitespace-nowrap">{productVariantName}</td>
                  {cells.map((cell, i) => {
                    const delta = controlPrice != null && controlPrice > 0 && !variants[i]?.isControl
                      ? ((cell.newPrice - controlPrice) / controlPrice) * 100
                      : null;
                    const isIncrease = delta != null && delta > 0;
                    const isDecrease = delta != null && delta < 0;

                    return (
                      <td key={i} className="px-4 py-2.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {cell.newPrice > 0 ? (
                            <span className="font-semibold text-neutral-800">{fmt(cell.newPrice, currency)}</span>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                          {cell.compareAtPrice != null && cell.compareAtPrice > 0 && (
                            <span className="text-neutral-400 line-through text-[10px]">{fmt(cell.compareAtPrice, currency)}</span>
                          )}
                          {delta != null && (
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                isIncrease && "text-rose-600 bg-rose-50",
                                isDecrease && "text-emerald-600 bg-emerald-50",
                                !isIncrease && !isDecrease && "text-neutral-400"
                              )}
                            >
                              {isIncrease ? "+" : ""}{delta.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 bg-rose-50/50 border-t border-rose-100">
        <p className="text-[10px] text-rose-600">⚠ Price changes are live for visitors assigned to each variant</p>
      </div>
    </div>
  );
}
