/**
 * MarginLab Delivery Customization Function
 *
 * Handles shipping test experiments:
 * - Hide/show delivery options by name or carrier
 * - Rename delivery options
 * - Reorder delivery options
 * - Apply free shipping based on experiment variant
 *
 * Config stored as metafields on the DeliveryCustomization object.
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
    variant_customizations: Vec<VariantDeliveryRule>,
}

#[derive(Serialize, Deserialize, Debug)]
struct VariantDeliveryRule {
    experiment_id: String,
    variant_key: String,
    operations: Vec<DeliveryOperation>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
enum DeliveryOperation {
    Hide { title_contains: String },
    Rename { title_from: String, title_to: String },
    Reorder { title: String, priority: u32 },
}

#[shopify_function]
fn function(input: input::ResponseData) -> Result<output::FunctionRunResult> {
    let config = input
        .delivery_customization
        .metafield
        .as_ref()
        .and_then(|m| serde_json::from_str::<Configuration>(&m.value).ok())
        .unwrap_or_default();

    // Read cart attributes for experiment assignments
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

    let mut operations: Vec<output::Operation> = vec![];

    for rule in &config.variant_customizations {
        let exp_id_short = rule.experiment_id.chars().take(8).collect::<String>();
        let assigned_variant = assignments
            .get(&exp_id_short)
            .or_else(|| assignments.get(&rule.experiment_id));

        if assigned_variant.map_or(true, |k| k != &rule.variant_key) {
            continue;
        }

        for op in &rule.operations {
            match op {
                DeliveryOperation::Hide { title_contains } => {
                    for method in &input.delivery_groups {
                        for delivery_option in &method.delivery_options {
                            if delivery_option.title.to_lowercase().contains(&title_contains.to_lowercase()) {
                                operations.push(output::Operation::Hide(output::HideOperation {
                                    delivery_option_handle: delivery_option.handle.clone(),
                                }));
                            }
                        }
                    }
                }
                DeliveryOperation::Rename { title_from, title_to } => {
                    for method in &input.delivery_groups {
                        for delivery_option in &method.delivery_options {
                            if delivery_option.title.to_lowercase().contains(&title_from.to_lowercase()) {
                                operations.push(output::Operation::Rename(output::RenameOperation {
                                    delivery_option_handle: delivery_option.handle.clone(),
                                    title: title_to.clone(),
                                }));
                            }
                        }
                    }
                }
                DeliveryOperation::Reorder { title, priority } => {
                    for method in &input.delivery_groups {
                        for delivery_option in &method.delivery_options {
                            if delivery_option.title.to_lowercase().contains(&title.to_lowercase()) {
                                operations.push(output::Operation::Reorder(output::ReorderOperation {
                                    delivery_option_handle: delivery_option.handle.clone(),
                                    index: *priority as i64,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    // SAFETY GUARD: never hide all delivery options.
    // If every available delivery option would be hidden, discard all hide operations
    // so customers always have at least one shipping method to choose.
    let total_delivery_options: usize = input
        .delivery_groups
        .iter()
        .map(|g| g.delivery_options.len())
        .sum();

    let hide_count = operations
        .iter()
        .filter(|op| matches!(op, output::Operation::Hide(_)))
        .count();

    if hide_count > 0 && hide_count >= total_delivery_options {
        // Strip all Hide operations — this protects checkout from being unresolvable
        operations.retain(|op| !matches!(op, output::Operation::Hide(_)));
    }

    Ok(output::FunctionRunResult { operations })
}
