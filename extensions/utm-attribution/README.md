# UTM Attribution — Storefront Setup

The `utm-attribution` checkout extension reads UTM params that the storefront
writes to the cart **before** the buyer enters checkout.

Without this storefront snippet, the extension falls back to reading
`window.location.search` (only reliable if the buyer lands directly on
`/checkout` with UTM params in the URL, which is rare).

---

## How it works

```
Landing page URL
  ?utm_source=google&utm_medium=cpc&utm_campaign=protina-launch
        │
        ▼
theme.liquid / storefront JS
  reads URL params → writes to cart attributes
        │
        ▼
Buyer enters checkout
        │
        ▼
utm-attribution extension (invisible)
  reads cart attributes → writes as ORDER attributes
        │
        ▼
Order in Shopify Admin has:
  _utm_source     = "google"
  _utm_medium     = "cpc"
  _utm_campaign   = "protina-launch"
  _utm_captured_at = "2026-05-22T14:23:00.000Z"
```

---

## Storefront snippet (Liquid + JS)

Add this to `theme.liquid` just before `</body>`, or as a standalone
`snippets/utm-capture.liquid` that you `{% render %}` from `theme.liquid`.

```liquid
{% comment %}
  UTM Attribution Capture
  Reads UTM params + fbclid/gclid from the landing page URL and writes them
  to cart attributes. The utm-attribution checkout extension then promotes
  these to order attributes.

  Cart attributes set here:
    utm_source, utm_medium, utm_campaign, utm_content, utm_term
    fbclid, gclid, referrer
{% endcomment %}

<script>
(function () {
  'use strict';

  var UTM_KEYS = [
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'fbclid', 'gclid'
  ];

  /**
   * Read a value from either sessionStorage (preferred — persists until tab closes)
   * or from the current URL params.
   */
  function readParam(key) {
    try {
      var stored = sessionStorage.getItem('_ml_' + key);
      if (stored) return stored;
    } catch (e) {}

    var params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  // Capture from URL on landing (before any redirect strips params)
  var captured = {};
  var found = false;

  UTM_KEYS.forEach(function (key) {
    var params = new URLSearchParams(window.location.search);
    var value = params.get(key);
    if (value) {
      try { sessionStorage.setItem('_ml_' + key, value); } catch (e) {}
      captured[key] = value;
      found = true;
    }
  });

  // Capture referrer once (first touch — don't overwrite with internal nav)
  try {
    var storedRef = sessionStorage.getItem('_ml_referrer');
    if (!storedRef && document.referrer && !document.referrer.includes(window.location.hostname)) {
      sessionStorage.setItem('_ml_referrer', document.referrer);
    }
  } catch (e) {}

  // Only write to cart if we have something useful (avoid unnecessary API calls)
  var attributes = [];

  UTM_KEYS.forEach(function (key) {
    var val = readParam(key);
    if (val) {
      attributes.push({ key: key, value: val.slice(0, 255) });
    }
  });

  try {
    var ref = sessionStorage.getItem('_ml_referrer');
    if (ref) attributes.push({ key: 'referrer', value: ref.slice(0, 255) });
  } catch (e) {}

  if (attributes.length === 0) return;

  // Write to cart attributes via the AJAX Cart API
  fetch('/cart/update.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ attributes: Object.fromEntries(attributes.map(function(a) { return [a.key, a.value]; })) })
  }).catch(function () { /* silent fail — attribution is best-effort */ });
})();
</script>
```

---

## Verification

After installing the checkout extension and adding the storefront snippet:

1. Visit any product page with UTM params:
   `https://yourstore.myshopify.com/products/protein?utm_source=google&utm_medium=cpc&utm_campaign=test`

2. Add a product to cart and go to checkout.

3. Complete a test order.

4. In Shopify Admin → Orders → [order] → scroll to **Additional details**:
   - `_utm_source` = `google`
   - `_utm_medium` = `cpc`
   - `_utm_campaign` = `test`
   - `_utm_captured_at` = ISO timestamp

---

## Order attributes written by the extension

| Key | Source | Example |
|---|---|---|
| `_utm_source` | Cart attr → URL fallback | `google` |
| `_utm_medium` | Cart attr → URL fallback | `cpc` |
| `_utm_campaign` | Cart attr → URL fallback | `protina-launch` |
| `_utm_content` | Cart attr → URL fallback | `banner-a` |
| `_utm_term` | Cart attr → URL fallback | `whey protein` |
| `_fbclid` | Cart attr → URL fallback | `IwAR3x...` |
| `_gclid` | Cart attr → URL fallback | `EAIaIQ...` |
| `_referrer` | Cart attr → `document.referrer` | `https://instagram.com/` |
| `_utm_captured_at` | Written if ≥1 UTM found | `2026-05-22T14:23:00.000Z` |

All keys are prefixed with `_` which marks them as **private** in Shopify — 
they appear in the Admin UI but are hidden from buyers in the Order Status page.
