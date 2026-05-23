# MarginLab — Shopify Scope Audit

Last audited: 2026-05-22

## Required scopes

| Scope | Reason | Code reference |
|---|---|---|
| `read_products` | Read product variants for price testing display | `services/price-test.service.ts` |
| `write_products` | Mutate variant prices for live price tests | `services/price-test.service.ts` |
| `read_orders` | Order attribution for A/B analytics | `services/order-attribution.service.ts` |
| `read_customers` | Customer segment targeting for personalizations | `services/personalization.service.ts` |
| `read_discounts` | Read existing discounts to avoid conflicts | `services/discount.service.ts` |
| `write_discounts` | Create automatic discounts via Shopify Functions | `services/discount.service.ts` |
| `read_price_rules` | Read existing price rules | `services/discount.service.ts` |
| `write_price_rules` | Create discount codes for variant tests | `services/discount.service.ts` |
| `read_metaobjects` | Read function config stored in metafields | `services/function-config.service.ts` |
| `write_metaobjects` | Write function config to metafields | `services/function-config.service.ts` |
| `read_themes` | Detect active theme for theme A/B test setup | `services/theme-test.service.ts` |

## Removed scopes

| Scope | Reason removed |
|---|---|
| `write_themes` | Unused — theme tests use Theme App Extensions (read-only theme access is sufficient) |
| `write_script_tags` | Unused — no legacy ScriptTag injection anywhere in the codebase |
| `read_script_tags` | Unused — removed alongside write_script_tags |

## How to add a new scope

1. Add the scope to `shopify.app.toml` → `[access_scopes]`
2. Add a row to this file with the reason and code reference
3. Run `shopify app deploy` — merchants will be prompted to re-authorize on next install
