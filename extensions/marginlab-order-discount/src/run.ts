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
  // Present for PRICE_TEST rules — scopes the discount to a specific line item
  target_variant_gid?: string;
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

  // _ml_experiments is a JSON object written by marginlab-runtime.js:
  //   { "<expId8chars>": "variant_key", ... }
  // Shopify Functions can only query cart attributes by individual key (no plural
  // attributes[] in the schema), so we use this single aggregated attribute.
  const mlExpAttr = (input.cart as Record<string, unknown>).mlExperiments as
    | { value: string }
    | null
    | undefined;
  let experimentAssignments: Record<string, string> = {};
  try {
    if (mlExpAttr?.value) {
      experimentAssignments = JSON.parse(mlExpAttr.value) as Record<string, string>;
    }
  } catch {
    // malformed JSON — no assignments
  }

  const subtotal = parseFloat(
    (input.cart.cost?.subtotalAmount?.amount as string | undefined) ?? "0"
  );

  const discounts: FunctionRunResult["discounts"] = [];

  // ── Variant discount rules ────────────────────────────────────────────────
  for (const rule of config.variant_discounts ?? []) {
    if (!rule.experiment_id || !rule.variant_key || !rule.value) continue;

    // Look up assignment using first 8 chars of the experiment ID
    const expShortId = rule.experiment_id.slice(0, 8);
    const assignedVariant = experimentAssignments[expShortId];
    if (!assignedVariant || assignedVariant !== rule.variant_key) continue;

    if (rule.minimum_cart_value !== undefined && subtotal < rule.minimum_cart_value) continue;

    // Price test rules scope the discount to a specific Shopify variant (line item).
    // Discount test rules apply to the whole order subtotal.
    const target: FunctionRunResult["discounts"][number]["targets"][number] =
      rule.target_variant_gid
        ? { productVariant: { id: rule.target_variant_gid } }
        : { orderSubtotal: { excludedVariantIds: [] } };

    discounts.push(buildDiscount(rule.discount_type, rule.value, [target], rule.message));
  }

  // ── Offer rules ───────────────────────────────────────────────────────────
  for (const rule of config.offer_rules ?? []) {
    if (!rule.offer_id || !rule.value) continue;
    if (rule.requires_activation) continue; // activated offers handled client-side
    if (rule.minimum_cart_value !== undefined && subtotal < rule.minimum_cart_value) continue;

    discounts.push(
      buildDiscount(
        rule.discount_type,
        rule.value,
        [{ orderSubtotal: { excludedVariantIds: [] } }],
        rule.message
      )
    );
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
  targets: FunctionRunResult["discounts"][number]["targets"],
  message?: string
): FunctionRunResult["discounts"][number] {
  const discount: FunctionRunResult["discounts"][number] = {
    targets,
    value:
      type === "PERCENTAGE"
        ? { percentage: { value: value.toFixed(2) } }
        : { fixedAmount: { amount: value.toFixed(2) } },
  };
  if (message) discount.message = message;
  return discount;
}
