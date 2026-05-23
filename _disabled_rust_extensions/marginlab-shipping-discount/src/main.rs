/**
 * MarginLab Shipping Discount Function
 *
 * Applies shipping-level discounts based on experiment variant assignment
 * or standalone free-shipping offer activation.
 *
 * Supports:
 * - 100% off shipping (free shipping)
 * - Percentage off shipping rate
 * - Fixed amount off shipping rate
 * - Minimum cart value threshold
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
    variant_discounts: Vec<VariantShippingRule>,
    offer_rules: Vec<OfferShippingRule>,
}

#[derive(Serialize, Deserialize, Debug)]
struct VariantShippingRule {
    experiment_id: String,
    variant_key: String,
    discount_type: ShippingDiscountType,
    value: f64,
    minimum_cart_value: Option<f64>,
    message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct OfferShippingRule {
    offer_id: String,
    discount_type: ShippingDiscountType,
    value: f64,
    minimum_cart_value: Option<f64>,
    requires_activation: bool,
    message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum ShippingDiscountType {
    /// 100% off — free shipping
    Free,
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

    // Experiment-tied shipping discounts
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

        return Ok(build_shipping_discount(&rule.discount_type, rule.value, rule.message.clone()));
    }

    // Standalone offer shipping rules
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

        return Ok(build_shipping_discount(&rule.discount_type, rule.value, rule.message.clone()));
    }

    Ok(output::FunctionRunResult {
        discounts: vec![],
        discount_application_strategy: output::DiscountApplicationStrategy::First,
    })
}

fn build_shipping_discount(
    discount_type: &ShippingDiscountType,
    value: f64,
    message: Option<String>,
) -> output::FunctionRunResult {
    // Shipping discounts target all shipping lines (empty exclusions = all rates)
    let target = output::Target::ShippingLine(output::ShippingLineTarget {
        id: None,
    });

    let discount_value = match discount_type {
        ShippingDiscountType::Free => output::Value::Percentage(output::Percentage {
            value: Decimal("100".to_string()),
        }),
        ShippingDiscountType::Percentage => output::Value::Percentage(output::Percentage {
            value: Decimal(value.to_string()),
        }),
        ShippingDiscountType::FixedAmount => output::Value::FixedAmount(output::FixedAmount {
            amount: Decimal(value.to_string()),
            applies_to_each_item: Some(false),
        }),
    };

    output::FunctionRunResult {
        discounts: vec![output::Discount {
            message,
            conditions: None,
            targets: vec![target],
            value: discount_value,
        }],
        discount_application_strategy: output::DiscountApplicationStrategy::First,
    }
}
