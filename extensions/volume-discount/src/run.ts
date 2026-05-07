import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.All,
  discounts: [],
};

type Tier = {
  qty: number;
  percent: number;
  tag?: string;
  discount_label?: string;
};

export function run(input: RunInput): FunctionRunResult {
  const qtyByProduct = new Map<string, { qty: number; lineIds: string[] }>();

  for (const line of input.cart.lines) {
    const merch = line.merchandise;
    // __typename check + fallback: skip non-ProductVariant lines (e.g. gift cards)
    if (merch.__typename !== "ProductVariant" && !("product" in merch)) continue;
    const productId = (merch as any).product?.id;
    if (!productId) continue;
    const entry = qtyByProduct.get(productId) ?? { qty: 0, lineIds: [] };
    entry.qty += line.quantity;
    entry.lineIds.push(line.id);
    qtyByProduct.set(productId, entry);
  }

  const discounts: FunctionRunResult["discounts"] = [];

  for (const line of input.cart.lines) {
    const merch = line.merchandise;
    if (merch.__typename !== "ProductVariant" && !("product" in merch)) continue;

    const variantMerch = merch as any;
    const productId = variantMerch.product?.id;
    const tiersRaw = variantMerch.product?.metafield?.jsonValue;
    if (!productId || !tiersRaw) continue;

    const tiers: Tier[] = Array.isArray(tiersRaw) ? tiersRaw : JSON.parse(tiersRaw as string);
    const totalQty = qtyByProduct.get(productId)?.qty ?? line.quantity;

    const best = tiers
      .filter((t) => t.percent > 0 && totalQty >= t.qty)
      .sort((a, b) => b.qty - a.qty)[0];

    if (!best) continue;

    const lineTotal = parseFloat(line.cost.totalAmount.amount as string);
    const unitPrice = lineTotal / line.quantity;
    const discountPerUnit = Math.floor(unitPrice * best.percent) / 100;
    const totalDiscount = Math.round(discountPerUnit * line.quantity * 100) / 100;

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: { fixedAmount: { amount: totalDiscount.toFixed(2) } },
      message: best.discount_label ?? `${best.percent}% off`,
    });
  }

  if (discounts.length === 0) return EMPTY_DISCOUNT;

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
