// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { StarRating } from "./StarRating.jsx";

export function ReviewCard({ quote, name, label, rating }) {
  return (
    <s-stack
      direction="block"
      gap="small"
      border="base"
      borderRadius="base"
      padding="base"
      blockSize="100%"
      justifyContent="space-between"
    >
      <s-stack direction="block" gap="small">
        <StarRating rating={rating} />
        <s-text>"{quote}"</s-text>
      </s-stack>
      <s-stack direction="block" gap="none">
        <s-text type="strong">{name}</s-text>
        <s-text type="emphasis" color="subdued">{label}</s-text>
      </s-stack>
    </s-stack>
  );
}
