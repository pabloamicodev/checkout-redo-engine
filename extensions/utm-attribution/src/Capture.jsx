import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect } from "preact/hooks";

/**
 * UTM Attribution Capture
 *
 * Invisible checkout extension. Runs silently once on mount.
 *
 * Attribution chain:
 *   1. Storefront theme / Web Pixel writes UTM params to cart attributes
 *      before the buyer enters checkout (e.g. from landing page URL).
 *   2. This extension reads those cart attributes and copies them as
 *      ORDER attributes so they survive checkout and appear on the
 *      order record in Shopify Admin.
 *
 * Keys captured (all prefixed with `_` → hidden in Shopify Admin UI):
 *   _utm_source, _utm_medium, _utm_campaign, _utm_content, _utm_term
 *   _fbclid, _gclid
 *   _referrer
 *   _utm_captured_at (ISO timestamp, written when ≥1 UTM param is found)
 *
 * Deduplication:
 *   - Cart attributes are set once by the storefront and persist for the
 *     cart's lifetime, so they survive checkout refreshes automatically.
 *   - We skip `applyAttributeChange` if the resolved value is empty,
 *     which means a re-run without UTMs in the URL will never clear
 *     UTMs already captured in cart attributes.
 *   - The `_utm_captured_at` attribute is only written when at least one
 *     UTM param is found, so it can be used as a proxy for "was attribution
 *     data present for this order?"
 *
 * URL fallback:
 *   If the storefront did not write cart attributes (e.g. the buyer landed
 *   directly on the checkout URL with UTM params in the query string), we
 *   attempt to read the params from `window.location.search`.
 */

/** UTM param keys (stored in cart attributes without underscore prefix). */
const UTM_KEYS = /** @type {const} */ ([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
]);

const MAX_ATTR_LENGTH = 255;

/**
 * Attempt to read a query param from the current URL.
 * Returns `null` in sandboxed environments where `window` is unavailable.
 *
 * @param {string} key
 * @returns {string | null}
 */
function readUrlParam(key) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  } catch {
    return null;
  }
}

/**
 * Build a lookup map from the cart's attribute array.
 * Handles both `{ key, value }[]` (Shopify canonical) and plain objects.
 *
 * @param {unknown} attributes
 * @returns {Map<string, string>}
 */
function buildAttrMap(attributes) {
  const map = new Map();
  if (!Array.isArray(attributes)) return map;
  for (const item of attributes) {
    if (item && typeof item === "object" && "key" in item && "value" in item) {
      const k = String(item.key ?? "");
      const v = String(item.value ?? "");
      if (k && v) map.set(k, v);
    }
  }
  return map;
}

function Capture() {
  const { applyAttributeChange } = /** @type {any} */ (shopify);

  useEffect(() => {
    // ── Read cart attributes set by the storefront ─────────────────────────
    //
    // The Shopify checkout extension API exposes cart attributes via
    // `shopify.cart?.attributes`. They are the SAME attributes that the
    // storefront sets via `cart/update.js` or `applyAttributeChange`.
    //
    // We build a Map keyed by both the plain key ("utm_source") AND the
    // underscored variant ("_utm_source") so we catch either convention.
    const rawAttributes = /** @type {any} */ (shopify).cart?.attributes ?? [];
    const attrMap = buildAttrMap(rawAttributes);

    /**
     * Resolve a value for a given UTM key using:
     *   1. Underscored cart attribute  (_utm_source)
     *   2. Plain cart attribute        (utm_source)
     *   3. URL query param fallback    (?utm_source=...)
     *
     * @param {string} key  plain key, e.g. "utm_source"
     * @returns {string | null}
     */
    function resolve(key) {
      return (
        attrMap.get(`_${key}`) ??
        attrMap.get(key) ??
        readUrlParam(key) ??
        null
      );
    }

    /**
     * Write a single order attribute.
     * Silently skips empty / null values to avoid clearing existing data.
     *
     * @param {string} key   already prefixed with `_`
     * @param {string | null} value
     * @returns {boolean}  true if attribute was written
     */
    function write(key, value) {
      if (!value) return false;
      const trimmed = value.trim().slice(0, MAX_ATTR_LENGTH);
      if (!trimmed) return false;
      applyAttributeChange({
        type: "updateAttribute",
        key,
        value: trimmed,
      });
      return true;
    }

    // ── Write UTM + tracking params ────────────────────────────────────────
    let capturedCount = 0;

    for (const key of UTM_KEYS) {
      const value = resolve(key);
      if (write(`_${key}`, value)) capturedCount++;
    }

    // ── Referrer ───────────────────────────────────────────────────────────
    //
    // The storefront can write a `referrer` cart attribute containing
    // document.referrer (captured before navigation to checkout). We also
    // try to read it from the current document as a last resort.
    const referrerValue =
      attrMap.get("_referrer") ??
      attrMap.get("referrer") ??
      (() => {
        try {
          return document.referrer || null;
        } catch {
          return null;
        }
      })();

    write("_referrer", referrerValue);

    // ── Capture timestamp ──────────────────────────────────────────────────
    //
    // Written only when ≥1 UTM param is found. This makes it easy to
    // filter orders by "has attribution data" in analytics tools.
    if (capturedCount > 0) {
      write("_utm_captured_at", new Date().toISOString());
    }
  }, []);

  // This extension renders nothing — it is purely logic.
  return null;
}

export default function () {
  render(<Capture />, document.body);
}
