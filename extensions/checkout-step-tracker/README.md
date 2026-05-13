# Checkout Step Tracker

An invisible Checkout UI Extension that records the last checkout step reached by the buyer as order attributes. No UI is rendered — it runs silently in the background on every checkout session.

---

## What it captures

Every time a buyer advances to a new checkout step, two order attributes are written:

| Attribute | Example value |
|---|---|
| `_checkout_last_step` | `Payment` |
| `_checkout_step_at` | `2026-05-08T14:32:11.000Z` |

Possible values for `_checkout_last_step`:

| Value | Meaning |
|---|---|
| `Contact Information` | Buyer filled in email/phone |
| `Shipping` | Buyer reached the shipping method step |
| `Payment` | Buyer reached the payment step |
| `Review` | Buyer reached the order review/confirmation step |

The extension only moves the step forward — if the buyer navigates back, the attribute is **not** overwritten with a less-advanced step.

---

## Activation (required after deploy)

The extension must be manually added to the checkout editor for each store. It only runs after it is placed on the canvas.

1. Go to **Shopify Admin → Settings → Checkout**
2. Click **Customize**
3. In the left panel, click **Add block** (or the `+` icon in any section)
4. Find **"Checkout Step Tracker"** under your app's blocks
5. Drag it into any section — it renders nothing visible, placement does not matter
6. Click **Save**

Repeat for each store: HPN, GetTruSupps, ONE SOL, Ambrosia.

---

## Where to see the data

### Completed orders — Shopify Admin

```
Orders → [any order] → scroll to the bottom → "Additional details"
```

Every completed order will show:

```
_checkout_last_step    Payment
_checkout_step_at      2026-05-08T14:32:11.000Z
```

The `_` prefix hides these attributes from the customer-facing order confirmation email, but they remain fully visible in the admin.

---

### Abandoned checkouts — Shopify Admin

```
Orders → Abandoned checkouts → [any abandoned checkout] → "Additional details"
```

This is where the real value is. You can see exactly which step the buyer reached before leaving:

- Abandoned at **Shipping** → likely friction with shipping cost or options
- Abandoned at **Payment** → likely issue with payment method or trust
- Abandoned at **Contact Information** → early drop-off, top-of-funnel issue

---

### Klaviyo — Abandoned Checkout flows

In Klaviyo's **Checkout Abandoned** flow, the order attributes are available as event properties under `extra.note_attributes` (or as top-level properties depending on your Klaviyo integration version).

You can use them to **split the recovery flow by abandonment step**:

**Example flow logic:**
```
Trigger: Checkout Abandoned
  ├── IF _checkout_last_step = "Payment"
  │     → Send email: "Having trouble checking out? We accept PayPal, Shop Pay..."
  └── IF _checkout_last_step = "Shipping"
        → Send email: "Here's a free shipping code just for you: FREESHIP"
```

To set this up in Klaviyo:
1. Open the **Checkout Abandoned** flow
2. Add a **Conditional Split** after the trigger
3. Condition: `Event property → _checkout_last_step → equals → Payment`
4. Build separate email branches per step

---

### Shopify Flow / automations

The attributes are also available in **Shopify Flow** triggers for `Order Created` and `Checkout Abandoned`, under the `customAttributes` field. You can use them to tag orders, notify the team, or trigger other automations.

---

## Notes

- The extension requires **Shopify Checkout Extensibility** (not legacy checkout). All stores using this app already meet this requirement.
- `applyAttributeChange` is marked deprecated in the 2026-01 API but remains fully functional. Shopify maintains deprecated APIs for multiple API versions before removal. We will migrate when a stable replacement that writes to order attributes is available.
- **Accelerated checkout (Apple Pay, Google Pay, Shop Pay):** `applyAttributeChange` throws if the buyer uses an express payment method (`attributes.canUpdateAttributes` is `false`). Step attributes will be absent on orders placed via express checkout. This is a Shopify platform limitation.
- The extension does **not** block checkout progress under any circumstance — it always returns `{ behavior: "allow" }`.

---

## Cross-extension communication — Subscription Terms

This extension shares the same order attribute system with the **Subscription Terms** extension (`extensions/subscription-terms`). Both extensions write order attributes independently using `applyAttributeChange`, and those attributes are all visible together in the same completed order or abandoned checkout.

### Attribute written by Subscription Terms

| Attribute | Value | Meaning |
|---|---|---|
| `_terms_blocked` | `"true"` | Buyer tried to advance without accepting the T&C |
| `_terms_blocked` | `"false"` | Buyer accepted and was allowed through |

### How to use both together in Klaviyo

You can combine `_checkout_last_step` and `_terms_blocked` to build precise abandonment flows:

```
Trigger: Checkout Abandoned
  ├── IF _checkout_last_step = "Payment" AND _terms_blocked = "true"
  │     → Send email: "You're almost there — please accept our subscription terms to complete your order"
  └── IF _checkout_last_step = "Payment" AND _terms_blocked ≠ "true"
        → Send email: standard payment recovery email
```

This lets you send a completely different recovery message to buyers who were blocked specifically because they didn't accept the subscription terms — which is a very different objection from a payment failure.

### How it works technically

Both extensions run in the same checkout session and share the same cart context. They do **not** communicate directly with each other — instead, they each write to the same order attributes object via `applyAttributeChange`. The attributes are merged into the order/abandoned checkout record by Shopify, making them all available together downstream.
