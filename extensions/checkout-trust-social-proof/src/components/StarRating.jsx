import "@shopify/ui-extensions/preact";

/**
 * StarRating — renders filled star glyphs.
 * "★★★★★" is readable by screen readers natively.
 *
 * @param {{ rating: number, max?: number }} props
 */
export function StarRating({ rating, max = 5 }) {
  const filled = Math.min(Math.max(Math.round(rating), 0), max);
  const stars = "⭐".repeat(filled) + "☆".repeat(max - filled);
  return <s-text type="strong">{stars}</s-text>;
}
