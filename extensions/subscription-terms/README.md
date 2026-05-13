# Subscription Terms

A Checkout UI Extension that shows a mandatory Terms & Conditions acceptance checkbox when the cart contains subscription or recurring products. The buyer cannot advance to payment without checking the box. The extension is invisible when there are no subscription products in the cart.

---

## What it does

- Detects subscription cart lines via `sellingPlanAllocation`, `merchandise.sellingPlan`, `requiresSellingPlan`, or bundle `lineComponents`
- Renders a checkbox with a configurable message and a clickable T&C link
- Blocks checkout progress via `buyerJourney.intercept` if the buyer tries to advance without accepting
- Shows an inline error banner only after a blocked attempt — not on page load
- Writes `_terms_blocked` as an order attribute so downstream tools (Klaviyo, Shopify Flow) can act on it

---

## Order attributes written

| Attribute | Value | When |
|---|---|---|
| `_terms_blocked` | `"true"` | Buyer attempted to advance without accepting |
| `_terms_blocked` | `"false"` | Buyer accepted or the cart has no subscription items |

The `_` prefix hides this attribute from customer-facing order emails but keeps it fully visible in the Shopify admin and downstream tools.

---

## Merchant configuration (checkout editor)

All fields are optional — sensible defaults are provided via the locale file.

| Setting | Description | Default |
|---|---|---|
| `terms_url` | Full URL of the T&C page | `#` |
| `text_before_link` | Text that appears before the clickable link | *(see `locales/en.default.json`)* |
| `link_text` | Anchor text of the T&C link | `Terms and Conditions` |
| `text_after_link` | Text that appears after the link | *(see locale file)* |
| `text_color` | Color of the label text (`subdued` or `base`) | checkout default |
| `link_tone` | Color tone of the link (`auto` or `neutral`) | `auto` |

---

## Activation (required after deploy)

1. Go to **Shopify Admin → Settings → Checkout**
2. Click **Customize**
3. In the left panel, click **Add block**
4. Find **"Subscription Terms & Conditions"** under your app's blocks
5. Place it in the **Payment** step, above the payment form
6. Set `terms_url` to your store's T&C page
7. Click **Save**

Repeat for each store: HPN, GetTruSupps, ONE SOL, Ambrosia.

---

## Where to see the data

### Completed orders

```
Shopify Admin → Orders → [any order] → scroll to bottom → "Additional details"
```

`_terms_blocked = "false"` means the buyer accepted before completing (expected for all completed subscription orders).

### Abandoned checkouts

```
Shopify Admin → Orders → Abandoned checkouts → [checkout] → "Additional details"
```

`_terms_blocked = "true"` means the buyer was blocked by the T&C gate and then abandoned — a specific, actionable signal.

---

## Cross-extension communication — Checkout Step Tracker

This extension works alongside the **Checkout Step Tracker** (`extensions/checkout-step-tracker`). Both write order attributes independently via `applyAttributeChange`, and all attributes appear together on the same order or abandoned checkout record.

### Using both together in Klaviyo

Combine `_checkout_last_step` (from the tracker) with `_terms_blocked` to build targeted recovery flows:

```
Trigger: Checkout Abandoned
  ├── IF _checkout_last_step = "Payment" AND _terms_blocked = "true"
  │     → "You're almost there — please accept our subscription terms to complete your order"
  └── IF _checkout_last_step = "Payment" AND _terms_blocked ≠ "true"
        → Standard payment recovery email
```

This distinguishes buyers who had a genuine objection to the subscription terms from those who had a payment issue — two very different recovery strategies.

---

## Notes

- Requires **Shopify Checkout Extensibility** (not legacy checkout).
- `applyAttributeChange` is marked deprecated in the 2026-01 API but remains fully functional. All calls are wrapped in `.catch()` so a failure never breaks the checkout flow.
- **Accelerated checkout (Apple Pay, Google Pay, Shop Pay):** `buyerJourney.intercept` and `applyAttributeChange` may not fire for express payment methods. `_terms_blocked` will be absent on orders placed via accelerated checkout. This is a Shopify platform limitation.
- The detection logic checks multiple properties to handle both standard subscriptions and bundle-based subscription products.
