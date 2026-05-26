// Shopify Delivery Customization Function — MarginLab Shipping Tests
//
// This function controls which shipping methods are visible in checkout
// for each experiment variant assigned to the current visitor.
//
// Config is stored as a JSON metafield on the DeliveryCustomization node:
//   namespace: "$app:marginlab"
//   key:       "shipping-customization-config"
//
// Config shape:
//   {
//     "shipping_rules": [
//       {
//         "experiment_id": "abc123",
//         "variant_key": "variant_b",
//         "operations": [
//           { "type": "hide",   "title_contains": "Express" },
//           { "type": "rename", "title_from": "Standard",  "title_to": "Free Shipping" }
//         ]
//       }
//     ]
//   }
//
// Cart attribute lookup (written by marginlab-runtime.js):
//   key:   "_ml_exp_" + experimentId.slice(0, 8)
//   value: variantKey

// ---------------------------------------------------------------------------
// Input / output types
// (Generated types would normally come from ../generated/api after shopify app build)
// ---------------------------------------------------------------------------

interface CartAttribute {
  key: string;
  value: string;
}

interface DeliveryOption {
  handle: string;
  title: string;
}

interface DeliveryGroup {
  deliveryOptions: DeliveryOption[];
}

interface RunInput {
  cart: {
    attributes: CartAttribute[];
    deliveryGroups: DeliveryGroup[];
  };
  deliveryCustomization: {
    metafield: {
      jsonValue: unknown;
    } | null;
  } | null;
}

type HideOperation = { hide: { deliveryOptionHandle: string } };
type RenameOperation = { rename: { deliveryOptionHandle: string; title: string } };
type DeliveryOperation = HideOperation | RenameOperation;

interface FunctionRunResult {
  operations: DeliveryOperation[];
}

// ---------------------------------------------------------------------------
// Config types (stored in metafield)
// ---------------------------------------------------------------------------

type MethodOperation =
  | { type: "hide"; title_contains: string }
  | { type: "rename"; title_from: string; title_to: string };

interface ShippingRule {
  experiment_id: string;
  variant_key: string;
  operations: MethodOperation[];
}

interface ShippingCustomizationConfig {
  shipping_rules: ShippingRule[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXP_ATTR_PREFIX = "_ml_exp_";

const EMPTY_RESULT: FunctionRunResult = { operations: [] };

// ---------------------------------------------------------------------------
// Function entry point
// ---------------------------------------------------------------------------

export function run(input: RunInput): FunctionRunResult {
  const raw = input?.deliveryCustomization?.metafield?.jsonValue;
  if (!raw) return EMPTY_RESULT;

  let config: ShippingCustomizationConfig;
  try {
    config = typeof raw === "string"
      ? (JSON.parse(raw) as ShippingCustomizationConfig)
      : (raw as ShippingCustomizationConfig);
  } catch {
    return EMPTY_RESULT;
  }

  if (!config.shipping_rules?.length) return EMPTY_RESULT;

  const cartAttributes = input.cart.attributes ?? [];

  // Flatten delivery options across all groups into a single list
  const allOptions: DeliveryOption[] = (input.cart.deliveryGroups ?? [])
    .flatMap((g) => g.deliveryOptions ?? []);

  if (allOptions.length === 0) return EMPTY_RESULT;

  const operations: DeliveryOperation[] = [];

  for (const rule of config.shipping_rules) {
    if (!rule.experiment_id || !rule.variant_key || !rule.operations?.length) continue;

    // Resolve variant assignment from cart attribute
    const attrKey = EXP_ATTR_PREFIX + rule.experiment_id.slice(0, 8);
    const assigned = cartAttributes.find((a) => a.key === attrKey);
    if (!assigned || assigned.value !== rule.variant_key) continue;

    // Apply each method operation for this variant
    for (const op of rule.operations) {
      if (op.type === "hide") {
        const needle = op.title_contains.toLowerCase();
        for (const option of allOptions) {
          if (option.title.toLowerCase().includes(needle)) {
            operations.push({ hide: { deliveryOptionHandle: option.handle } });
          }
        }
      } else if (op.type === "rename") {
        const needle = op.title_from.toLowerCase();
        for (const option of allOptions) {
          if (option.title.toLowerCase().includes(needle)) {
            operations.push({
              rename: { deliveryOptionHandle: option.handle, title: op.title_to },
            });
          }
        }
      }
    }
  }

  return { operations };
}
