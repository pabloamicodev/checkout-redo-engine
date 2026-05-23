# Shopify App Review Instructions — MarginLab

Thank you for reviewing MarginLab. These instructions walk you through every step of install, setup, and feature testing.

> **No CLI, developer dashboard, or technical tools are required.** All steps below use only a standard Shopify Admin and the MarginLab embedded app.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Shopify development store | Any Shopify store — development or standard |
| Active theme | Any published theme (Dawn works well for testing) |
| At least one product | Required for Offer, Price, Discount, and Shipping tests |

---

## 1. Install flow

1. Visit the MarginLab App Store listing and click **Add app**.
2. You will be redirected to the Shopify OAuth consent screen listing the permissions MarginLab requests.
3. Review and click **Install app**.
4. You are redirected to the embedded MarginLab admin inside Shopify.
5. If billing is required: a Shopify billing confirmation screen appears. Confirm or start a free trial to continue.

**Expected result:** MarginLab opens inside Shopify Admin at the Onboarding page.

---

## 2. Billing

1. In MarginLab, go to **Settings → Billing** (or use the direct link shown on the onboarding page).
2. Select a plan and click **Subscribe**.
3. You are redirected to Shopify's standard billing confirmation page.
4. Click **Approve** to activate the subscription.
5. You are returned to MarginLab with your selected plan active.

To test the free trial:
- Select the **Growth** plan — it includes a 14-day free trial.
- Shopify's billing confirmation will show "$0 today, then $X/month after trial".

To cancel:
- Go to **Settings → Billing → Cancel subscription**.
- The plan downgrades to Free immediately.

**Expected result:** Plan status shown in Settings → Billing. Feature limits enforced per plan.

---

## 3. Onboarding checklist

After install, MarginLab shows a setup checklist. Each step auto-detects status and marks itself complete when done.

### Step 1 — Enable Theme App Embed

1. Click **Open Theme Editor** in the onboarding checklist (or go to Shopify Admin → Online Store → Themes → Customize).
2. In the Theme Editor, click **App Embeds** in the left sidebar.
3. Find **MarginLab** and toggle it on.
4. Click **Save**.
5. Return to MarginLab — the "Storefront tracking" step will detect this within a minute.

### Step 2 — Activate the Web Pixel

1. In Shopify Admin, go to **Settings → Customer Events**.
2. Find the MarginLab pixel and click **Connect**.
3. Return to MarginLab — the "Web Pixel" step will detect activity once the first storefront visit occurs.

### Step 3 — Create your first experiment

Click **Create your first experiment** in the onboarding checklist (see Section 4 below).

### Step 4 — Install Health

At any time, click **Setup & Health** in the sidebar to see a merchant-friendly status report for all components. Each failing check shows an explanation, the impact, and a direct fix action.

---

## 4. Creating and running tests

All test types follow the same pattern: **Create → Configure → Preview → Launch → View analytics**.

---

### 4.1 Content Test

Tests storefront text, images, element visibility, and CSS changes.

1. Go to **Content Tests → New Content Test**.
2. Enter a name and select a page (Home, Product, Collection, etc.).
3. Add a variant:
   - Select a change type: Text replacement / Image swap / Hide element / CSS injection.
   - Enter the CSS selector and the replacement value.
4. Click **Preview** to open a storefront preview with the variant active.
5. Click **Launch**.
6. Visit your storefront in an incognito window — MarginLab assigns the visitor to a variant.
7. Navigate and complete a purchase to generate analytics data.
8. Return to MarginLab → Content Tests → your test → **Analytics** to see results.

**To pause:** click **Pause** on the test detail page. Variants stop rendering immediately.

---

### 4.2 Split URL Test

Redirects a percentage of visitors to alternate URLs.

1. Go to **Split URL Tests → New Split URL Test**.
2. Enter the control URL (e.g. `/products/shirt`).
3. Add one or more variant URLs (e.g. `/products/shirt-v2`).
4. Set traffic split percentages.
5. Click **Launch**.
6. Visit the control URL in an incognito window — some visits will redirect to the variant URL.
7. View analytics on the test detail page.

**Note:** Split URL tests never redirect on cart or checkout paths.

---

### 4.3 Offer Test

A/B tests upsell and promotional offers shown on product pages, cart drawer, and cart page.

1. Go to **Offer Tests → New Offer Test**.
2. Select an offer type: Free shipping threshold / Free gift / Volume discount / Quantity break / Campaign link.
3. Configure offer details and select placement (product page, cart drawer, cart page).
4. Click **Preview** to see the offer in context.
5. Click **Launch**.
6. Visit a product page or cart — the offer will appear for assigned visitors.
7. Add the qualifying item/amount to cart and proceed to checkout to verify the discount applies.

---

### 4.4 Checkout Test

Tests content blocks shown inside the Shopify checkout (requires Checkout UI Extension to be active).

1. Go to **Checkout Tests → New Checkout Test**.
2. Select a checkout block type (banner, upsell, notice, etc.) and placement.
3. Configure variant content for each variant.
4. Click **Launch**.
5. Add a product to the cart and proceed to checkout — the block appears in the assigned variant's position.
6. Complete the checkout to generate attribution data.

---

### 4.5 Discount Test

A/B tests automatic discounts applied at checkout via Shopify Functions.

1. Go to **Discount Tests → New Discount Test**.
2. Select discount type: Percentage / Fixed amount / Free product / Shipping discount.
3. Configure eligibility rules (minimum subtotal, product, customer tag).
4. Click **Launch**.
5. Add qualifying products to cart and go to checkout — the discount line appears for eligible visitors.
6. Complete the purchase and check the test's analytics for discount cost and revenue impact.

