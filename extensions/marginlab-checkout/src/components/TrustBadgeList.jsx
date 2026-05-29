import "@shopify/ui-extensions/preact";
import { TrustBadge } from "./TrustBadge.jsx";

export function TrustBadgeList({ badges }) {
  return (
    <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
      {badges.map((badge) => (
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
