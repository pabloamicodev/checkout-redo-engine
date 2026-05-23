/**
 * MarginLab Product Discount Function
 *
 * Applies product-level discounts based on experiment variant assignment.
 * Config is stored as metafields on the Shopify Discount object.
 *
 * Supports:
 * - Percentage off per product/variant
 * - Fixed amount off per product/variant
 * - Volume discounts (quantity-based)
 * - Experiment variant-specific pricing
 */

use shopify_function::prelude::*;
use shopify_function::Result;
use serde::{Deserialize, Serialize};

generate_types!(
    query_path = "src/run.graphql",
    schema_path = "schema.graphql"
);

#[derive(Serialize, Deserialize, Default, Debug)]
struct Configuration {
    /// Map of experiment_variant_key -> discount_rules
    variant_discounts: Vec<VariantDiscountRule>,
    /// Global discount rules (non-experiment)
    global_discounts: Vec<GlobalDiscountRule>,
}

#[derive(Serialize, Deserialize, Debug)]
struct VariantDiscountRule {
    experiment_id: String,
    variant_key: String,
    discount_type: DiscountType,
    value: f64,
    eligible_product_ids: Vec<String>,
    eligible_variant_ids: Vec<String>,
    minimum_quantity: Option<u32>,
    message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct GlobalDiscountRule {
    discount_type: DiscountType,
    value: f64,
    eligible_product_ids: Vec<String>,
    minimum_quantity: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum DiscountType {
    Percentage,
    FixedAmount,
}

#[shopify_function]
fn function(input: input::ResponseData) -> Result<output::FunctionRunResult> {
    let config = input
        .discount_node
        .metafield
        .as_ref()
        .and_then(|m| serde_json::from_str::<Configuration>(&m.value).ok())
        .unwrap_or_default();

    // Read cart attributes for experiment assignments
    // Cart attributes are prefixed with "_ml_exp_"
    let assignments: std::collections::HashMap<String, String> = input
        .cart
        .attributes
        .iter()
        .filter_map(|a| {
            if a.key.starts_with("_ml_exp_") {
                let exp_id = a.key.trim_start_matches("_ml_exp_").to_string();
                Some((exp_id, a.value.clone().unwrap_or_default()))
            } else {
                None
            }
        })
        .collect();

    let mut discounts: Vec<output::Discount> = vec![];

    for line in &input.cart.lines {
        let merchandise = &line.merchandise;

        let (product_id, variant_id) = match merchandise {
            input::CartLineMerchandise::ProductVariant(pv) => {
                (pv.product.id.to_string(), pv.id.to_string())
            }
            _ => continue,
        };

        let quantity = line.quantity as u32;

        // Check variant-specific discount rules — collect ALL matching discounts
        for rule in &config.variant_discounts {
            // Check if this cart has the matching experiment assignment
            let exp_id_short = rule.experiment_id.chars().take(8).collect::<String>();
            let assigned_variant = assignments.get(&exp_id_short).or_else(|| assignments.get(&rule.experiment_id));

            if assigned_variant.map_or(true, |k| k != &rule.variant_key) {
                continue;
            }

            // Check eligibility
            let product_eligible = rule.eligible_product_ids.is_empty()
                || rule.eligible_product_ids.contains(&product_id);
            let variant_eligible = rule.eligible_variant_ids.is_empty()
                || rule.eligible_variant_ids.contains(&variant_id);

            if !product_eligible && !variant_eligible {
                continue;
            }

            // Check minimum quantity
            if let Some(min_qty) = rule.minimum_quantity {
                if quantity < min_qty {
                    continue;
                }
            }

            let discount = match rule.discount_type {
                DiscountType::Percentage => output::Discount {
                    message: rule.message.clone(),
                    conditions: None,
                    targets: vec![output::Target::ProductVariant(output::ProductVariantTarget {
                        id: line.merchandise.id(),
                        quantity: None,
                    })],
                    value: output::Value::Percentage(output::Percentage {
                        value: Decimal(rule.value.to_string()),
                    }),
                },
                DiscountType::FixedAmount => output::Discount {
                    message: rule.message.clone(),
                    conditions: None,
                    targets: vec![output::Target::ProductVariant(output::ProductVariantTarget {
                        id: line.merchandise.id(),
                        quantity: None,
                    })],
                    value: output::Value::FixedAmount(output::FixedAmount {
                        amount: Decimal(rule.value.to_string()),
                        applies_to_each_item: Some(false),
                    }),
                },
            };

            // Collect, do not early-return — apply to ALL eligible lines
            discounts.push(discount);
            // Only apply the first matching rule per line (avoid double-discount)
            break;
        }
    }

    Ok(output::FunctionRunResult {
        discounts,
        discount_application_strategy: output::DiscountApplicationStrategy::First,
    })
}

trait MerchandiseId {
    fn id(&self) -> ID;
}

impl MerchandiseId for input::CartLineMerchandise {
    fn id(&self) -> ID {
        match self {
            input::CartLineMerchandise::ProductVariant(pv) => pv.id.clone(),
            _ => ID::from(""),
        }
    }
}
