import "@shopify/ui-extensions/preact";
import { StarRating } from "./StarRating.jsx";

/**
 * ReviewCard — renders a single customer testimonial.
 * minInlineSize="240px" keeps cards from shrinking inside the horizontal scroll row.
 *
 * @param {{ quote: string, name: string, label: string, rating: number }} props
 */
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
      {/* Top section: stars + quote */}
      <s-stack direction="block" gap="small">
        <StarRating rating={rating} />
        <s-text>"{quote}"</s-text>
      </s-stack>

      {/* Bottom section: always pinned to bottom */}
      <s-stack direction="block" gap="none">
        <s-text type="strong">{name}</s-text>
        <s-text type="emphasis" color="subdued">{label}</s-text>
      </s-stack>
    </s-stack>
  );
}
