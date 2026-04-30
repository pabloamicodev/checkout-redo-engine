import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.Maximum,
  discounts: [],
};

type Tier = {
  qty: number;
  percent: number;
  tag?: string;
  discount_label?: string;
};

export function run(input: RunInput): FunctionRunResult {
  // Group total quantity per product
  const qtyByProduct = new Map<string, { qty: number; lineIds: string[] }>();

  for (const line of input.cart.lines) {
    const merch = line.merchandise;
    if (merch.__typename !== "ProductVariant") continue;
    const productId = merch.product.id;
    const entry = qtyByProduct.get(productId) ?? { qty: 0, lineIds: [] };
    entry.qty += line.quantity;
    entry.lineIds.push(line.id);
    qtyByProduct.set(productId, entry);
  }

  const discounts: FunctionRunResult["discounts"] = [];

  for (const line of input.cart.lines) {
    const merch = line.merchandise;
    if (merch.__typename !== "ProductVariant") continue;

    const productId = merch.product.id;
    const tiersRaw = merch.product.metafield?.jsonValue;
    if (!tiersRaw) continue;

    const tiers: Tier[] = Array.isArray(tiersRaw) ? tiersRaw : JSON.parse(tiersRaw as string);
    const totalQty = qtyByProduct.get(productId)?.qty ?? line.quantity;

    // Find highest qualifying tier
    const best = tiers
      .filter((t) => t.percent > 0 && totalQty >= t.qty)
      .sort((a, b) => b.qty - a.qty)[0];

    if (!best) continue;

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: { percentage: { value: best.percent.toFixed(1) } },
      message: best.discount_label ?? `${best.percent}% off`,
    });
  }

  if (discounts.length === 0) return EMPTY_DISCOUNT;

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.Maximum,
    discounts,
  };
}

