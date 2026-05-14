import "@shopify/ui-extensions/preact";
import { TrustBadge } from "./TrustBadge.jsx";
import { TRUST_BADGES } from "../data/trustBadges.js";


export function TrustBadgeList() {
  return (
    <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
      {TRUST_BADGES.map((badge) => (
        <TrustBadge
          key={badge.id}
          line1={badge.line1}
          line2={badge.line2}
          iconSource={badge.iconSource}
          accessibilityLabel={badge.accessibilityLabel}
        />
      ))}
    </s-grid>
  );
}
