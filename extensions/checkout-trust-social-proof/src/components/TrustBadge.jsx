import "@shopify/ui-extensions/preact";

/**
 * TrustBadge — renders a single trust icon + two-line label.
 * Image container is fixed to 72px × 72px to normalize sizes across badges.
 *
 * @param {{ line1: string, line2: string, iconSource: string, accessibilityLabel: string }} props
 */
export function TrustBadge({ line1, line2, iconSource, accessibilityLabel }) {
  return (
    <s-stack direction="block" gap="small" alignItems="center">
      <s-stack
        inlineSize="72px"
        blockSize="72px"
        alignItems="center"
        justifyContent="center"
      >
        <s-image
          src={iconSource}
          alt={accessibilityLabel}
          inlineSize="fill"
        />
      </s-stack>
      <s-stack direction="block" gap="none" alignItems="center">
        <s-text type="small">{line1}</s-text>
        <s-text type="small">{line2}</s-text>
      </s-stack>
    </s-stack>
  );
}
