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
  productId: string;
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

type RunConfig = {
  excludeQuizBundleLines: boolean;
};

// Not every store on this app runs the Product Quiz (theme: sections/product-quiz.liquid) —
// only stores that do should skip its bundle lines here. Read from the discount's own
// config metafield (per-store, set when that store's automatic discount is created) rather
// than hardcoding it, so this Function's behavior for every OTHER store stays unchanged.
function readConfig(raw: unknown): RunConfig {
  const parsed = (() => {
    if (raw != null && typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw !== "string") return {};

    try {
      const value = JSON.parse(raw);
      return value != null && typeof value === "object" ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  })();

  return {
    excludeQuizBundleLines: parsed.excludeQuizBundleLines === true,
  };
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

// Applies each product's own tiers against that product's own quantity/subtotal
// only — never combined with any other product's lines, even when both carry
// the same metafield. Buying 1 Protein + 1 Energy + 1 Metabolism must not
// trigger a "3 units" tier; only 3+ units of that SAME product should.
function applyTiersWithinGroup(
  groupLines: EligibleLine[],
  discounts: FunctionRunResult["discounts"],
): void {
  const totalQty = groupLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = groupLines.reduce((sum, line) => sum + line.total, 0);
  const tiers = groupLines.flatMap((line) => line.tiers);
  const best = tiers
    .filter((t) => t.percent > 0 && totalQty >= t.qty)
    .sort((a, b) => b.qty - a.qty || b.percent - a.percent)[0];

  if (!best) return;

  const totalDiscount = Math.round(subtotal * best.percent) / 100;
  let remainingDiscount = totalDiscount;

  groupLines.forEach((line, index) => {
    const isLast = index === groupLines.length - 1;
    const lineDiscount = isLast
      ? remainingDiscount
      : Math.round(totalDiscount * (line.total / subtotal) * 100) / 100;
    remainingDiscount = Math.round((remainingDiscount - lineDiscount) * 100) / 100;

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: { fixedAmount: { amount: lineDiscount.toFixed(2) } },
      message: best.discount_label ?? `${best.percent}% off`,
    });
  });
}

export function run(input: RunInput): FunctionRunResult {
  const config = readConfig(input.discountNode.metafield?.jsonValue);
  const eligibleLines: EligibleLine[] = [];

  for (const line of input.cart.lines) {
    if (line.bundleItem?.value === "true") continue;
    if (line.nektarGlp1?.value) continue;
    // Product Quiz results (theme: sections/product-quiz.liquid) bulk-add a
    // bundle's own component products, priced down to a fixed bundle total by
    // a separate discount Function (hpn-scripts-migration). Those lines must
    // never also compete with this cart-wide-per-product volume discount —
    // but only on stores that actually run that quiz (see readConfig above).
    if (config.excludeQuizBundleLines && line.quizBundleId?.value) continue;

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
      productId: merch.product.id,
      quantity: line.quantity,
      total,
      tiers,
    });
  }

  if (eligibleLines.length === 0) return EMPTY_DISCOUNT;

  const groups = new Map<string, EligibleLine[]>();
  for (const line of eligibleLines) {
    const group = groups.get(line.productId);
    if (group) {
      group.push(line);
    } else {
      groups.set(line.productId, [line]);
    }
  }

  const discounts: FunctionRunResult["discounts"] = [];
  for (const groupLines of groups.values()) {
    applyTiersWithinGroup(groupLines, discounts);
  }

  if (discounts.length === 0) return EMPTY_DISCOUNT;

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
