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

    // Calculate discount as fixed amount on the line total (2 decimal rounding)
    // e.g. $39.99 * 3 * 20% = $23.994 -> $23.99 -> final $95.98
    const lineTotal = parseFloat(line.cost.totalAmount.amount as string);
    const discountAmount = Math.round(lineTotal * best.percent) / 100;

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: { fixedAmount: { amount: discountAmount.toFixed(2) } },
      message: best.discount_label ?? `${best.percent}% off`,
    });
  }

  if (discounts.length === 0) return EMPTY_DISCOUNT;

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.Maximum,
    discounts,
  };
}
