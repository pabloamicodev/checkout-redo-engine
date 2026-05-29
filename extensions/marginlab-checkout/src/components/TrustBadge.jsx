import "@shopify/ui-extensions/preact";

export function TrustBadge({ line1, line2, iconSource, accessibilityLabel }) {
  return (
    <s-stack direction="block" gap="small" alignItems="center">
      <s-stack inlineSize="72px" blockSize="72px" alignItems="center" justifyContent="center">
        <s-image src={iconSource} alt={accessibilityLabel} inlineSize="fill" />
      </s-stack>
      <s-stack direction="block" gap="none" alignItems="center">
        <s-text type="small">{line1}</s-text>
        <s-text type="small">{line2}</s-text>
      </s-stack>
    </s-stack>
  );
}
