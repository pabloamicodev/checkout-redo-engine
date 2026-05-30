// @ts-nocheck
import "@shopify/ui-extensions/preact";

export function StarRating({ rating, max = 5 }) {
  const filled = Math.min(Math.max(Math.round(rating), 0), max);
  const stars = "⭐".repeat(filled) + "☆".repeat(max - filled);
  return <s-text type="strong">{stars}</s-text>;
}
