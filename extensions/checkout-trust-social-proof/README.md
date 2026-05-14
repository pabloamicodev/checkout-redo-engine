# Checkout Trust & Social Proof Extension

A Shopify Checkout UI Extension that renders a trust badges row and customer review cards inside the ONE SOL checkout.

---

## What It Does

- Displays three trust badges with icons and labels (30-Day Money Back Guarantee, Fast Shipping, Safe & Secure Checkout)
- Displays two customer review cards with quote, name, "Verified Buyer" label, and 5-star rating
- Works inside the Shopify Checkout Editor as a draggable app block
- Mobile-friendly — stacks gracefully on narrow screens

---

## File Structure

```
extensions/checkout-trust-social-proof/
  src/
    Checkout.jsx                      Entry point
    components/
      TrustSocialProofBlock.jsx       Main wrapper
      TrustBadgeList.jsx              Row of three trust badges
      TrustBadge.jsx                  Single badge (icon + label)
      ReviewList.jsx                  List of review cards
      ReviewCard.jsx                  Single review card
      StarRating.jsx                  Star glyphs renderer
    data/
      trustBadges.js                  Trust badge copy and icon URLs
      reviews.js                      Static review copy
  shopify.extension.toml
  package.json
  tsconfig.json
  shopify.d.ts
```

---

## How to Run Locally

From the project root:

```bash
npm install
npx shopify app dev --store onesolsupps.myshopify.com
```

Then open the preview URL printed in the terminal. It will look like:
```
https://onesolsupps.myshopify.com/...?preview_token=...
```

---

## How to Preview on ONE SOL

1. Run `npx shopify app dev --store onesolsupps.myshopify.com`
2. Copy the checkout preview URL from the terminal output
3. Open it in the browser — it opens the live checkout with the extension loaded
4. To place the block permanently, continue to the Checkout Editor steps below

---

## How to Place the Block in Checkout Editor

1. Go to [Shopify Admin → Settings → Checkout](https://admin.shopify.com/store/onesolsupps/settings/checkout)
2. Click **Customize** on your active checkout profile
3. In the left sidebar, click **Add app block**
4. Find **Checkout Trust & Social Proof** and add it
5. Drag it to the desired location (recommended: below the order summary or above the payment section)
6. Click **Save**

> **Note:** `purchase.checkout.block.render` is available on all Shopify plans. No Shopify Plus requirement for this target.

---

## How to Replace Icons

Open `src/data/trustBadges.js` and update the `iconSource` field for each badge:

```js
export const TRUST_BADGES = [
  {
    id: "guarantee",
    label: "30-Day Money Back Guarantee*",
    iconSource: "https://YOUR_NEW_URL_HERE.webp",  // <-- replace this
    accessibilityLabel: "30-Day Money Back Guarantee",
  },
  // ...
];
```

Icons must be publicly accessible URLs (Shopify CDN, your own CDN, or Shopify Files).

> Shopify Checkout Extensions do not support local file paths for images — you must use remote HTTPS URLs.

---

## How to Replace Review Copy

Open `src/data/reviews.js` and update or add entries:

```js
export const REVIEWS = [
  {
    id: "review-1",
    quote: "Your ONE SOL customer quote here.",
    name: "Customer Name",
    label: "Verified Buyer",
    rating: 5,
  },
  // add more as needed
];
```

No layout code needs to change. The `ReviewList` component renders whatever is in this array.

---

## Shopify Plus Requirement

This extension uses the target `purchase.checkout.block.render`.

- ✅ **Available on all Shopify plans** — no Plus required
- ✅ Can be placed anywhere the Checkout Editor allows app blocks
- ⚠️ Some checkout step targets (e.g. `purchase.checkout.payment-method-list.render`) require Shopify Plus. This extension does **not** use those targets.

---

## Loox Integration Notes

**V1 uses static review data only.**

Loox storefront widgets cannot be injected directly into Shopify Checkout. Reasons:
- Shopify Checkout extensions run in a sandboxed worker — no access to `window`, `document`, or external scripts
- Loox's standard widget relies on DOM injection and external JS, neither of which is available inside a checkout extension

### Options for dynamic reviews in a future V2:

1. **Backend proxy**: Create an app backend that fetches Loox reviews via Loox's API and exposes a simple endpoint. The checkout extension fetches from your own endpoint using `fetch()` at render time.
2. **Official Loox checkout integration**: If Loox releases an official Shopify Checkout Extensibility app block or metafield-based integration, migrate to that.
3. **Shopify Metafields**: Store curated reviews in shop metafields and read them in the extension via `shopify.metafields`.

Until one of these options is viable, the static `src/data/reviews.js` file is the source of truth for review content.
