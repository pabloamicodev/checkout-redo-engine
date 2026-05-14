import "@shopify/ui-extensions/preact";
import { TrustBadgeList } from "./TrustBadgeList.jsx";
import { ReviewList } from "./ReviewList.jsx";

/**
 * TrustSocialProofBlock — main wrapper that composes the full section.
 *
 * Layout:
 *   1. Trust badges (icon + label, 3-column row)
 *   2. Divider
 *   3. Customer reviews (stacked cards)
 */
export function TrustSocialProofBlock() {
  return (
    <s-box paddingBlock="base" paddingInline="none">
      <s-stack direction="block" gap="base">
        <TrustBadgeList />
        <s-divider />
        <ReviewList />
      </s-stack>
    </s-box>
  );
}
