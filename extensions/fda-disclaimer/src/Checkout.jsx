import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

/**
 * FDA Disclaimer Interceptor
 *
 * Detects products in the cart that carry FDA disclaimer tags and renders
 * one mandatory checkbox per distinct disclaimer category. Blocks checkout
 * progress until every visible disclaimer has been accepted.
 *
 * Tag detection:
 *   - `fda-disclaimer`          → "general" category
 *   - `fda-<category>`          → named category (protein, preworkout, etc.)
 *
 * The tag prefix is configurable via settings (`category_tag_prefix`,
 * default "fda-"). Categories are derived from the suffix, e.g.:
 *   "fda-protein"    → category "protein"
 *   "fda-preworkout" → category "preworkout"
 *   "fda-vitamins"   → category "vitamins"
 *   "fda-weight-loss"→ category "weight-loss"
 *   "fda-disclaimer" → category "general"
 *
 * Disclaimer text resolution order (per category):
 *   1. Merchant setting  (e.g. settings.disclaimer_protein)
 *   2. i18n translation  (e.g. i18n.translate("disclaimer.protein"))
 *   3. Built-in fallback
 *
 * Per-category acceptance is tracked in a Map so adding/removing items from
 * the cart dynamically recalculates which disclaimers are needed, without
 * clearing already-accepted ones.
 */

// ── Built-in fallback disclaimers ─────────────────────────────────────────────

/** @type {Record<string, string>} */
const BUILTIN_DISCLAIMERS = {
  general:
    "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  protein:
    "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Consult a physician before use if you have any medical conditions or are taking any medications.",
  preworkout:
    "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Contains caffeine. Not recommended for persons under 18 years of age, pregnant or nursing women, or individuals sensitive to caffeine.",
  vitamins:
    "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Keep out of reach of children.",
  "weight-loss":
    "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Results may vary. Intended to be used in conjunction with a healthy diet and regular exercise program.",
};

/** @type {Record<string, string>} */
const BUILTIN_LABELS = {
  general:      "Dietary Supplement",
  protein:      "Protein Supplement",
  preworkout:   "Pre-Workout Supplement",
  vitamins:     "Vitamins & Supplements",
  "weight-loss": "Weight Management Supplement",
};

const DEFAULT_TAG_PREFIX = "fda-";
const GENERIC_TAG        = "fda-disclaimer";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the set of FDA disclaimer categories from a product's tag list.
 *
 * @param {string[]} tags
 * @param {string} prefix  e.g. "fda-"
 * @returns {Set<string>}  e.g. Set { "protein", "preworkout" }
 */
function categoriesFromTags(tags, prefix) {
  const result = new Set(/** @type {string[]} */ ([]));
  for (const tag of tags) {
    const lower = tag.toLowerCase().trim();
    if (lower === GENERIC_TAG || lower === prefix.replace(/-$/, "")) {
      result.add("general");
    } else if (lower.startsWith(prefix)) {
      const category = lower.slice(prefix.length).trim();
      if (category) result.add(category);
    }
  }
  return result;
}

/**
 * Collect all distinct FDA categories across every line in the current cart.
 *
 * @param {any[]} lines
 * @param {string} prefix
 * @returns {Set<string>}
 */
