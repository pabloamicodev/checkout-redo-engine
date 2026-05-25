import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

// Cart attribute key prefix written by marginlab-runtime.js:
//   _ml_exp_<first 8 chars of experimentId> = variantKey
const EXP_ATTR_PREFIX = "_ml_exp_";

interface VariantDiscountRule {
  experiment_id: string;
  variant_key: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minimum_cart_value?: number;
  message?: string;
}

interface OfferRule {
  offer_id: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE";
  value: number;
  minimum_cart_value?: number;
  requires_activation: boolean;
  message?: string;
}

interface OrderDiscountConfig {
  variant_discounts: VariantDiscountRule[];
  offer_rules: OfferRule[];
}

export function run(input: RunInput): FunctionRunResult {
  const raw = input?.discountNode?.metafield?.jsonValue;
  if (!raw) return EMPTY_DISCOUNT;

  let config: OrderDiscountConfig;
  try {
    config = typeof raw === "string" ? JSON.parse(raw) : (raw as OrderDiscountConfig);
  } catch {
    return EMPTY_DISCOUNT;
  }

  const cartAttributes: Array<{ key: string; value: string }> =
    (input.cart.attributes as Array<{ key: string; value: string }>) ?? [];

  const subtotal = parseFloat(
    (input.cart.cost?.subtotalAmount?.amount as string | undefined) ?? "0"
  );

  const discounts: FunctionRunResult["discounts"] = [];

  // ── Variant discount rules ────────────────────────────────────────────────
  for (const rule of config.variant_discounts ?? []) {
    if (!rule.experiment_id || !rule.variant_key || !rule.value) continue;

    // Cart attribute key uses first 8 chars of the experiment ID
    const attrKey = EXP_ATTR_PREFIX + rule.experiment_id.slice(0, 8);
    const assigned = cartAttributes.find((a) => a.key === attrKey);
    if (!assigned || assigned.value !== rule.variant_key) continue;

    if (rule.minimum_cart_value !== undefined && subtotal < rule.minimum_cart_value) continue;

    discounts.push(buildDiscount(rule.discount_type, rule.value, rule.message));
  }

  // ── Offer rules ───────────────────────────────────────────────────────────
  for (const rule of config.offer_rules ?? []) {
    if (!rule.offer_id || !rule.value) continue;
    if (rule.requires_activation) continue; // activated offers handled client-side
    if (rule.minimum_cart_value !== undefined && subtotal < rule.minimum_cart_value) continue;

    discounts.push(buildDiscount(rule.discount_type, rule.value, rule.message));
  }

  if (discounts.length === 0) return EMPTY_DISCOUNT;

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts,
  };
}

function buildDiscount(
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE",
  value: number,
  message?: string
): FunctionRunResult["discounts"][number] {
  const discount: FunctionRunResult["discounts"][number] = {
    targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
    value:
      type === "PERCENTAGE"
        ? { percentage: { value: value.toFixed(2) } }
        : { fixedAmount: { amount: value.toFixed(2) } },
  };
  if (message) discount.message = message;
  return discount;
}
