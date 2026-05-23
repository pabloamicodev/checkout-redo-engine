/**
 * MarginLab Order Discount Function
 *
 * Applies order-level discounts based on experiment variant assignment
 * or standalone offer activation.
 *
 * Supports:
 * - Percentage off entire order
 * - Fixed amount off entire order
 * - Minimum cart value conditions
 * - Campaign link offers (URL param activation stored as cart attribute)
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
    /// Experiment-tied discount rules
    variant_discounts: Vec<VariantDiscountRule>,
    /// Standalone offer rules (not tied to an experiment)
    offer_rules: Vec<OfferRule>,
}

#[derive(Serialize, Deserialize, Debug)]
struct VariantDiscountRule {
    experiment_id: String,
    variant_key: String,
    discount_type: DiscountType,
    value: f64,
    /// Optional minimum cart subtotal in shop currency
    minimum_cart_value: Option<f64>,
    message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct OfferRule {
    offer_id: String,
    discount_type: DiscountType,
    value: f64,
    minimum_cart_value: Option<f64>,
    /// If set, only applies when cart attribute "_ml_offer_{offer_id}" == "1"
    requires_activation: bool,
    message: Option<String>,
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

    let cart_attributes = &input.cart.attributes;
    let attributes: std::collections::HashMap<String, String> = cart_attributes
        .iter()
        .filter_map(|a| a.value.as_ref().map(|v| (a.key.clone(), v.clone())))
        .collect();

    // Extract experiment assignments (keys starting with "_ml_exp_")
    let assignments: std::collections::HashMap<String, String> = attributes
        .iter()
        .filter(|(k, _)| k.starts_with("_ml_exp_"))
        .map(|(k, v)| (k.trim_start_matches("_ml_exp_").to_string(), v.clone()))
        .collect();

    let subtotal: f64 = input
        .cart
        .cost
        .subtotal_amount
        .amount
        .0
        .parse()
        .unwrap_or(0.0);

    // Check variant-tied discounts first
    for rule in &config.variant_discounts {
        let exp_id_short = rule.experiment_id.chars().take(8).collect::<String>();
        let assigned_variant = assignments
            .get(&exp_id_short)
            .or_else(|| assignments.get(&rule.experiment_id));

        if assigned_variant.map_or(true, |k| k != &rule.variant_key) {
            continue;
        }

        if let Some(min_val) = rule.minimum_cart_value {
            if subtotal < min_val {
                continue;
            }
        }

        return Ok(build_order_discount(&rule.discount_type, rule.value, rule.message.clone()));
    }

    // Check standalone offer rules
    for rule in &config.offer_rules {
        if rule.requires_activation {
            let activation_key = format!("_ml_offer_{}", rule.offer_id);
            if attributes.get(&activation_key).map_or(true, |v| v != "1") {
                continue;
            }
        }

        if let Some(min_val) = rule.minimum_cart_value {
            if subtotal < min_val {
                continue;
            }
        }

        return Ok(build_order_discount(&rule.discount_type, rule.value, rule.message.clone()));
    }

    Ok(output::FunctionRunResult {
        discounts: vec![],
        discount_application_strategy: output::DiscountApplicationStrategy::First,
    })
}

fn build_order_discount(
    discount_type: &DiscountType,
    value: f64,
    message: Option<String>,
) -> output::FunctionRunResult {
    let discount = match discount_type {
        DiscountType::Percentage => output::Discount {
            message,
            conditions: None,
            targets: vec![output::Target::OrderSubtotal(output::OrderSubtotalTarget {
                excluded_variant_ids: vec![],
            })],
            value: output::Value::Percentage(output::Percentage {
                value: Decimal(value.to_string()),
            }),
        },
        DiscountType::FixedAmount => output::Discount {
            message,
            conditions: None,
            targets: vec![output::Target::OrderSubtotal(output::OrderSubtotalTarget {
                excluded_variant_ids: vec![],
            })],
            value: output::Value::FixedAmount(output::FixedAmount {
                amount: Decimal(value.to_string()),
                applies_to_each_item: Some(false),
            }),
        },
    };

    output::FunctionRunResult {
        discounts: vec![discount],
        discount_application_strategy: output::DiscountApplicationStrategy::First,
    }
}