function collectCartCategories(lines, prefix) {
  const all = new Set(/** @type {string[]} */ ([]));
  for (const line of lines ?? []) {
    const tags =
      line?.merchandise?.product?.tags ??
      line?.merchandise?.tags ??
      [];
    for (const cat of categoriesFromTags(Array.isArray(tags) ? tags : [], prefix)) {
      all.add(cat);
    }
  }
  return all;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function () {
  render(<FdaDisclaimer />, document.body);
}

function FdaDisclaimer() {
  const { lines, settings, buyerJourney, i18n, applyAttributeChange } =
    /** @type {any} */ (shopify);

  const isInEditor = /** @type {any} */ (shopify).extension?.editor != null;

  // ── Settings ───────────────────────────────────────────────────────────────
  const rawPrefix = String(settings.current?.category_tag_prefix ?? "").trim();
  const prefix    = rawPrefix || DEFAULT_TAG_PREFIX;
  // Normalise: ensure it ends with "-"
  const tagPrefix = prefix.endsWith("-") ? prefix : `${prefix}-`;

  const customCheckboxLabel = String(settings.current?.checkbox_label ?? "").trim();

  /**
   * Resolve disclaimer text for a category.
   * @param {string} category
   * @returns {string}
   */
  function resolveDisclaimerText(category) {
    // 1. Merchant custom setting (key: disclaimer_<category with - → _>)
    const settingKey = `disclaimer_${category.replace(/-/g, "_")}`;
    const custom     = String(settings.current?.[settingKey] ?? "").trim();
    if (custom) return custom;

    // 2. i18n
    try {
      const translated = i18n.translate(`disclaimer.${category}`);
      if (translated && translated !== `disclaimer.${category}`) return translated;
    } catch { /* ignore */ }

    // 3. Built-in fallback
    return BUILTIN_DISCLAIMERS[category] ?? BUILTIN_DISCLAIMERS.general;
  }

  /**
   * Resolve human-readable category label.
   * @param {string} category
   * @returns {string}
   */
  function resolveCategoryLabel(category) {
    try {
      const translated = i18n.translate(`category_label.${category}`);
      if (translated && translated !== `category_label.${category}`) return translated;
    } catch { /* ignore */ }
    return BUILTIN_LABELS[category] ?? category;
  }

  /**
   * Resolve checkbox label.
   * @returns {string}
   */
  function resolveCheckboxLabel() {
    if (customCheckboxLabel) return customCheckboxLabel;
    try {
      const translated = i18n.translate("checkbox_label");
      if (translated && translated !== "checkbox_label") return translated;
    } catch { /* ignore */ }
    return "I have read and understand the above statement.";
  }

  // ── State ──────────────────────────────────────────────────────────────────

  // Set of categories currently required (from live cart lines)
  const [requiredCategories, setRequiredCategories] = useState(
    /** @type {Set<string>} */ (new Set())
  );

  // Map of category → accepted boolean
  const [acceptedMap, setAcceptedMap] = useState(
    /** @type {Map<string, boolean>} */ (new Map())
  );

  // Whether the intercept fired and not all are accepted
  const [showError, setShowError] = useState(false);

  // Stable refs for the intercept closure
  const requiredRef = useRef(/** @type {Set<string>} */ (new Set()));
  const acceptedRef = useRef(/** @type {Map<string, boolean>} */ (new Map()));
  requiredRef.current = requiredCategories;
  acceptedRef.current = acceptedMap;

  // ── Cart subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    function update() {
      const cats = collectCartCategories(lines.current ?? [], tagPrefix);
      setRequiredCategories(cats);
    }
    update();
    const unsub = lines.subscribe(update);
    return () => unsub();
  }, [tagPrefix]);

  // ── Write order attribute for audit ───────────────────────────────────────
  useEffect(() => {
    if (!applyAttributeChange) return;
    applyAttributeChange({
      type:  "updateAttribute",
      key:   "_fda_blocked",
      value: showError ? "true" : "false",
    }).catch(() => { /* non-critical */ });
  }, [showError]);

  // ── Checkout intercept ────────────────────────────────────────────────────
  useEffect(() => {
    /** @type {(() => void) | null} */
    let cleanup = null;

    buyerJourney
      .intercept(async (/** @type {any} */ { canBlockProgress }) => {
        if (!canBlockProgress) return { behavior: "allow" };

        const required = requiredRef.current;
        if (required.size === 0) return { behavior: "allow" };

        const accepted = acceptedRef.current;
        const allAccepted = [...required].every((cat) => accepted.get(cat) === true);

        if (!allAccepted) {
          return {
            behavior: "block",
            reason:   "FDA disclaimer not accepted",
            perform:  () => setShowError(true),
          };
        }

        return {
          behavior: "allow",
          perform:  () => setShowError(false),
        };
      })
      .then((/** @type {() => void} */ unsub) => { cleanup = unsub; });

    return () => { if (cleanup) cleanup(); };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  // In the checkout editor always render a preview even without cart items
  const categories =
    requiredCategories.size > 0
      ? [...requiredCategories].sort()
      : isInEditor
        ? ["general"]
        : [];

  if (categories.length === 0) return null;

  const checkboxLabel = resolveCheckboxLabel();
  const allAccepted   = categories.every((cat) => acceptedMap.get(cat) === true);

  return (
    <s-box padding="base">
      <s-stack direction="block" gap="base">

        {/* One disclaimer block per category */}
        {categories.map((category) => {
          const isAccepted  = acceptedMap.get(category) === true;
          const disclaimerText = resolveDisclaimerText(category);
          const categoryLabel  = resolveCategoryLabel(category);

          return (
            <s-box
              key={category}
              padding="small"
              border="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="small">

                {/* Category heading */}
                <s-text>{categoryLabel}</s-text>

                {/* Disclaimer body */}
                <s-text color="subdued">
                  {disclaimerText}
                </s-text>

                {/* Acceptance checkbox */}
                <s-stack direction="inline" alignItems="start" gap="small">
                  <s-checkbox
                    checked={isAccepted}
                    onChange={(/** @type {any} */ e) => {
                      const checked = e.target?.checked ?? e.detail?.checked ?? false;
                      setAcceptedMap((prev) => {
                        const next = new Map(prev);
                        next.set(category, checked);
                        return next;
                      });
                      if (checked) setShowError(false);
                    }}
                  />
                  <s-text>{checkboxLabel}</s-text>
                </s-stack>

              </s-stack>
            </s-box>
          );
        })}

        {/* Error banner — shown only when intercept fired and not all accepted */}
        {showError && !allAccepted && (
          <s-banner tone="critical">
            <s-text>
              {categories.length > 1
                ? i18n.translate("errors.must_accept_all")
                : i18n.translate("errors.must_accept_one")}
            </s-text>
          </s-banner>
        )}

      </s-stack>
    </s-box>
  );
}
