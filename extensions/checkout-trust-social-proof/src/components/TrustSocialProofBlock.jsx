import "@shopify/ui-extensions/preact";
import { useState, useEffect } from "preact/hooks";
import { TrustBadgeList } from "./TrustBadgeList.jsx";
import { ReviewList } from "./ReviewList.jsx";
import { TRUST_BADGES } from "../data/trustBadges.js";
import { REVIEWS } from "../data/reviews.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id?: string, iconSource?: string, line1?: string, line2?: string, accessibilityLabel?: string }} BadgeContent
 * @typedef {{ id?: string, quote: string, name: string, rating?: number, label?: string }} ReviewContent
 * @typedef {{ badges?: BadgeContent[], reviews?: ReviewContent[] }} BlockContent
 */

// ── Session key ───────────────────────────────────────────────────────────────

// Module-level: set once per checkout session load, stays stable across steps.
// Used for deterministic variant assignment without needing cart/session API access.
const ML_SESSION_KEY = String(Math.random());

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * djb2 hash: maps a string to an index in [0, n).
 * Same input → same output, so a visitor always gets the same variant.
 * @param {string} str
 * @param {number} n
 */
function hashToIndex(str, n) {
  if (!str || n <= 1) return 0;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h) % n;
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * TrustSocialProofBlock
 *
 * Content priority:
 *  1. MarginLab runtime config — active checkout A/B test variant (requires ml_app_url)
 *  2. Shopify extension settings (badge_n_*, review_n_*)
 *  3. Static defaults from trustBadges.ts / reviews.ts
 */
export function TrustSocialProofBlock() {
  // eslint-disable-next-line deprecation/deprecation
  const s = /** @type {Record<string, unknown>} */ (shopify.settings.current) ?? {};

  /** @type {[BlockContent | null, (v: BlockContent | null) => void]} */
  const [mlContent, setMlContent] = useState(/** @type {BlockContent | null} */ (null));

  useEffect(() => {
    const appUrl = String(s["ml_app_url"] ?? "").trim().replace(/\/$/, "");
    if (!appUrl) return;

    let cancelled = false;

    const shopDomain = (() => {
      try { return /** @type {any} */ (shopify).shop?.myshopifyDomain ?? ""; }
      catch (_) { return ""; }
    })();

    fetch(`${appUrl}/api/runtime/config`, {
      headers: { "X-Shop-Domain": shopDomain },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((/** @type {any} */ config) => {
        if (cancelled || !config) return;

        const experiment = /** @type {any[]} */ (config.experiments ?? []).find(
          (/** @type {any} */ e) =>
            e.status === "RUNNING" && e.type === "CHECKOUT_TEST"
        );
        if (!experiment || !experiment.variants?.length) return;

        const variantIdx = hashToIndex(ML_SESSION_KEY, experiment.variants.length);
        const variant = /** @type {any} */ (experiment.variants[variantIdx]);
        if (!variant?.checkoutBlockIds?.length) return;

        const block = /** @type {any[]} */ (config.checkoutBlocks ?? []).find(
          (/** @type {any} */ b) =>
            variant.checkoutBlockIds.includes(b.id) && b.type === "TRUST_BADGES"
        );
        if (block?.content) setMlContent(/** @type {BlockContent} */ (block.content));
      })
      .catch(() => {}); // fail silently — static defaults will be used

    return () => { cancelled = true; };
  }, []);

  // ── Build badge list ───────────────────────────────────────────────────────

  const badges = mlContent?.badges?.length
    ? mlContent.badges.map((b, i) => ({
        id:                 b.id                 ?? `ml-badge-${i}`,
        iconSource:         b.iconSource         ?? "",
        line1:              b.line1              ?? "",
        line2:              b.line2              ?? "",
        accessibilityLabel: b.accessibilityLabel ?? b.line1 ?? "",
      }))
    : TRUST_BADGES.map((def, i) => {
        const n = i + 1;
        return {
          ...def,
          ...(s[`badge_${n}_icon`]  ? { iconSource: String(s[`badge_${n}_icon`]).trim()  } : {}),
          ...(s[`badge_${n}_line1`] ? { line1:      String(s[`badge_${n}_line1`]).trim() } : {}),
          ...(s[`badge_${n}_line2`] ? { line2:      String(s[`badge_${n}_line2`]).trim() } : {}),
        };
      });

  // ── Build review list ──────────────────────────────────────────────────────

  const settingsReviews = [1, 2, 3]
    .map((n) => ({
      id:     `review-settings-${n}`,
      quote:  String(s[`review_${n}_quote`] ?? "").trim(),
      name:   String(s[`review_${n}_name`]  ?? "").trim(),
      label:  "Verified Buyer",
      rating: Math.min(5, Math.max(1, Number(s[`review_${n}_rating`] ?? 5))),
    }))
    .filter((r) => r.quote.length > 0);

  const reviews = mlContent?.reviews?.length
    ? mlContent.reviews.map((r) => ({
        id:     r.id     ?? `ml-review-${Math.random()}`,
        quote:  r.quote  ?? "",
        name:   r.name   ?? "",
        label:  r.label  ?? "Verified Buyer",
        rating: Math.min(5, Math.max(1, Number(r.rating ?? 5))),
      }))
    : settingsReviews.length > 0
      ? settingsReviews
      : REVIEWS;

  return (
    <s-box paddingBlock="base" paddingInline="none">
      <s-stack direction="block" gap="base">
        <TrustBadgeList badges={badges} />
        <s-divider />
        <ReviewList reviews={reviews} />
      </s-stack>
    </s-box>
  );
}
