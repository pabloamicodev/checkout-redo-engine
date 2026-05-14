import "@shopify/ui-extensions/preact";
import { TrustBadgeList } from "./TrustBadgeList.jsx";
import { ReviewList } from "./ReviewList.jsx";
import { TRUST_BADGES } from "../data/trustBadges.js";
import { REVIEWS } from "../data/reviews.js";

/**
 * TrustSocialProofBlock — main wrapper.
 *
 */
export function TrustSocialProofBlock() {
  const s = shopify.settings.current ?? {};

  // Merge settings over static badge defaults
  const badges = TRUST_BADGES.map((def, i) => {
    const n = i + 1;
    const icon  = s[`badge_${n}_icon`];
    const line1 = s[`badge_${n}_line1`];
    const line2 = s[`badge_${n}_line2`];
    return {
      ...def,
      ...(icon  ? { iconSource: String(icon).trim()  } : {}),
      ...(line1 ? { line1:      String(line1).trim() } : {}),
      ...(line2 ? { line2:      String(line2).trim() } : {}),
    };
  });

  // Build reviews from settings slots (1–5); fall back to static if none set
  const settingsReviews = [1, 2, 3]
    .map((n) => ({
      id:     `review-settings-${n}`,
      quote:  String(s[`review_${n}_quote`] ?? "").trim(),
      name:   String(s[`review_${n}_name`]  ?? "").trim(),
      label:  "Verified Buyer",
      rating: Math.min(5, Math.max(1, Number(s[`review_${n}_rating`] ?? 5))),
    }))
    .filter((r) => r.quote.length > 0);

  const reviews = settingsReviews.length > 0 ? settingsReviews : REVIEWS;

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

