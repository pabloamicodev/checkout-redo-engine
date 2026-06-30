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

type EligibleLine = {
  id: string;
  quantity: number;
  total: number;
  tiers: Tier[];
};

function isTier(value: unknown): value is Tier {
  if (value == null || typeof value !== "object") return false;

  const tier = value as Partial<Tier>;
  const qty = tier.qty;
  const percent = tier.percent;

  return (
    typeof qty === "number" &&
    Number.isFinite(qty) &&
    Number.isInteger(qty) &&
    qty > 0 &&
    typeof percent === "number" &&
    Number.isFinite(percent) &&
    percent >= 0 &&
    (tier.discount_label == null || typeof tier.discount_label === "string")
  );
}

function readTiers(raw: unknown): Tier[] {
  const parsedRaw = (() => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string") return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return parsedRaw.filter(isTier);
}

export function run(input: RunInput): FunctionRunResult {
  const eligibleLines: EligibleLine[] = [];

  for (const line of input.cart.lines) {
    if (line.bundleItem?.value === "true") continue;

    const merch = line.merchandise;
    // __typename check + fallback: skip non-ProductVariant lines (e.g. gift cards)
    if (merch.__typename !== "ProductVariant") continue;

    const tiersRaw = merch.product.metafield?.jsonValue;
    if (!tiersRaw) continue;

    const tiers = readTiers(tiersRaw);
    if (tiers.length === 0) continue;

    const total = parseFloat(line.cost.totalAmount.amount as string);
    if (!Number.isFinite(total) || total <= 0) continue;

    eligibleLines.push({
      id: line.id,
      quantity: line.quantity,
      total,
      tiers,
    });
  }

  if (eligibleLines.length === 0) return EMPTY_DISCOUNT;

  const totalQty = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = eligibleLines.reduce((sum, line) => sum + line.total, 0);
  const tiers = eligibleLines.flatMap((line) => line.tiers);
  const best = tiers
    .filter((t) => t.percent > 0 && totalQty >= t.qty)
    .sort((a, b) => b.qty - a.qty || b.percent - a.percent)[0];

  if (!best) return EMPTY_DISCOUNT;

  const totalDiscount = Math.round(subtotal * best.percent) / 100;
  let remainingDiscount = totalDiscount;

  const discounts = eligibleLines.map((line, index) => {
    const isLast = index === eligibleLines.length - 1;
    const lineDiscount = isLast
      ? remainingDiscount
      : Math.round(totalDiscount * (line.total / subtotal) * 100) / 100;
    remainingDiscount = Math.round((remainingDiscount - lineDiscount) * 100) / 100;

    return {
      targets: [{ cartLine: { id: line.id } }],
      value: { fixedAmount: { amount: lineDiscount.toFixed(2) } },
      message: best.discount_label ?? `${best.percent}% off`,
    };
  });

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