---

### 4.6 Shipping Test

Tests shipping promotions and checkout method customizations via Shopify Functions.

1. Go to **Shipping Tests → New Shipping Test**.
2. Select type: Free shipping threshold / Method rename / Method hide / Method ordering.
3. Configure the rule.
4. Click **Launch**.
5. Add a product to cart — the shipping progress bar (if configured) appears in the cart.
6. Proceed to checkout — the shipping methods appear per the configured variant.

---

### 4.7 Price Test

Tests how different displayed prices affect conversion. Prices are shown via the storefront runtime — no Shopify product prices are modified without an explicit rollout.

1. Go to **Price Tests → New Price Test**.
2. Select a product and variant.
3. Set a control price and one or more test prices.
4. Select display surfaces (PDP, collection, cart).
5. Review warnings (multi-currency, subscriptions, discount stacking).
6. Click **Launch**.
7. Visit the product page in an incognito window — the test price renders in the assigned variant.
8. Complete a purchase — revenue analytics appear on the test detail page.

**To roll out a winning price:** click **Roll Out** on the test detail page. This requires a double confirmation and creates a Shopify price backup before modifying any product data. Rollback is available for 7 days.

---

### 4.8 Template Test

Tests alternate product/page templates assigned to visitor segments.

1. Go to **Template Tests → New Template Test**.
2. Select a template from your Shopify theme.
3. Configure which products or pages the test applies to.
4. Click **Launch**.
5. Visit the page — the assigned template renders for the visitor's variant.

---

### 4.9 Theme Test

Tests alternate published themes across visitor segments.

1. Go to **Theme Tests → New Theme Test**.
2. Select the control theme (active) and variant theme (a published alternate).
3. Configure traffic split.
4. Click **Launch**.
5. Visit the storefront — visitors are assigned to one of the themes.

**Note:** Both themes must be published in Shopify before launch.

---

### 4.10 Personalization

Displays tailored content or offers to specific visitor segments (returning customers, UTM source, device type, etc.) without a statistical test.

1. Go to **Personalizations → New Personalization**.
2. Select a segment rule.
3. Configure the content or offer for the segment.
4. Click **Activate**.
5. Visit the storefront matching the segment conditions — the personalized content renders.

---

### 4.11 Post-purchase Personalization

Shows personalized content on the Shopify post-purchase / order status page.

1. Go to **Post-purchase Personalizations → New**.
2. Configure the segment and content.
3. Click **Activate**.
4. Complete a purchase that matches the segment — the personalized block appears on the order confirmation page.

---

## 5. Analytics

1. Click on any running test → **Analytics** tab.
2. See conversion rate, revenue per visitor, and statistical confidence per variant.
3. Click **Profit Analytics** to see margin impact (requires COGS to be configured).

To import COGS:
1. Go to **COGS** in the sidebar.
2. Upload a CSV with columns: `variant_id, cost_per_unit`.
3. MarginLab matches costs to variants and recalculates profit metrics.

---

## 6. Pausing and archiving tests

- **Pause:** stops variant assignment immediately. Existing assigned visitors keep their variant until the cookie expires.
- **Archive:** marks the test as complete. Historical data is retained. No new assignments.
- Both actions are available from the test detail page.

---

## 7. Uninstall

1. In Shopify Admin, go to **Settings → Apps → MarginLab → Delete**.
2. Confirm removal.

**Expected behavior:**
- The MarginLab app embed is deactivated in the theme.
- The Web Pixel stops sending events.
- Within 48 hours, Shopify sends a `shop/redact` webhook and all merchant data is permanently deleted from MarginLab's database.

---

## 8. Reinstall

1. Reinstall from the App Store listing.
2. Complete OAuth — a new merchant record is created.
3. Onboarding checklist reappears. Previous experiment history is not restored (deleted on redact).

---

## 9. Privacy compliance webhooks

MarginLab implements all three mandatory Shopify GDPR/privacy webhooks:

| Webhook | Behavior |
|---|---|
| `customers/data_request` | Logged. Data export provided within 30 days on request. |
| `customers/redact` | Nullifies `customerId` on order attributions. Deletes linked events. |
| `shop/redact` | Cascade-deletes all shop data (events, attributions, experiments, access token). |

All webhooks validate HMAC-SHA256, return HTTP 200, and are idempotent.

---

## 10. Known limitations

| Limitation | Details |
|---|---|
| Price test actual checkout price | Price display is storefront-only by default. Checkout price is not modified unless the merchant explicitly rolls out the price. |
| Checkout tests | Require the Shopify Checkout UI Extension to be installed and active in the checkout editor. |
| Discount / Shipping tests | Require Shopify Functions to be active. Functions are deployed with the app — no merchant action required. |
| Multi-currency price tests | A warning is shown. Displaying test prices in non-primary currencies may show the primary currency price. |
| Split URL tests on checkout/cart | Redirects are explicitly blocked on `/cart`, `/checkout`, and `/thank_you` paths. |
| Theme tests | Both themes must already be published in Shopify. |

---

## 11. Support

For any questions during review:

- **Email:** review@marginlab.io
- **Support:** support@marginlab.io
- **Privacy Policy:** [https://marginlab.io/privacy](https://marginlab.io/privacy)
- **Terms of Service:** [https://marginlab.io/terms](https://marginlab.io/terms)
